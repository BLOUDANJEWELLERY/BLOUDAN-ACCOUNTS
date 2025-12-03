// pages/balance-sheet/open-balance.tsx:
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

type OpenBalanceVoucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "REC" | "GFV";
  accountId: string;
  account: {
    name: string;
    accountNo: number;
    type: string;
  };
  gold: number;
  kwd: number;
  goldRate?: number;
  fixingAmount?: number;
};

type Props = {
  allVouchers: OpenBalanceVoucher[];
};

export const getServerSideProps: GetServerSideProps = async () => {
  // Fetch ALL vouchers for Open Balance without any date filtering
  const allVouchers = await prisma.voucher.findMany({
    where: {
      OR: [
        // Market REC vouchers with goldRate (Gold Fixing)
        {
          vt: "REC",
          account: { type: "Market" },
          goldRate: { not: null },
        },
        // GFV vouchers
        {
          vt: "GFV",
        },
      ],
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

  return {
    props: {
      allVouchers: JSON.parse(JSON.stringify(allVouchers)),
    },
  };
};

type LedgerEntry = {
  date: string;
  voucherId: string;
  accountName: string;
  accountNo: number;
  accountType: string;
  type: "REC" | "GFV" | "BAL";
  description: string;
  goldRate?: number;
  gold: number;
  amount: number;
  goldBalance: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
  originalDate?: string;
  goldDebit?: number;
  goldCredit?: number;
  kwdDebit?: number;
  kwdCredit?: number;
};

export default function OpenBalanceSheet({
  allVouchers,
}: Props) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Get current month range for default
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  // Date range state - initialize with current month
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });

  // Set default to current month on component mount
  useEffect(() => {
    const currentMonth = getCurrentMonthRange();
    setDateRange({
      start: currentMonth.start,
      end: currentMonth.end
    });
  }, []);

  // Process all vouchers into ledger entries with running balances
  const allLedgerEntries = useMemo<LedgerEntry[]>(() => {
    if (allVouchers.length === 0) return [];

    let goldBalance = 0;
    let kwdBalance = 0;
    
    return allVouchers.map((voucher) => {
      let goldDebit = 0;
      let goldCredit = 0;
      let kwdDebit = 0;
      let kwdCredit = 0;

      const getDescription = () => {
        let description = voucher.description || "";
        if (voucher.mvn) {
          description = description ? `${voucher.mvn} - ${description}` : `Voucher ${voucher.mvn}`;
        }
        if (!description) {
          description = `Transaction ${voucher.id.slice(0, 8)}`;
        }
        return description;
      };

      if (voucher.vt === "REC" && voucher.goldRate) {
        // Market REC with Gold Fixing: Gold positive, Fixing Amount positive
        goldBalance += voucher.gold;
        kwdBalance += voucher.fixingAmount || 0;
        goldDebit = voucher.gold;
        kwdDebit = voucher.fixingAmount || 0;
      } else if (voucher.vt === "GFV") {
        // GFV: Gold negative, KWD negative
        goldBalance -= voucher.gold;
        kwdBalance -= voucher.kwd;
        goldCredit = voucher.gold;
        kwdCredit = voucher.kwd;
      }

      return {
        date: new Date(voucher.date).toLocaleDateString(),
        voucherId: voucher.id,
        accountName: voucher.account.name,
        accountNo: voucher.account.accountNo,
        accountType: voucher.account.type,
        type: voucher.vt,
        description: getDescription(),
        goldRate: voucher.goldRate || undefined,
        gold: voucher.vt === "REC" ? voucher.gold : -voucher.gold,
        amount: voucher.vt === "REC" ? (voucher.fixingAmount || 0) : -voucher.kwd,
        goldBalance,
        kwdBalance,
        originalDate: voucher.date,
        goldDebit,
        goldCredit,
        kwdDebit,
        kwdCredit,
      };
    });
  }, [allVouchers]);

  // Filter entries by date range (client-side)
  const filteredLedgerEntries = useMemo(() => {
    if (allLedgerEntries.length === 0) return [];

    if (!dateRange.start && !dateRange.end) {
      return allLedgerEntries;
    }

    return allLedgerEntries.filter((entry) => {
      const entryDate = entry.originalDate || entry.date;
      const startDate = dateRange.start;
      const endDate = dateRange.end;
      
      return (!startDate || entryDate >= startDate) && 
             (!endDate || entryDate <= endDate);
    });
  }, [allLedgerEntries, dateRange.start, dateRange.end]);

  // Calculate opening balance for filtered period
  const calculateOpeningBalance = useMemo(() => {
    if (!dateRange.start || allLedgerEntries.length === 0) {
      return { gold: 0, kwd: 0 };
    }

    const startDate = dateRange.start;
    let openingGoldBalance = 0;
    let openingKwdBalance = 0;

    // Find the last entry before the start date
    for (let i = allLedgerEntries.length - 1; i >= 0; i--) {
      const entryDate = allLedgerEntries[i].originalDate || allLedgerEntries[i].date;
      if (entryDate < startDate) {
        openingGoldBalance = allLedgerEntries[i].goldBalance;
        openingKwdBalance = allLedgerEntries[i].kwdBalance;
        break;
      }
    }

    return { gold: openingGoldBalance, kwd: openingKwdBalance };
  }, [allLedgerEntries, dateRange.start]);

  // Calculate closing balance for filtered period
  const calculateClosingBalance = useMemo(() => {
    if (filteredLedgerEntries.length === 0) {
      return calculateOpeningBalance;
    }

    const lastEntry = filteredLedgerEntries[filteredLedgerEntries.length - 1];
    return { 
      gold: lastEntry.goldBalance, 
      kwd: lastEntry.kwdBalance 
    };
  }, [filteredLedgerEntries, calculateOpeningBalance]);

  // Calculate totals for filtered results
  const totalGoldDebit = filteredLedgerEntries.reduce((sum, entry) => sum + (entry.goldDebit || 0), 0);
  const totalGoldCredit = filteredLedgerEntries.reduce((sum, entry) => sum + (entry.goldCredit || 0), 0);
  const totalKwdDebit = filteredLedgerEntries.reduce((sum, entry) => sum + (entry.kwdDebit || 0), 0);
  const totalKwdCredit = filteredLedgerEntries.reduce((sum, entry) => sum + (entry.kwdCredit || 0), 0);

  // Create opening balance entry
  const createOpeningBalanceEntry = (): LedgerEntry => ({
    date: dateRange.start || "Beginning",
    voucherId: "opening-balance",
    accountName: "All Accounts",
    accountNo: 0,
    accountType: "All",
    type: "BAL",
    description: "Opening Balance",
    gold: 0,
    amount: 0,
    goldBalance: calculateOpeningBalance.gold,
    kwdBalance: calculateOpeningBalance.kwd,
    isOpeningBalance: true,
    originalDate: dateRange.start || undefined,
  });

  // Create closing balance entry
  const createClosingBalanceEntry = (): LedgerEntry => ({
    date: dateRange.end || "Present",
    voucherId: "closing-balance",
    accountName: "All Accounts",
    accountNo: 0,
    accountType: "All",
    type: "BAL",
    description: "Closing Balance",
    gold: 0,
    amount: 0,
    goldBalance: calculateClosingBalance.gold,
    kwdBalance: calculateClosingBalance.kwd,
    isClosingBalance: true,
    originalDate: dateRange.end || undefined,
  });

  // Add opening and closing balance rows
  const entriesWithBalances: LedgerEntry[] = [
    ...(dateRange.start || (!dateRange.start && !dateRange.end) ? [createOpeningBalanceEntry()] : []),
    ...filteredLedgerEntries,
    ...(dateRange.end || (!dateRange.start && !dateRange.end) ? [createClosingBalanceEntry()] : [])
  ];

  // Calculate period totals (net change)
  const periodGold = filteredLedgerEntries.reduce((sum, entry) => {
    if (entry.type === "REC") {
      return sum + (entry.goldDebit || 0);
    } else if (entry.type === "GFV") {
      return sum - (entry.goldCredit || 0);
    }
    return sum;
  }, 0);

  const periodKwd = filteredLedgerEntries.reduce((sum, entry) => {
    if (entry.type === "REC") {
      return sum + (entry.kwdDebit || 0);
    } else if (entry.type === "GFV") {
      return sum - (entry.kwdCredit || 0);
    }
    return sum;
  }, 0);

  // Get current overall balances
  const currentGoldBalance = allLedgerEntries.length > 0 
    ? allLedgerEntries[allLedgerEntries.length - 1].goldBalance 
    : 0;
  const currentKwdBalance = allLedgerEntries.length > 0 
    ? allLedgerEntries[allLedgerEntries.length - 1].kwdBalance 
    : 0;

  // Helper function to get voucher type label
  const getVoucherTypeLabel = (vt: string, goldRate?: number) => {
    if (vt === "REC" && goldRate) {
      return "REC (Gold Fixing)";
    } else if (vt === "GFV") {
      return "GFV (Gold Fixing)";
    } else if (vt === "BAL") {
      return "Balance";
    }
    return vt;
  };

  // Get voucher type styling
  const getVoucherTypeStyle = (vt: string, goldRate?: number) => {
    if (vt === "REC" && goldRate) {
      return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    } else if (vt === "GFV") {
      return "bg-purple-100 text-purple-800 border border-purple-300";
    } else if (vt === "BAL") {
      return "bg-blue-100 text-blue-800 border border-blue-300";
    }
    return "bg-gray-100 text-gray-800 border border-gray-300";
  };

  // Get account type styling
  const getAccountTypeStyle = (type: string) => {
    const styles = {
      'Market': "bg-blue-100 text-blue-800 border border-blue-300",
      'Gold Fixing': "bg-yellow-100 text-yellow-800 border border-yellow-300",
    };
    return styles[type as keyof typeof styles] || "bg-gray-100 text-gray-800 border border-gray-300";
  };

  const formatCurrency = (value: number) => {
    return value.toFixed(3);
  };

  const formatBalance = (balance: number, type: 'gold' | 'kwd') => {
    const absoluteValue = Math.abs(balance);
    const suffix = balance >= 0 ? 'Cr' : 'Db';
    const unit = type === 'gold' ? 'g' : 'KWD';
    
    return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  // Handle date range change
  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setDateRange({ start: newStart, end: newEnd });
  };

  const setCurrentMonth = () => {
    const range = getCurrentMonthRange();
    handleDateRangeChange(range.start, range.end);
  };

  const setLastMonth = () => {
    const range = getLastMonthRange();
    handleDateRangeChange(range.start, range.end);
  };

  const clearFilters = () => {
    handleDateRangeChange("", "");
  };

  const downloadPdf = async () => {
    try {
      setDownloadingPdf(true);

      const pdfData = {
        title: "Open Balance Ledger",
        subtitle: "Gold Fixing Transactions",
        startDate: dateRange.start,
        endDate: dateRange.end,
        ledgerEntries: entriesWithBalances,
        openingBalance: calculateOpeningBalance,
        closingBalance: calculateClosingBalance,
        totals: {
          periodGold,
          periodKwd,
          goldDebit: totalGoldDebit,
          goldCredit: totalGoldCredit,
          kwdDebit: totalKwdDebit,
          kwdCredit: totalKwdCredit,
        },
        voucherSummary: {
          marketRec: filteredLedgerEntries.filter(v => v.type === "REC").length,
          gfv: filteredLedgerEntries.filter(v => v.type === "GFV").length,
          total: filteredLedgerEntries.length
        }
      };

      const response = await fetch("/api/generate-open-balance-pdf", {
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

      const fileName = `open-balance-ledger-${dateRange.start || "all"}-to-${
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
          title: "Open Balance PDF",
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl blur-lg opacity-30 transform scale-110 -z-10"></div>
              <div className="w-20 h-20 bg-gradient-to-r from-yellow-600 to-yellow-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-yellow-300 transform hover:scale-105 transition-transform duration-300">
                <svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4 tracking-tight">
              Open Balance Ledger
            </h1>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <span className="inline-flex px-6 py-3 rounded-full text-lg font-semibold bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-2 border-yellow-300">
                Gold Fixing Transactions
              </span>
              <p className="text-xl text-blue-700 font-light">
                Combined Ledger for Market REC (Gold Fixing) and GFV Vouchers
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-700">Total Transactions</p>
                  <p className="text-2xl font-bold text-blue-800">{allVouchers.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-700">Current Balance</p>
                  <p className="text-lg font-bold text-blue-800">
                    {formatBalance(currentGoldBalance, 'gold')}<br />
                    {formatBalance(currentKwdBalance, 'kwd')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-700">Filtered Transactions</p>
                  <p className="text-2xl font-bold text-blue-800">{filteredLedgerEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-700">Net Change</p>
                  <p className="text-lg font-bold text-blue-800">
                    {formatBalance(periodGold, 'gold')}<br />
                    {formatBalance(periodKwd, 'kwd')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Summary Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 border-2 border-blue-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full -translate-x-16 -translate-y-16 opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-200 to-blue-400 rounded-full translate-x-24 translate-y-24 opacity-20"></div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-blue-800">Open Balance Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                calculateClosingBalance.gold >= calculateOpeningBalance.gold 
                  ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Total Gold Balance</p>
                <p className="text-3xl font-bold">{formatBalance(calculateClosingBalance.gold, 'gold')}</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  Net Change: {formatBalance(periodGold, 'gold')}
                </p>
              </div>
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                calculateClosingBalance.kwd >= calculateOpeningBalance.kwd 
                  ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Total Amount Balance</p>
                <p className="text-3xl font-bold">{formatBalance(calculateClosingBalance.kwd, 'kwd')}</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  Net Change: {formatBalance(periodKwd, 'kwd')}
                </p>
              </div>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="relative mb-6 rounded-3xl border-2 border-blue-300 bg-white/80 p-6 shadow-2xl backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-gradient-to-br from-blue-200 to-blue-400 opacity-20 translate-x-12 -translate-y-12"></div>

            <div className="relative z-10 flex flex-col gap-6">
              {/* Date Filters */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-end">
                {/* From Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blue-700">From Date</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => handleDateRangeChange(e.target.value, dateRange.end)}
                    className="w-full min-w-0 box-border rounded-xl border-2 border-blue-300 bg-white/80 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* To Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blue-700">To Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateRangeChange(dateRange.start, e.target.value)}
                    className="w-full min-w-0 box-border rounded-xl border-2 border-blue-300 bg-white/80 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                  <label className="pointer-events-none block text-sm font-medium text-blue-700 opacity-0">
                    Quick Actions
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={setCurrentMonth}
                      className="flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-800 border-2 border-blue-400 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-900 hover:shadow-xl"
                    >
                      Current Month
                    </button>

                    <button
                      onClick={setLastMonth}
                      className="flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-indigo-600 border-2 border-blue-400 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-indigo-600 hover:to-indigo-700 hover:shadow-xl"
                    >
                      Last Month
                    </button>

                    <button
                      onClick={clearFilters}
                      className="flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 border-2 border-blue-400 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-600 hover:to-blue-800 hover:shadow-xl"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filters Summary */}
              <div className="flex flex-wrap gap-2">
                {dateRange.start ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-300">
                    From: {formatDate(dateRange.start)}
                    <button
                      onClick={() => handleDateRangeChange("", dateRange.end)}
                      className="ml-2 hover:text-blue-900 text-lg"
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
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                    To: {formatDate(dateRange.end)}
                    <button
                      onClick={() => handleDateRangeChange(dateRange.start, "")}
                      className="ml-2 hover:text-indigo-900 text-lg"
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
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border-2 border-blue-300">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-blue-800">
                  Showing {filteredLedgerEntries.length} of {allLedgerEntries.length} transactions
                </h3>
                <p className="text-blue-700">
                  {dateRange.start || dateRange.end 
                    ? `Filtered by date range ${dateRange.start ? `from ${formatDate(dateRange.start)}` : ''} ${dateRange.end ? `to ${formatDate(dateRange.end)}` : ''}`
                    : "Showing all Gold Fixing transactions"}
                </p>
              </div>
              <div className="flex gap-6 mt-4 sm:mt-0">
                <div className="text-center">
                  <p className="text-sm text-blue-700 font-medium">Period Gold Change</p>
                  <p className={`text-xl font-bold ${periodGold >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatBalance(periodGold, 'gold')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-blue-700 font-medium">Period Amount Change</p>
                  <p className={`text-xl font-bold ${periodKwd >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatBalance(periodKwd, 'kwd')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border-2 border-blue-300">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">Transaction Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">Market REC (Gold Fixing):</span>
                  <span className="font-semibold text-blue-800">
                    {filteredLedgerEntries.filter(v => v.type === "REC").length} transactions
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">GFV Vouchers:</span>
                  <span className="font-semibold text-blue-800">
                    {filteredLedgerEntries.filter(v => v.type === "GFV").length} transactions
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-300">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Gold Debit:</span>
                    <span className="font-semibold text-blue-800">
                      {formatCurrency(totalGoldDebit)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Gold Credit:</span>
                    <span className="font-semibold text-blue-800">
                      {formatCurrency(totalGoldCredit)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Amount Debit:</span>
                    <span className="font-semibold text-blue-800">
                      {formatCurrency(totalKwdDebit)} KWD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Amount Credit:</span>
                    <span className="font-semibold text-blue-800">
                      {formatCurrency(totalKwdCredit)} KWD
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border-2 border-blue-300">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">Legend</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="flex items-center mb-2">
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 mr-3">
                      REC (Gold Fixing)
                    </span>
                    <span className="text-blue-700">Market REC with Gold Rate</span>
                  </div>
                  <ul className="text-blue-600 text-xs space-y-1 ml-4">
                    <li>• Gold: Positive (+)</li>
                    <li>• Fixing Amount: Positive (+)</li>
                    <li>• Gold Rate: Required</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center mb-2">
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-300 mr-3">
                      GFV (Gold Fixing)
                    </span>
                    <span className="text-blue-700">Gold Fixing Vouchers</span>
                  </div>
                  <ul className="text-blue-600 text-xs space-y-1 ml-4">
                    <li>• Gold: Negative (-)</li>
                    <li>• KWD: Negative (-)</li>
                    <li>• Gold Rate: May be present</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Open Balance Ledger Table */}
 {/* Open Balance Ledger Table */}
<div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-300 mb-8">
  <div className="px-6 py-4 border-b-2 border-blue-300 bg-blue-100">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-blue-800">Open Balance Ledger Transactions</h2>
      <span className="text-blue-700 font-medium">
        {filteredLedgerEntries.length} transaction(s)
      </span>
    </div>
  </div>

  {entriesWithBalances.length === 0 ? (
    <div className="text-center py-12">
      <svg className="w-16 h-16 text-blue-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 className="text-lg font-medium text-blue-800 mb-2">No transactions found</h3>
      <p className="text-blue-600">
        {dateRange.start || dateRange.end 
          ? "No transactions match the selected date range" 
          : "No Gold Fixing transactions recorded"}
      </p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead className="bg-blue-100">
          <tr>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Date
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Account
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Type
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Description
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Gold Rate
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Gold Debit (g)
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Gold Credit (g)
            </th>
            {/* Gold Balance moved here */}
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Gold Balance
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Amount Debit (KWD)
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Amount Credit (KWD)
            </th>
            <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Amount Balance
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-300">
          {entriesWithBalances.map((entry) => (
            <tr 
              key={entry.voucherId} 
              className={`transition-colors duration-150 ${
                entry.isOpeningBalance ? 'bg-yellow-50' : 
                entry.isClosingBalance ? 'bg-green-50' : 
                'bg-white hover:bg-blue-50/50'
              }`}
            >
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-blue-700 text-center">
                {entry.isOpeningBalance || entry.isClosingBalance 
                  ? (entry.date === "Beginning" || entry.date === "Present" 
                      ? entry.date 
                      : new Date(entry.date).toLocaleDateString())
                  : entry.date
                }
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-center">
                <div className="flex flex-col">
                  <span className="font-semibold text-blue-900">{entry.accountName}</span>
                  {entry.accountNo > 0 && (
                    <>
                      <span className="text-xs text-blue-600">#{entry.accountNo}</span>
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full mt-1 ${getAccountTypeStyle(entry.accountType)}`}>
                        {entry.accountType}
                      </span>
                    </>
                  )}
                </div>
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getVoucherTypeStyle(entry.type, entry.goldRate)}`}>
                  {getVoucherTypeLabel(entry.type, entry.goldRate)}
                </span>
              </td>
              <td className="border border-blue-300 px-4 py-3 text-sm text-blue-700 max-w-xs truncate text-center">
                {entry.description}
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                {entry.goldRate ? entry.goldRate.toFixed(3) : '-'}
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                {entry.goldDebit && entry.goldDebit > 0 ? formatCurrency(entry.goldDebit) : '-'}
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                {entry.goldCredit && entry.goldCredit > 0 ? formatCurrency(entry.goldCredit) : '-'}
              </td>
              {/* Gold Balance cell moved here */}
              <td className={`border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center font-mono font-semibold ${
                entry.goldBalance >= 0 ? "text-blue-700" : "text-red-700"
              }`}>
                {formatBalance(entry.goldBalance, 'gold')}
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                {entry.kwdDebit && entry.kwdDebit > 0 ? formatCurrency(entry.kwdDebit) : '-'}
              </td>
              <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                {entry.kwdCredit && entry.kwdCredit > 0 ? formatCurrency(entry.kwdCredit) : '-'}
              </td>
              <td className={`border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center font-mono font-semibold ${
                entry.kwdBalance >= 0 ? "text-blue-700" : "text-red-700"
              }`}>
                {formatBalance(entry.kwdBalance, 'kwd')}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-blue-100">
          <tr>
            <td colSpan={5} className="border border-blue-300 px-4 py-4 text-sm font-semibold text-blue-800 text-right">
              Totals:
            </td>
            {/* Gold Debit total */}
            <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
              {totalGoldDebit.toFixed(3)}
            </td>
            {/* Gold Credit total */}
            <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
              {totalGoldCredit.toFixed(3)}
            </td>
            {/* Gold Balance total - now in correct position */}
            <td className={`border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center font-mono font-bold ${
              calculateClosingBalance.gold >= 0 ? "text-blue-700" : "text-red-700"
            }`}>
              {formatBalance(calculateClosingBalance.gold, 'gold')}
            </td>
            {/* Amount Debit total */}
            <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
              {totalKwdDebit.toFixed(3)}
            </td>
            {/* Amount Credit total */}
            <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
              {totalKwdCredit.toFixed(3)}
            </td>
            {/* Amount Balance total */}
            <td className={`border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center font-mono font-bold ${
              calculateClosingBalance.kwd >= 0 ? "text-blue-700" : "text-red-700"
            }`}>
              {formatBalance(calculateClosingBalance.kwd, 'kwd')}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )}
</div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf || entriesWithBalances.length === 0}
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-blue-400 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  Download Open Balance PDF
                </>
              )}
            </button>

            <Link
              href="/vouchers/list"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-bold text-lg rounded-2xl hover:from-indigo-700 hover:to-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-indigo-400 transform hover:-translate-y-1"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Vouchers
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-2xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 border-2 border-blue-400 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
      <footer className="text-center py-4 sm:py-6 bg-gradient-to-r from-blue-800 to-blue-900 text-white text-xs sm:text-sm border-t border-blue-700 select-none mt-0">
        <p>© 2025 Bloudan Jewellery | All Rights Reserved</p>
      </footer>
    </>
  );
}