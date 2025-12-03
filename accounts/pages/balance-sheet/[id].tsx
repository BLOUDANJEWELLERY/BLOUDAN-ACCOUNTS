// pages/balance-sheet/[id].tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

type Voucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "REC" | "INV" | "GFV" | "Alloy";
  accountId: string;
  gold: number;
  kwd: number;
  quantity?: number;
};

type AccountInfo = {
  id: string;
  accountNo: string;
  name: string;
  type: string;
  phone?: string;
  crOrCivilIdNo?: string;
};

type LedgerEntry = {
  date: string;
  voucherId: string;
  type: "INV" | "REC" | "GFV" | "Alloy" | "BAL";
  description: string;
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
  originalDate?: string;
};

// Helper function to format balance with Cr/Db
const formatBalance = (balance: number, type: 'gold' | 'kwd') => {
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  const unit = type === 'gold' ? 'g' : 'KWD';
  
  return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
};

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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const id = context.params?.id as string;
  const accountType = context.query.accountType as string;

  // Fetch account with all fields including accountNo
  const account = await prisma.account.findUnique({ 
    where: { id },
    select: {
      id: true,
      accountNo: true,
      name: true,
      type: true,
      phone: true,
      crOrCivilIdNo: true,
    }
  });
  
  if (!account) return { notFound: true };
  if (!accountType || account.type !== accountType) {
    return { notFound: true };
  }

  // Fetch ALL vouchers for the account (no date filtering)
  const vouchers = await prisma.voucher.findMany({
    where: { accountId: account.id },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      mvn: true,
      description: true,
      vt: true,
      accountId: true,
      gold: true,
      kwd: true,
      quantity: true,
    }
  });

  // Process vouchers into ledger entries with running balances
  let runningGoldBalance = 0;
  let runningKwdBalance = 0;
  
  const processedVouchers = vouchers.map((voucher) => {
    const entry: any = {
      id: voucher.id,
      date: voucher.date.toISOString(),
      originalDate: voucher.date.toISOString().split('T')[0],
      mvn: voucher.mvn,
      description: voucher.description,
      vt: voucher.vt,
      accountId: voucher.accountId,
      gold: voucher.gold,
      kwd: voucher.kwd,
      quantity: voucher.quantity || null,
    };

    // Calculate debit/credit based on voucher type
    if (voucher.vt === "INV" || voucher.vt === "Alloy") {
      runningGoldBalance += voucher.gold;
      runningKwdBalance += voucher.kwd;
      entry.goldDebit = voucher.gold;
      entry.goldCredit = 0;
      entry.kwdDebit = voucher.kwd;
      entry.kwdCredit = 0;
    } else if (voucher.vt === "REC") {
      runningGoldBalance -= voucher.gold;
      runningKwdBalance -= voucher.kwd;
      entry.goldDebit = 0;
      entry.goldCredit = voucher.gold;
      entry.kwdDebit = 0;
      entry.kwdCredit = voucher.kwd;
    } else if (voucher.vt === "GFV") {
      runningGoldBalance += voucher.gold;
      runningKwdBalance -= voucher.kwd;
      entry.goldDebit = voucher.gold;
      entry.goldCredit = 0;
      entry.kwdDebit = 0;
      entry.kwdCredit = voucher.kwd;
    }

    entry.goldBalance = runningGoldBalance;
    entry.kwdBalance = runningKwdBalance;

    return entry;
  });

  return {
    props: {
      account: {
        id: account.id,
        accountNo: account.accountNo,
        name: account.name,
        type: accountType,
        phone: account.phone || "",
        crOrCivilIdNo: account.crOrCivilIdNo || "",
      },
      vouchers: JSON.parse(JSON.stringify(processedVouchers)),
    },
  };
};

export default function BalanceSheetPage({
  account,
  vouchers,
}: {
  account: AccountInfo;
  vouchers: any[];
}) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const isProjectAccount = account.type === "Project";

  // Initialize with current month as default
  const [dateRange, setDateRange] = useState(() => {
    const range = getCurrentMonthRange();
    return {
      start: range.start,
      end: range.end,
      isCustom: false // Flag to track if user has set custom dates
    };
  });

  // Process all vouchers into ledger entries on mount
  const allLedgerEntries = useMemo(() => {
    if (vouchers.length === 0) return [];

    return vouchers.map(voucher => {
      const getVoucherDescription = () => {
        let description = voucher.description || "";
        
        // Add quantity to description if it exists
        if (voucher.quantity) {
          description = `${voucher.quantity} - ${description}`;
        }
        
        if (!description && voucher.mvn) {
          description = `Voucher ${voucher.mvn}`;
        } else if (!description) {
          description = `Transaction ${voucher.id.slice(0, 8)}`;
        }
        
        return description;
      };

      return {
        date: new Date(voucher.date).toLocaleDateString(),
        originalDate: voucher.originalDate,
        voucherId: voucher.id,
        type: voucher.vt,
        description: getVoucherDescription(),
        goldDebit: voucher.goldDebit || 0,
        goldCredit: voucher.goldCredit || 0,
        goldBalance: voucher.goldBalance,
        kwdDebit: voucher.kwdDebit || 0,
        kwdCredit: voucher.kwdCredit || 0,
        kwdBalance: voucher.kwdBalance,
      };
    });
  }, [vouchers]);

  // Filter entries by date range - using useMemo for performance
  const filteredLedgerEntries = useMemo(() => {
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
  }, [allLedgerEntries, dateRange]);

  // Calculate opening balance (balance before the date range)
  const calculateOpeningBalance = useMemo(() => {
    if (!dateRange.start || allLedgerEntries.length === 0) {
      return { gold: 0, kwd: 0 };
    }

    const startDate = dateRange.start;
    let openingGoldBalance = 0;
    let openingKwdBalance = 0;

    // Find the last entry before the start date
    for (let i = 0; i < allLedgerEntries.length; i++) {
      const entryDate = allLedgerEntries[i].originalDate;
      if (entryDate < startDate) {
        openingGoldBalance = allLedgerEntries[i].goldBalance;
        openingKwdBalance = allLedgerEntries[i].kwdBalance;
      } else {
        break; // Stop when we reach the start date
      }
    }

    return { gold: openingGoldBalance, kwd: openingKwdBalance };
  }, [allLedgerEntries, dateRange.start]);

  // Calculate closing balance
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
  const totals = useMemo(() => {
    const totalGoldDebit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.goldDebit, 0);
    const totalGoldCredit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.goldCredit, 0);
    const totalKwdDebit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.kwdDebit, 0);
    const totalKwdCredit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.kwdCredit, 0);

    return {
      goldDebit: totalGoldDebit,
      goldCredit: totalGoldCredit,
      kwdDebit: totalKwdDebit,
      kwdCredit: totalKwdCredit,
    };
  }, [filteredLedgerEntries]);

  // Create opening balance entry
  const createOpeningBalanceEntry = (): LedgerEntry => ({
    date: dateRange.start || "Beginning",
    voucherId: "opening-balance",
    type: "BAL",
    description: "Opening Balance",
    goldDebit: 0,
    goldCredit: 0,
    goldBalance: calculateOpeningBalance.gold,
    kwdDebit: 0,
    kwdCredit: 0,
    kwdBalance: calculateOpeningBalance.kwd,
    isOpeningBalance: true,
  });

  // Create closing balance entry
  const createClosingBalanceEntry = (): LedgerEntry => ({
    date: dateRange.end || "Present",
    voucherId: "closing-balance",
    type: "BAL",
    description: "Closing Balance",
    goldDebit: 0,
    goldCredit: 0,
    goldBalance: calculateClosingBalance.gold,
    kwdDebit: 0,
    kwdCredit: 0,
    kwdBalance: calculateClosingBalance.kwd,
    isClosingBalance: true,
  });

  // Add opening and closing balance rows
  const entriesWithBalances: LedgerEntry[] = [
    ...(dateRange.start || (!dateRange.start && !dateRange.end) ? [createOpeningBalanceEntry()] : []),
    ...filteredLedgerEntries,
    ...(dateRange.end || (!dateRange.start && !dateRange.end) ? [createClosingBalanceEntry()] : [])
  ];

  // Get current overall balances (from all transactions)
  const currentGoldBalance = allLedgerEntries.length > 0 
    ? allLedgerEntries[allLedgerEntries.length - 1].goldBalance 
    : 0;
  const currentKwdBalance = allLedgerEntries.length > 0 
    ? allLedgerEntries[allLedgerEntries.length - 1].kwdBalance 
    : 0;

  // Get Voucher Type Text
  const getVoucherTypeText = (vt: string) => {
    switch (vt) {
      case 'REC': return 'Receipt';
      case 'INV': return 'Invoice';
      case 'GFV': return 'Gold Form Voucher';
      case 'Alloy': return 'Alloy';
      default: return vt;
    }
  };

  // Get Voucher Type Style
  const getVoucherTypeStyle = (vt: string) => {
    switch (vt) {
      case 'REC': return "bg-red-100 text-red-800 border border-red-300";
      case 'INV': return "bg-green-100 text-green-800 border border-green-300";
      case 'GFV': return "bg-yellow-100 text-yellow-800 border border-yellow-300";
      case 'Alloy': return "bg-purple-100 text-purple-800 border border-purple-300";
      default: return "bg-gray-100 text-gray-800 border border-gray-300";
    }
  };

  // Date range handlers
  const clearFilters = () => {
    setDateRange({ start: "", end: "", isCustom: true });
  };

  const setCurrentMonth = () => {
    const range = getCurrentMonthRange();
    setDateRange({ start: range.start, end: range.end, isCustom: false });
  };

  const setLastMonth = () => {
    const range = getLastMonthRange();
    setDateRange({ start: range.start, end: range.end, isCustom: false });
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [type]: value,
      isCustom: true
    }));
  };

  const downloadPdf = async () => {
    try {
      if (!account) {
        alert("Account information is not available");
        return;
      }

      setDownloadingPdf(true);

      const pdfData = {
        account: account,
        dateRange,
        ledgerEntries: entriesWithBalances,
        openingBalance: calculateOpeningBalance,
        closingBalance: calculateClosingBalance,
        totals,
        isProjectAccount,
      };

      const response = await fetch("/api/generate-ledger-pdf", {
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

      const fileName = `ledger-${account.accountNo}-${account.name}-${dateRange.start || "all"}-to-${
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
          title: "Ledger PDF",
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
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-blue-300 transform hover:scale-105 transition-transform duration-300">
                <svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4 tracking-tight">
              Account Ledger
            </h1>
            <p className="text-xl text-blue-700 font-light">Account No: {account.accountNo}</p>
          </div>

          {/* Account Info Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-blue-400 rounded-full -translate-x-16 -translate-y-16 opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-200 to-indigo-400 rounded-full translate-x-24 translate-y-24 opacity-20"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
              <div>
                <h3 className="text-sm font-medium text-blue-700 mb-1">Account No</h3>
                <p className="text-lg font-semibold text-blue-800 font-mono">{account.accountNo}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-700 mb-1">Account Name</h3>
                <p className="text-lg font-semibold text-blue-900">{account.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-700 mb-1">Account Type</h3>
                <p className="text-lg font-semibold text-blue-800">{account.type}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-700 mb-1">Phone</h3>
                <p className="text-lg font-semibold text-blue-900">{account.phone || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-700 mb-1">CR/ID No</h3>
                <p className="text-lg font-semibold text-blue-900">{account.crOrCivilIdNo || "N/A"}</p>
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
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="w-full min-w-0 box-border rounded-xl border-2 border-blue-300 bg-white/80 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* To Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blue-700">To Date</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateChange('end', e.target.value)}
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
                      className={`flex-1 min-w-[120px] rounded-xl px-4 py-3 text-sm font-semibold border-2 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                        !dateRange.isCustom ? 'text-white bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400' : 'text-blue-700 bg-white border-blue-300 hover:bg-blue-50'
                      }`}
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
                      Show All
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filters Summary */}
              <div className="flex flex-wrap gap-2">
                {dateRange.start ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-300">
                    From: {new Date(dateRange.start).toLocaleDateString()}
                    <button
                      onClick={() => handleDateChange('start', '')}
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
                    To: {new Date(dateRange.end).toLocaleDateString()}
                    <button
                      onClick={() => handleDateChange('end', '')}
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
                {filteredLedgerEntries.length !== allLedgerEntries.length && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                    Filtered: {filteredLedgerEntries.length} of {allLedgerEntries.length} transactions
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Combined Balance Summary Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 border-2 border-blue-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-blue-400 rounded-full -translate-x-16 -translate-y-16 opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-200 to-indigo-400 rounded-full translate-x-24 translate-y-24 opacity-20"></div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-blue-800">Current Balance Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                currentGoldBalance >= 0 
                  ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Gold Balance</p>
                <p className="text-3xl font-bold">{formatBalance(currentGoldBalance, 'gold')}</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  {currentGoldBalance >= 0 ? "Account Owes Gold" : "You Owe Gold"}
                </p>
              </div>
              {!isProjectAccount && (
                <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                  currentKwdBalance >= 0 
                    ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                    : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
                } transform hover:-translate-y-1 transition-transform duration-300`}>
                  <p className="text-lg font-semibold mb-2">Amount Balance</p>
                  <p className="text-3xl font-bold">{formatBalance(currentKwdBalance, 'kwd')}</p>
                  <p className="text-sm mt-3 opacity-90 font-medium">
                    {currentKwdBalance >= 0 ? "Account Owes Amount" : "You Owe Amount"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border-2 border-blue-300">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-blue-800">
                  {filteredLedgerEntries.length} transaction(s)
                  {filteredLedgerEntries.length !== allLedgerEntries.length && 
                    ` (filtered from ${allLedgerEntries.length} total)`}
                </h3>
                <p className="text-blue-700">
                  {dateRange.start || dateRange.end 
                    ? `Showing transactions ${dateRange.start ? `from ${new Date(dateRange.start).toLocaleDateString()}` : ''} ${dateRange.end ? `to ${new Date(dateRange.end).toLocaleDateString()}` : ''}`
                    : "Showing all transactions"}
                </p>
              </div>
              <div className="flex gap-6 mt-4 sm:mt-0">
                <div className="text-center">
                  <p className="text-sm text-blue-700 font-medium">Period Gold Change</p>
                  <p className={`text-xl font-bold ${(calculateClosingBalance.gold - calculateOpeningBalance.gold) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatBalance(calculateClosingBalance.gold - calculateOpeningBalance.gold, 'gold')}
                  </p>
                </div>
                {!isProjectAccount && (
                  <div className="text-center">
                    <p className="text-sm text-blue-700 font-medium">Period Amount Change</p>
                    <p className={`text-xl font-bold ${(calculateClosingBalance.kwd - calculateOpeningBalance.kwd) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {formatBalance(calculateClosingBalance.kwd - calculateOpeningBalance.kwd, 'kwd')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ledger Table with Opening/Closing Balances */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-300">
            <div className="px-6 py-4 border-b-2 border-blue-300 bg-blue-100">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-blue-800">Transaction History</h2>
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
                    : "This account hasn't made any transactions"}
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
                        Type
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Gold Debit (g)
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Gold Credit (g)
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Gold Balance
                      </th>
                      {!isProjectAccount && (
                        <>
                          <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                            Amount Debit
                          </th>
                          <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                            Amount Credit
                          </th>
                          <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                            Amount Balance
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-300">
                    {entriesWithBalances.map((entry) => (
                      <tr 
                        key={entry.voucherId} 
                        className={`transition-colors duration-150 ${
                          entry.isOpeningBalance ? 'bg-blue-50' : 
                          entry.isClosingBalance ? 'bg-indigo-50' : 
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
                          {!entry.isOpeningBalance && !entry.isClosingBalance ? (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getVoucherTypeStyle(entry.type)}`}>
                              {getVoucherTypeText(entry.type)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-200 text-blue-900 border border-blue-400">
                              BAL
                            </span>
                          )}
                        </td>
                        <td className="border border-blue-300 px-4 py-3 text-sm text-blue-700 max-w-xs truncate text-center">
                          {entry.description}
                        </td>
                        {/* Gold Columns */}
                        <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                          {entry.goldDebit > 0 ? entry.goldDebit.toFixed(3) : "-"}
                        </td>
                        <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                          {entry.goldCredit > 0 ? entry.goldCredit.toFixed(3) : "-"}
                        </td>
                        <td className={`border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center font-mono font-semibold ${
                          entry.goldBalance >= 0 ? "text-blue-700" : "text-red-700"
                        }`}>
                          {formatBalance(entry.goldBalance, 'gold')}
                        </td>
                        {/* Amount Columns - Only show if not Project account */}
                        {!isProjectAccount && (
                          <>
                            <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                              {entry.kwdDebit > 0 ? entry.kwdDebit.toFixed(3) : "-"}
                            </td>
                            <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                              {entry.kwdCredit > 0 ? entry.kwdCredit.toFixed(3) : "-"}
                            </td>
                            <td className={`border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center font-mono font-semibold ${
                              entry.kwdBalance >= 0 ? "text-blue-700" : "text-red-700"
                            }`}>
                              {formatBalance(entry.kwdBalance, 'kwd')}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-100">
                    <tr>
                      <td colSpan={3} className="border border-blue-300 px-4 py-4 text-sm font-semibold text-blue-800 text-right">
                        Filtered Period Totals:
                      </td>
                      {/* Gold Totals */}
                      <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                        {totals.goldDebit.toFixed(3)}
                      </td>
                      <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                        {totals.goldCredit.toFixed(3)}
                      </td>
                      <td className={`border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center font-mono font-bold ${
                        calculateClosingBalance.gold >= 0 ? "text-blue-700" : "text-red-700"
                      }`}>
                        {formatBalance(calculateClosingBalance.gold, 'gold')}
                      </td>
                      {/* Amount Totals - Only show if not Project account */}
                      {!isProjectAccount && (
                        <>
                          <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                            {totals.kwdDebit.toFixed(3)}
                          </td>
                          <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                            {totals.kwdCredit.toFixed(3)}
                          </td>
                          <td className={`border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center font-mono font-bold ${
                            calculateClosingBalance.kwd >= 0 ? "text-blue-700" : "text-red-700"
                          }`}>
                            {formatBalance(calculateClosingBalance.kwd, 'kwd')}
                          </td>
                        </>
                      )}
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
              disabled={downloadingPdf || entriesWithBalances.length === 0 || !account}
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
                  Download PDF
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
              href="/accounts"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-2xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 border-2 border-blue-400 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              All Accounts
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