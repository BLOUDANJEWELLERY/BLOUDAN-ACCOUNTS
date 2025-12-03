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
  account: {
    id: string;
    name: string;
    accountNo: number;
    type: string;
  };
};

type AccountInfo = {
  id: string;
  name: string;
  accountNo: number;
  type: string;
};

type LedgerEntry = {
  date: string;
  voucherId: string;
  accountId: string;
  accountName: string;
  accountNo: number;
  type: "INV" | "REC" | "GFV" | "Alloy" | "BAL";
  description: string;
  quantity?: number;
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const type = context.params?.type as string;

  // Validate account type
  const validTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];
  if (!validTypes.includes(type)) {
    return { notFound: true };
  }

  // Fetch all active accounts of this type
  const accounts = await prisma.account.findMany({
    where: { 
      type,
      isActive: true,
    },
    select: { 
      id: true, 
      name: true, 
      accountNo: true,
      type: true,
    },
    orderBy: { accountNo: "asc" },
  });

  if (accounts.length === 0) {
    return {
      props: {
        accountType: type,
        allVouchers: [],
        accounts: [],
      },
    };
  }

  const accountIds = accounts.map(account => account.id);

  // Fetch ALL vouchers for these accounts (no date filtering)
  const allVouchers = await prisma.voucher.findMany({
    where: { 
      accountId: { in: accountIds }
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          accountNo: true,
          type: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Process vouchers with running balances for entire account type
  let goldBalance = 0;
  let kwdBalance = 0;
  
  const processedVouchers = allVouchers.map((voucher) => {
    let goldDebit = 0;
    let goldCredit = 0;
    let kwdDebit = 0;
    let kwdCredit = 0;

    if (voucher.vt === "INV" || voucher.vt === "Alloy") {
      goldBalance += voucher.gold;
      kwdBalance += voucher.kwd;
      goldDebit = voucher.gold;
      kwdDebit = voucher.kwd;
    } else if (voucher.vt === "REC") {
      goldBalance -= voucher.gold;
      kwdBalance -= voucher.kwd;
      goldCredit = voucher.gold;
      kwdCredit = voucher.kwd;
    } else if (voucher.vt === "GFV") {
      goldBalance += voucher.gold;
      kwdBalance -= voucher.kwd;
      goldDebit = voucher.gold;
      kwdCredit = voucher.kwd;
    }

    return { 
      ...voucher, 
      goldDebit,
      goldCredit,
      kwdDebit,
      kwdCredit,
      goldBalance, 
      kwdBalance 
    };
  });

  return {
    props: {
      accountType: type,
      allVouchers: JSON.parse(JSON.stringify(processedVouchers)),
      accounts: JSON.parse(JSON.stringify(accounts)),
    },
  };
};

export default function AccountTypeBalanceSheet({
  accountType,
  allVouchers,
  accounts,
}: {
  accountType: string;
  allVouchers: any[];
  accounts: AccountInfo[];
}) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const isProjectAccount = accountType === "Project";
  
  // Date range state - initialize with empty strings to show all transactions
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });

  // Process vouchers into ledger entries
  const allLedgerEntries = useMemo<LedgerEntry[]>(() => {
    if (allVouchers.length === 0) return [];

    return allVouchers.map(voucher => {
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
        voucherId: voucher.id,
        accountId: voucher.account.id,
        accountName: voucher.account.name,
        accountNo: voucher.account.accountNo,
        type: voucher.vt,
        description: getVoucherDescription(),
        quantity: voucher.quantity || undefined,
        goldDebit: voucher.goldDebit || 0,
        goldCredit: voucher.goldCredit || 0,
        goldBalance: voucher.goldBalance,
        kwdDebit: voucher.kwdDebit || 0,
        kwdCredit: voucher.kwdCredit || 0,
        kwdBalance: voucher.kwdBalance,
        originalDate: voucher.date
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

  // Handle date range change
  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setDateRange({ start: newStart, end: newEnd });
  };

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

  // Create opening balance entry
  const createOpeningBalanceEntry = (): LedgerEntry => ({
    date: dateRange.start || "Beginning",
    voucherId: "opening-balance",
    accountId: "all",
    accountName: `All ${accountType} Accounts`,
    accountNo: 0,
    type: "BAL",
    description: "Opening Balance",
    quantity: undefined,
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
    accountId: "all",
    accountName: `All ${accountType} Accounts`,
    accountNo: 0,
    type: "BAL",
    description: "Closing Balance",
    quantity: undefined,
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

  // Calculate totals for filtered results only
  const totalGoldDebit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.goldDebit, 0);
  const totalGoldCredit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.goldCredit, 0);
  const totalKwdDebit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.kwdDebit, 0);
  const totalKwdCredit = filteredLedgerEntries.reduce((sum, entry) => sum + entry.kwdCredit, 0);

  // Get current overall balances
  const currentGoldBalance = allLedgerEntries.length > 0 
    ? allLedgerEntries[allLedgerEntries.length - 1].goldBalance 
    : 0;
  const currentKwdBalance = allLedgerEntries.length > 0 
    ? allLedgerEntries[allLedgerEntries.length - 1].kwdBalance 
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

  // Helper function to format balance with Cr/Db
  const formatBalance = (balance: number, type: 'gold' | 'kwd') => {
    const absoluteValue = Math.abs(balance);
    const suffix = balance >= 0 ? 'Cr' : 'Db';
    const unit = type === 'gold' ? 'g' : 'KWD';
    
    return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
  };

  // Get Account Type Color
  const getAccountTypeColor = (type: string) => {
    const colors = {
      'Market': "bg-blue-600",
      'Casting': "bg-purple-600",
      'Faceting': "bg-amber-600",
      'Project': "bg-emerald-600",
      'Gold Fixing': "bg-yellow-600",
    };
    return colors[type as keyof typeof colors] || "bg-gray-600";
  };

  // Get Account Type Style
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
      if (!accountType) {
        alert("Account type information is not available");
        return;
      }

      setDownloadingPdf(true);

      const pdfData = {
        accountType,
        accounts,
        dateRange,
        ledgerEntries: entriesWithBalances,
        openingBalance: calculateOpeningBalance,
        closingBalance: calculateClosingBalance,
        totals: {
          goldDebit: totalGoldDebit,
          goldCredit: totalGoldCredit,
          kwdDebit: totalKwdDebit,
          kwdCredit: totalKwdCredit,
        },
        isProjectAccount,
      };

      const response = await fetch("/api/generate-full-ledger-pdf", {
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

      const fileName = `full-ledger-${accountType}-${dateRange.start || "all"}-to-${
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
          title: "Full Ledger PDF",
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

  // Calculate account summaries
  const accountSummaries = useMemo(() => {
    return accounts.map(account => {
      const accountVouchers = filteredLedgerEntries.filter(v => v.accountId === account.id);
      const goldTotal = accountVouchers.reduce((sum, v) => sum + v.goldDebit - v.goldCredit, 0);
      const kwdTotal = accountVouchers.reduce((sum, v) => sum + v.kwdDebit - v.kwdCredit, 0);
      
      return {
        ...account,
        goldTotal,
        kwdTotal,
        transactionCount: accountVouchers.length,
      };
    });
  }, [accounts, filteredLedgerEntries]);

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl blur-lg opacity-30 transform scale-110 -z-10"></div>
              <div className={`w-20 h-20 ${getAccountTypeColor(accountType)} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-blue-300 transform hover:scale-105 transition-transform duration-300`}>
                <svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4 tracking-tight">
              {accountType} Combined Ledger
            </h1>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <span className={`inline-flex px-6 py-3 rounded-full text-lg font-semibold ${getAccountTypeStyle(accountType)}`}>
                {accountType} Accounts
              </span>
              <p className="text-xl text-blue-700 font-light">
                {accounts.length} Account{accounts.length !== 1 ? 's' : ''} | {allLedgerEntries.length} Total Transactions
              </p>
            </div>
          </div>

          {/* Account Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-700">Total Accounts</p>
                  <p className="text-2xl font-bold text-blue-800">{accounts.length}</p>
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
                    {!isProjectAccount && formatBalance(currentKwdBalance, 'kwd')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
                    {formatBalance(calculateClosingBalance.gold - calculateOpeningBalance.gold, 'gold')}<br />
                    {!isProjectAccount && formatBalance(calculateClosingBalance.kwd - calculateOpeningBalance.kwd, 'kwd')}
                  </p>
                </div>
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
                <p className="text-lg font-semibold mb-2">Total Gold Balance</p>
                <p className="text-3xl font-bold">{formatBalance(currentGoldBalance, 'gold')}</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  {currentGoldBalance >= 0 ? "Accounts Owe Gold" : "You Owe Gold"}
                </p>
              </div>
              {!isProjectAccount && (
                <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                  currentKwdBalance >= 0 
                    ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                    : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
                } transform hover:-translate-y-1 transition-transform duration-300`}>
                  <p className="text-lg font-semibold mb-2">Total Amount Balance</p>
                  <p className="text-3xl font-bold">{formatBalance(currentKwdBalance, 'kwd')}</p>
                  <p className="text-sm mt-3 opacity-90 font-medium">
                    {currentKwdBalance >= 0 ? "Accounts Owe Amount" : "You Owe Amount"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Account Summary Section */}
          {accounts.length > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300">
              <h2 className="text-2xl font-bold text-blue-800 mb-6">Account Summaries</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accountSummaries.map((account) => (
                  <div key={account.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-300 hover:border-blue-400 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-blue-800">{account.name}</h3>
                        <p className="text-sm text-blue-600">#{account.accountNo}</p>
                      </div>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                        {account.transactionCount} txns
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-700">Gold Net:</span>
                        <span className={`text-sm font-semibold ${account.goldTotal >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                          {formatBalance(account.goldTotal, 'gold')}
                        </span>
                      </div>
                      {!isProjectAccount && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700">Amount Net:</span>
                          <span className={`text-sm font-semibold ${account.kwdTotal >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                            {formatBalance(account.kwdTotal, 'kwd')}
                          </span>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/balance-sheet/${account.id}?accountType=${accountType}`}
                      className="inline-block w-full mt-4 text-center text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 py-2 rounded-xl transition-colors"
                    >
                      View Individual Ledger →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                <h2 className="text-2xl font-bold text-blue-800">Combined Ledger Transactions</h2>
                <span className="text-blue-700 font-medium">
                  {filteredLedgerEntries.length} transaction(s) across {accounts.length} account(s)
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
                    : "No transactions recorded for this account type"}
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
                        Gold Debit (g)
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Gold Credit (g)
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Gold Balance
                      </th>
                      {/* Only show amount columns if not Project account */}
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
                          <div className="flex flex-col">
                            <span className="font-semibold text-blue-900">{entry.accountName}</span>
                            {entry.accountNo > 0 && (
                              <span className="text-xs text-blue-600">#{entry.accountNo}</span>
                            )}
                          </div>
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
                          {entry.quantity ? `${entry.quantity} - ${entry.description}` : entry.description}
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
                      <td colSpan={isProjectAccount ? 7 : 10} className="border border-blue-300 px-4 py-4 text-sm font-semibold text-blue-800 text-right">
                        Filtered Period Totals:
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="border border-blue-300 px-4 py-4 text-sm font-semibold text-blue-800 text-right">
                        Totals:
                      </td>
                      {/* Gold Totals */}
                      <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                        {totalGoldDebit.toFixed(3)}
                      </td>
                      <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                        {totalGoldCredit.toFixed(3)}
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
                            {totalKwdDebit.toFixed(3)}
                          </td>
                          <td className="border border-blue-300 px-4 py-4 whitespace-nowrap text-sm text-center text-blue-800 font-mono font-bold">
                            {totalKwdCredit.toFixed(3)}
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
                  Download Combined PDF
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