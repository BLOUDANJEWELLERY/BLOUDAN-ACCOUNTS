// pages/balance-sheet/locker-ledger.tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

type LockerVoucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "INV" | "REC";
  accountId: string;
  account: {
    name: string;
    accountNo: number;
    type: string;
  };
  gold: number;
  kwd: number;
  paymentMethod?: string;
  goldRate?: number;
  fixingAmount?: number;
  lockerGoldChange: number;
  lockerGoldBalance: number;
  quantity?: number;
};

type Props = {
  allVouchers: LockerVoucher[];
  openingLockerGold: number;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Fetch ALL locker-affecting vouchers (no date filtering initially)
  const allVouchers = await prisma.voucher.findMany({
    where: {
      vt: { in: ["INV", "REC"] },
      // Exclude GFV vouchers
      NOT: { vt: "GFV" }
    },
    include: {
      account: {
        select: {
          name: true,
          accountNo: true,
          type: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Helper function to calculate locker gold change for a voucher
  const calculateLockerGoldChange = (voucher: any): number => {
    // Skip GFV vouchers (shouldn't happen due to filter, but just in case)
    if (voucher.vt === "GFV") return 0;

    if (voucher.account.type === "Market") {
      if (voucher.vt === "INV") {
        return -voucher.gold; // INV negative
      } else if (voucher.vt === "REC") {
        // For REC vouchers, only count if payment method is NOT cheque
        if (voucher.paymentMethod !== "cheque") {
          return voucher.gold; // REC positive (only non-cheque)
        }
        return 0; // If payment method is cheque, don't count
      }
    } else if (["Casting", "Faceting", "Project"].includes(voucher.account.type)) {
      if (voucher.vt === "INV") {
        return -voucher.gold; // INV negative
      } else if (voucher.vt === "REC") {
        return voucher.gold; // REC positive
      }
    } else if (voucher.account.type === "Gold Fixing") {
      // Only count REC vouchers for Gold Fixing
      if (voucher.vt === "REC") {
        return voucher.gold; // REC positive
      }
    }
    
    return 0;
  };

  // Compute running balances for Locker Gold
  let lockerGoldBalance = 0;
  
  const processedVouchers = allVouchers.map((v) => {
    const lockerGoldChange = calculateLockerGoldChange(v);
    lockerGoldBalance += lockerGoldChange;
    
    return { 
      ...v, 
      lockerGoldChange,
      lockerGoldBalance
    };
  });

  return {
    props: {
      allVouchers: JSON.parse(JSON.stringify(processedVouchers)),
      openingLockerGold: 0, // Starting from beginning, opening balance is 0
    },
  };
};

export default function LockerLedger({
  allVouchers,
  openingLockerGold,
}: Props) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Date range state - initialize with empty strings to show all transactions
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });

  // Filter vouchers by date range (client-side)
  const filteredVouchers = useMemo(() => {
    if (!dateRange.start && !dateRange.end) {
      return allVouchers;
    }

    return allVouchers.filter((voucher) => {
      const voucherDate = voucher.date;
      const startDate = dateRange.start;
      const endDate = dateRange.end;
      
      return (!startDate || voucherDate >= startDate) && 
             (!endDate || voucherDate <= endDate);
    });
  }, [allVouchers, dateRange.start, dateRange.end]);

  // Calculate opening balance for filtered period
  const calculateOpeningBalance = useMemo(() => {
    if (!dateRange.start) {
      return 0;
    }

    const startDate = dateRange.start;
    let openingBalance = 0;

    // Find the last entry before the start date
    for (let i = allVouchers.length - 1; i >= 0; i--) {
      const voucherDate = allVouchers[i].date;
      if (voucherDate < startDate) {
        openingBalance = allVouchers[i].lockerGoldBalance;
        break;
      }
    }

    return openingBalance;
  }, [allVouchers, dateRange.start]);

  // Calculate closing balance for filtered period
  const calculateClosingBalance = useMemo(() => {
    if (filteredVouchers.length === 0) {
      return calculateOpeningBalance;
    }

    const lastVoucher = filteredVouchers[filteredVouchers.length - 1];
    return lastVoucher.lockerGoldBalance;
  }, [filteredVouchers, calculateOpeningBalance]);

  // Handle date range change
  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setDateRange({ start: newStart, end: newEnd });
  };

  // Calculate totals for filtered results
  const totalGoldAdded = filteredVouchers.reduce((sum, v) => sum + Math.max(0, v.lockerGoldChange), 0);
  const totalGoldRemoved = filteredVouchers.reduce((sum, v) => sum + Math.min(0, v.lockerGoldChange), 0);
  const netGoldChange = filteredVouchers.reduce((sum, v) => sum + v.lockerGoldChange, 0);

  // Get current overall balance
  const currentLockerBalance = allVouchers.length > 0 
    ? allVouchers[allVouchers.length - 1].lockerGoldBalance 
    : 0;

  // Helper function to get current month date range
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  // Helper function to get last month date range
  const getLastMonthRange = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return {
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0]
    };
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get voucher type text
  const getVoucherTypeText = (vt: string) => {
    switch (vt) {
      case 'REC': return 'Receipt';
      case 'INV': return 'Invoice';
      default: return vt;
    }
  };

  // Get voucher type style
  const getVoucherTypeStyle = (voucher: LockerVoucher) => {
    if (voucher.vt === "REC") {
      if (voucher.account.type === "Market" && voucher.paymentMethod === "cheque") {
        return "bg-gray-100 text-gray-800 border border-gray-300";
      }
      return "bg-green-100 text-green-800 border border-green-300";
    } else if (voucher.vt === "INV") {
      return "bg-red-100 text-red-800 border border-red-300";
    }
    return "bg-gray-100 text-gray-800 border border-gray-300";
  };

  // Get account type style
  const getAccountTypeStyle = (type: string) => {
    const styles = {
      'Market': "bg-blue-100 text-blue-800 border border-blue-300",
      'Casting': "bg-purple-100 text-purple-800 border border-purple-300",
      'Faceting': "bg-amber-100 text-amber-800 border border-amber-300",
      'Project': "bg-emerald-100 text-emerald-800 border border-emerald-300",
      'Gold Fixing': "bg-yellow-100 text-yellow-800 border border-yellow-300",
    };
    return styles[type as keyof typeof styles] || "bg-gray-100 text-gray-800 border border-gray-300";
  };

  // Check if voucher affects locker
  const affectsLocker = (voucher: LockerVoucher) => {
    return voucher.lockerGoldChange !== 0;
  };

  const clearFilters = () => {
    handleDateRangeChange("", "");
  };

  const setCurrentMonth = () => {
    const range = getCurrentMonthRange();
    handleDateRangeChange(range.start, range.end);
  };

  const setLastMonth = () => {
    const range = getLastMonthRange();
    handleDateRangeChange(range.start, range.end);
  };

  const downloadPdf = async () => {
    try {
      setDownloadingPdf(true);

      const pdfData = {
        accountType: "Locker Gold",
        dateRange,
        voucherData: {
          allVouchers,
          filteredVouchers,
          openingBalance: calculateOpeningBalance,
          closingBalance: calculateClosingBalance,
          totals: {
            goldAdded: totalGoldAdded,
            goldRemoved: totalGoldRemoved,
            netChange: netGoldChange,
          },
        },
      };

      const response = await fetch("/api/generate-locker-ledger-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Server error:", result);
        throw new Error(
          result.details ||
            result.error ||
            `Failed to generate PDF: ${response.status} ${response.statusText}`
        );
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to generate PDF");
      }

      // Convert base64 → Blob
      const binaryString = atob(result.pdfData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/pdf" });

      const fileName = `locker-ledger-${dateRange.start || "all"}-to-${
        dateRange.end || "all"
      }.pdf`;

      const file = new File([blob], fileName, { type: "application/pdf" });

      // iOS detection
      const ua = navigator.userAgent || navigator.vendor;
      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      // iOS → Share Sheet, Desktop → Download
      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Locker Ledger PDF",
          files: [file],
        });
      } else {
        // Desktop / Android / fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 rounded-3xl blur-lg opacity-30 transform scale-110 -z-10"></div>
              <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-red-300 transform hover:scale-105 transition-transform duration-300">
                <svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-red-700 to-red-900 bg-clip-text text-transparent mb-4 tracking-tight">
              Locker Gold Ledger
            </h1>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <span className="inline-flex px-6 py-3 rounded-full text-lg font-semibold bg-red-100 text-red-800 border border-red-300">
                Physical Gold Tracking
              </span>
              <p className="text-xl text-red-700 font-light">
                {allVouchers.length} Total Transactions | Current Balance: {formatCurrency(currentLockerBalance)} g
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-red-300">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-red-700">Total Transactions</p>
                  <p className="text-2xl font-bold text-red-800">{allVouchers.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-red-300">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-red-700">Current Locker Balance</p>
                  <p className="text-2xl font-bold text-red-800">{formatCurrency(currentLockerBalance)} g</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-red-300">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-red-700">Filtered Transactions</p>
                  <p className="text-2xl font-bold text-red-800">{filteredVouchers.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-red-300">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-red-700">Net Change</p>
                  <p className="text-xl font-bold text-red-800">
                    {netGoldChange >= 0 ? '+' : ''}{formatCurrency(netGoldChange)} g
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Summary Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 border-2 border-red-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-red-200 to-red-400 rounded-full -translate-x-16 -translate-y-16 opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-pink-200 to-pink-400 rounded-full translate-x-24 translate-y-24 opacity-20"></div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-800">Locker Balance Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                calculateOpeningBalance >= 0 
                  ? "bg-gradient-to-r from-red-600 to-red-800 border-red-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Opening Balance</p>
                <p className="text-3xl font-bold">{formatCurrency(calculateOpeningBalance)} g</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  Balance at start of period
                </p>
              </div>
              
              <div className="rounded-2xl p-6 text-center shadow-lg border-2 bg-gradient-to-r from-amber-600 to-amber-800 border-amber-400 text-white transform hover:-translate-y-1 transition-transform duration-300">
                <p className="text-lg font-semibold mb-2">Net Change</p>
                <p className={`text-3xl font-bold ${netGoldChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {netGoldChange >= 0 ? '+' : ''}{formatCurrency(netGoldChange)} g
                </p>
                <div className="text-sm mt-3 opacity-90 font-medium">
                  <div className="flex justify-center space-x-4">
                    <span className="text-green-300">+{formatCurrency(totalGoldAdded)}</span>
                    <span className="text-red-300">-{formatCurrency(Math.abs(totalGoldRemoved))}</span>
                  </div>
                </div>
              </div>
              
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                calculateClosingBalance >= 0 
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-800 border-emerald-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Closing Balance</p>
                <p className="text-3xl font-bold">{formatCurrency(calculateClosingBalance)} g</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  Balance at end of period
                </p>
              </div>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="relative mb-6 rounded-3xl border-2 border-red-300 bg-white/80 p-6 shadow-2xl backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-gradient-to-br from-red-200 to-red-400 opacity-20 translate-x-12 -translate-y-12"></div>

            <div className="relative z-10 flex flex-col gap-6">
              {/* Date Filters */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-end">
                {/* From Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-red-700">From Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => handleDateRangeChange(e.target.value, dateRange.end)}
                    className="w-full min-w-0 box-border rounded-xl border-2 border-red-300 bg-white/80 px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  />
                </div>

                {/* To Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-red-700">To Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateRangeChange(dateRange.start, e.target.value)}
                    className="w-full min-w-0 box-border rounded-xl border-2 border-red-300 bg-white/80 px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  />
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                  <label className="pointer-events-none block text-sm font-medium text-red-700 opacity-0">
                    Quick Actions
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={setCurrentMonth}
                      className="flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-800 border-2 border-red-400 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-red-700 hover:to-red-900 hover:shadow-xl"
                    >
                      Current Month
                    </button>

                    <button
                      onClick={setLastMonth}
                      className="flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-pink-500 to-pink-600 border-2 border-red-400 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-pink-600 hover:to-pink-700 hover:shadow-xl"
                    >
                      Last Month
                    </button>

                    <button
                      onClick={clearFilters}
                      className="flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-700 border-2 border-red-400 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-red-600 hover:to-red-800 hover:shadow-xl"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filters Summary */}
              <div className="flex flex-wrap gap-2">
                {dateRange.start ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-300">
                    From: {formatDate(dateRange.start)}
                    <button
                      onClick={() => handleDateRangeChange("", dateRange.end)}
                      className="ml-2 hover:text-red-900 text-lg"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                    From: Beginning
                  </span>
                )}
                {dateRange.end ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-pink-100 text-pink-800 border border-pink-300">
                    To: {formatDate(dateRange.end)}
                    <button
                      onClick={() => handleDateRangeChange(dateRange.start, "")}
                      className="ml-2 hover:text-pink-900 text-lg"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                    To: Present
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border-2 border-red-300">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-red-800">
                  Showing {filteredVouchers.length} of {allVouchers.length} transactions
                </h3>
                <p className="text-red-700">
                  {dateRange.start || dateRange.end 
                    ? `Filtered by date range ${dateRange.start ? `from ${formatDate(dateRange.start)}` : ''} ${dateRange.end ? `to ${formatDate(dateRange.end)}` : ''}`
                    : "Showing all transactions"}
                </p>
              </div>
              <div className="flex gap-6 mt-4 sm:mt-0">
                <div className="text-center">
                  <p className="text-sm text-red-700 font-medium">Gold Added</p>
                  <p className="text-xl font-bold text-green-700">+{formatCurrency(totalGoldAdded)} g</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-red-700 font-medium">Gold Removed</p>
                  <p className="text-xl font-bold text-red-700">-{formatCurrency(Math.abs(totalGoldRemoved))} g</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-red-700 font-medium">Net Change</p>
                  <p className={`text-xl font-bold ${netGoldChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {netGoldChange >= 0 ? '+' : ''}{formatCurrency(netGoldChange)} g
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Locker Ledger Table */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-red-300">
            <div className="px-6 py-4 border-b-2 border-red-300 bg-red-100">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-red-800">Locker Gold Transactions</h2>
                <span className="text-red-700 font-medium">
                  {filteredVouchers.filter(v => affectsLocker(v)).length} affect locker
                </span>
              </div>
            </div>

            {filteredVouchers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-lg font-medium text-red-800 mb-2">No transactions found</h3>
                <p className="text-red-600">
                  {dateRange.start || dateRange.end 
                    ? "No transactions match the selected date range" 
                    : "No locker-affecting transactions recorded"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Gold Amount (g)
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Locker Change
                      </th>
                      <th className="border border-red-300 px-4 py-3 text-center text-xs font-semibold text-red-800 uppercase tracking-wider">
                        Locker Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-300">
                    {/* Opening Balance Row */}
                    <tr className="bg-yellow-50">
                      <td className="border border-red-300 px-4 py-3 text-center text-sm text-gray-700">
                        {dateRange.start ? formatDate(dateRange.start) : "Beginning"}
                      </td>
                      <td colSpan={6} className="border border-red-300 px-4 py-3 text-center">
                        <span className="font-semibold text-gray-800">Opening Locker Balance</span>
                      </td>
                      <td className="border border-red-300 px-4 py-3 text-center font-mono font-semibold text-gray-800">
                        {formatCurrency(calculateOpeningBalance)} g
                      </td>
                    </tr>

                    {filteredVouchers.map((v, index) => (
                      <tr 
                        key={v.id} 
                        className={`transition-colors duration-150 ${
                          !affectsLocker(v) ? 'bg-gray-50 opacity-75' : 'bg-white hover:bg-red-50/50'
                        }`}
                      >
                        <td className="border border-red-300 px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                          {formatDate(v.date)}
                        </td>
                        <td className="border border-red-300 px-4 py-3 text-center">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{v.account.name}</span>
                            <span className="text-xs text-gray-600">#{v.account.accountNo}</span>
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full mt-1 ${getAccountTypeStyle(v.account.type)}`}>
                              {v.account.type}
                            </span>
                          </div>
                        </td>
                        <td className="border border-red-300 px-4 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getVoucherTypeStyle(v)}`}>
                            {getVoucherTypeText(v.vt)}
                          </span>
                        </td>
                        <td className="border border-red-300 px-4 py-3 text-sm text-gray-700 max-w-xs truncate text-center">
                          {v.quantity ? `${v.quantity} - ${v.description || v.mvn || '-'}` : v.description || v.mvn || '-'}
                        </td>
                        <td className="border border-red-300 px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 font-mono">
                          {formatCurrency(v.gold)}
                        </td>
                        <td className="border border-red-300 px-4 py-3 whitespace-nowrap text-center">
                          {v.paymentMethod ? (
                            <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                              v.paymentMethod === 'cheque' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-green-100 text-green-800 border border-green-300'
                            }`}>
                              {v.paymentMethod}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="border border-red-300 px-4 py-3 whitespace-nowrap text-sm text-center font-mono">
                          <span className={`font-semibold ${v.lockerGoldChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {v.lockerGoldChange >= 0 ? '+' : ''}{formatCurrency(v.lockerGoldChange)}
                          </span>
                          {!affectsLocker(v) && (
                            <div className="text-xs text-gray-500 mt-1">No locker effect</div>
                          )}
                        </td>
                        <td className={`border border-red-300 px-4 py-3 whitespace-nowrap text-sm text-center font-mono font-semibold ${
                          v.lockerGoldBalance >= 0 ? "text-gray-800" : "text-red-700"
                        }`}>
                          {formatCurrency(v.lockerGoldBalance)} g
                        </td>
                      </tr>
                    ))}

                    {/* Closing Balance Row */}
                    <tr className="bg-emerald-50">
                      <td className="border border-red-300 px-4 py-3 text-center text-sm text-gray-700">
                        {dateRange.end ? formatDate(dateRange.end) : "Present"}
                      </td>
                      <td colSpan={6} className="border border-red-300 px-4 py-3 text-center">
                        <span className="font-semibold text-gray-800">Closing Locker Balance</span>
                      </td>
                      <td className="border border-red-300 px-4 py-3 text-center font-mono font-bold text-gray-800">
                        {formatCurrency(calculateClosingBalance)} g
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mt-8 border-2 border-red-300">
            <h3 className="text-2xl font-bold text-red-800 mb-6">Locker Gold Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-red-700 mb-4">Market Accounts</h4>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800 border border-red-300 mr-3 mt-1">
                      INV
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">Gold: Negative (-)</p>
                      <p className="text-sm text-gray-600">Gold removed from locker</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 border border-green-300 mr-3 mt-1">
                      REC (Cash)
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">Gold: Positive (+)</p>
                      <p className="text-sm text-gray-600">Gold added to locker</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-300 mr-3 mt-1">
                      REC (Cheque)
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">Gold: No effect</p>
                      <p className="text-sm text-gray-600">Not counted in locker</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-red-700 mb-4">Other Accounts</h4>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800 border border-red-300 mr-3 mt-1">
                      INV
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">Gold: Negative (-)</p>
                      <p className="text-sm text-gray-600">Gold removed from locker</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 border border-green-300 mr-3 mt-1">
                      REC
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">Gold: Positive (+)</p>
                      <p className="text-sm text-gray-600">Gold added to locker</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 mr-3 mt-1">
                      Gold Fixing REC
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">Gold: Positive (+)</p>
                      <p className="text-sm text-gray-600">Gold added to locker</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-300">
              <div className="flex items-center text-gray-700">
                <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">
                  <strong>Note:</strong> GFV vouchers are excluded from locker calculations. Transactions with no locker effect are shown in lighter color.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf || filteredVouchers.length === 0}
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-lg rounded-2xl hover:from-red-700 hover:to-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-red-400 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingPdf ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating PDF...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Locker PDF
                </>
              )}
            </button>

            <Link
              href="/vouchers/list"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-pink-600 to-pink-800 text-white font-bold text-lg rounded-2xl hover:from-pink-700 hover:to-pink-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-pink-400 transform hover:-translate-y-1"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Vouchers
            </Link>

            <Link
              href="/balance-sheet/Market"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg rounded-2xl hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 border-2 border-red-400 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Market Ledger
            </Link>
          </div>
        </div>
      </div>
      <footer className="text-center py-4 sm:py-6 bg-gradient-to-r from-red-800 to-red-900 text-white text-xs sm:text-sm border-t border-red-700 select-none mt-0">
        <p>© 2025 Bloudan Jewellery | All Rights Reserved</p>
      </footer>
    </>
  );
}