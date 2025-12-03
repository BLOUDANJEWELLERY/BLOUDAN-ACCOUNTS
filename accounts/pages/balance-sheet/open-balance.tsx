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
  goldBalance: number;
  kwdBalance: number;
  goldDebit?: number;
  goldCredit?: number;
  kwdDebit?: number;
  kwdCredit?: number;
};

type Props = {
  vouchers: OpenBalanceVoucher[];
  startDate?: string;
  endDate?: string;
  openingGold: number;
  openingKwd: number;
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
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
  originalDate?: string;
  mvn?: string;
  fixingAmount?: number;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const startDateParam = context.query.startDate as string | undefined;
  const endDateParam = context.query.endDate as string | undefined;

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Step 1: Calculate Opening Balance (vouchers before startDate)
  let openingGold = 0;
  let openingKwd = 0;

  if (startDate) {
    // Get Market REC vouchers with goldRate (Gold Fixing) before start date
    const previousMarketRecVouchers = await prisma.voucher.findMany({
      where: {
        vt: "REC",
        account: { type: "Market" },
        goldRate: { not: null },
        date: { lt: startDate },
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

    // Get GFV vouchers before start date
    const previousGfvVouchers = await prisma.voucher.findMany({
      where: {
        vt: "GFV",
        date: { lt: startDate },
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

    // Calculate opening balance
    previousMarketRecVouchers.forEach((v) => {
      // Market REC with goldRate: Gold positive, Fixing Amount positive
      openingGold += v.gold;
      openingKwd += v.fixingAmount || 0;
    });

    previousGfvVouchers.forEach((v) => {
      // GFV: Gold negative, KWD negative
      openingGold -= v.gold;
      openingKwd -= v.kwd;
    });
  }

  // Step 2: Fetch vouchers within date range for Open Balance
  const whereClause: any = {
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
  };
  
  if (startDate && endDate) {
    whereClause.date = { gte: startDate, lte: endDate };
  } else if (startDate) {
    whereClause.date = { gte: startDate };
  } else if (endDate) {
    whereClause.date = { lte: endDate };
  }

  const vouchers = await prisma.voucher.findMany({
    where: whereClause,
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

  // Step 3: Compute running balances for Open Balance
  let goldBalance = openingGold;
  let kwdBalance = openingKwd;
  
  const processedVouchers = vouchers.map((v) => {
    let goldDebit = 0;
    let goldCredit = 0;
    let kwdDebit = 0;
    let kwdCredit = 0;

    if (v.vt === "REC" && v.goldRate) {
      // Market REC with Gold Fixing: Gold positive, Fixing Amount positive
      goldBalance += v.gold;
      kwdBalance += v.fixingAmount || 0;
      goldDebit = v.gold;
      kwdDebit = v.fixingAmount || 0;
    } else if (v.vt === "GFV") {
      // GFV: Gold negative, KWD negative
      goldBalance -= v.gold;
      kwdBalance -= v.kwd;
      goldCredit = v.gold;
      kwdCredit = v.kwd;
    }
    
    return { 
      ...v, 
      goldBalance, 
      kwdBalance,
      goldDebit,
      goldCredit,
      kwdDebit,
      kwdCredit,
    };
  });

  return {
    props: {
      vouchers: JSON.parse(JSON.stringify(processedVouchers)),
      startDate: startDateParam || null,
      endDate: endDateParam || null,
      openingGold,
      openingKwd,
    },
  };
};

export default function OpenBalanceSheet({
  vouchers,
  startDate,
  endDate,
  openingGold,
  openingKwd,
}: Props) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [start, setStart] = useState(startDate || "");
  const [end, setEnd] = useState(endDate || "");
  const [isFiltering, setIsFiltering] = useState(false);

  // Process vouchers into ledger entries
  const allLedgerEntries = useMemo<LedgerEntry[]>(() => {
    if (vouchers.length === 0) return [];

    return vouchers.map(voucher => {
      const getVoucherDescription = () => {
        let description = voucher.description || "";
        
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
        accountName: voucher.account.name,
        accountNo: voucher.account.accountNo,
        accountType: voucher.account.type,
        type: voucher.vt,
        description: getVoucherDescription(),
        goldRate: voucher.goldRate || undefined,
        goldDebit: voucher.goldDebit || 0,
        goldCredit: voucher.goldCredit || 0,
        goldBalance: voucher.goldBalance,
        kwdDebit: voucher.kwdDebit || 0,
        kwdCredit: voucher.kwdCredit || 0,
        kwdBalance: voucher.kwdBalance,
        originalDate: voucher.date,
        mvn: voucher.mvn,
        fixingAmount: voucher.fixingAmount,
      };
    });
  }, [vouchers]);

  // Calculate closing balance
  const calculateClosingBalance = useMemo(() => {
    if (allLedgerEntries.length === 0) {
      return { gold: openingGold, kwd: openingKwd };
    }

    const lastEntry = allLedgerEntries[allLedgerEntries.length - 1];
    return { 
      gold: lastEntry.goldBalance, 
      kwd: lastEntry.kwdBalance 
    };
  }, [allLedgerEntries, openingGold, openingKwd]);

  // Create opening balance entry
  const createOpeningBalanceEntry = (): LedgerEntry => ({
    date: startDate || "Beginning",
    voucherId: "opening-balance",
    accountName: "Opening Balance",
    accountNo: 0,
    accountType: "BAL",
    type: "BAL",
    description: "Opening Balance",
    goldRate: undefined,
    goldDebit: 0,
    goldCredit: 0,
    goldBalance: openingGold,
    kwdDebit: 0,
    kwdCredit: 0,
    kwdBalance: openingKwd,
    isOpeningBalance: true,
  });

  // Create closing balance entry
  const createClosingBalanceEntry = (): LedgerEntry => ({
    date: endDate || "Present",
    voucherId: "closing-balance",
    accountName: "Closing Balance",
    accountNo: 0,
    accountType: "BAL",
    type: "BAL",
    description: "Closing Balance",
    goldRate: undefined,
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
    ...(startDate || (!startDate && !endDate) ? [createOpeningBalanceEntry()] : []),
    ...allLedgerEntries,
    ...(endDate || (!startDate && !endDate) ? [createClosingBalanceEntry()] : [])
  ];

  // Calculate totals for filtered results only
  const totalGoldDebit = allLedgerEntries.reduce((sum, entry) => sum + entry.goldDebit, 0);
  const totalGoldCredit = allLedgerEntries.reduce((sum, entry) => sum + entry.goldCredit, 0);
  const totalKwdDebit = allLedgerEntries.reduce((sum, entry) => sum + entry.kwdDebit, 0);
  const totalKwdCredit = allLedgerEntries.reduce((sum, entry) => sum + entry.kwdCredit, 0);

  // Calculate period totals
  const periodGold = allLedgerEntries.reduce((sum, v) => {
    if (v.type === "REC") {
      return sum + v.goldDebit;
    } else if (v.type === "GFV") {
      return sum - v.goldCredit;
    }
    return sum;
  }, 0);

  const periodKwd = allLedgerEntries.reduce((sum, v) => {
    if (v.type === "REC") {
      return sum + v.kwdDebit;
    } else if (v.type === "GFV") {
      return sum - v.kwdCredit;
    }
    return sum;
  }, 0);

  const handleFilter = async () => {
    setIsFiltering(true);
    const params = new URLSearchParams();
    if (start) params.append("startDate", start);
    if (end) params.append("endDate", end);
    
    await router.push(`/open-balance?${params.toString()}`);
    setIsFiltering(false);
  };

  const handleReset = async () => {
    setIsFiltering(true);
    await router.push(`/open-balance`);
    setIsFiltering(false);
  };

  // Helper function to get display amount with proper sign
  const getDisplayAmount = (voucher: OpenBalanceVoucher, field: 'gold' | 'kwd' | 'fixingAmount') => {
    if (voucher.vt === "REC" && voucher.goldRate) {
      // Market REC with Gold Fixing: Gold positive, Fixing Amount positive
      if (field === 'gold') return voucher.gold;
      if (field === 'fixingAmount') return voucher.fixingAmount || 0;
      if (field === 'kwd') return 0;
    } else if (voucher.vt === "GFV") {
      // GFV: Gold negative, KWD negative
      if (field === 'gold') return -voucher.gold;
      if (field === 'kwd') return -voucher.kwd;
      if (field === 'fixingAmount') return 0;
    }
    return 0;
  };

  // Get voucher type label
  const getVoucherTypeLabel = (voucher: OpenBalanceVoucher) => {
    if (voucher.vt === "REC" && voucher.goldRate) {
      return "REC (Gold Fixing)";
    } else if (voucher.vt === "GFV") {
      return "GFV (Gold Fixing)";
    }
    return voucher.vt;
  };

  // Get voucher type styling - Updated to match first page
  const getVoucherTypeStyle = (voucher: OpenBalanceVoucher) => {
    if (voucher.vt === "REC" && voucher.goldRate) {
      return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    } else if (voucher.vt === "GFV") {
      return "bg-blue-100 text-blue-800 border border-blue-300";
    }
    return "bg-gray-100 text-gray-800 border border-gray-300";
  };

  // Get account type styling - Updated to match first page
  const getAccountTypeStyle = (type: string) => {
    const colors = {
      Market: 'bg-blue-100 text-blue-800 border border-blue-300',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 border border-gray-300';
  };

  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to format balance with Cr/Db - Same as first page
  const formatBalance = (balance: number, type: 'gold' | 'kwd') => {
    const absoluteValue = Math.abs(balance);
    const suffix = balance >= 0 ? 'Cr' : 'Db';
    const unit = type === 'gold' ? 'g' : 'KWD';
    
    return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
  };

  // Get current month date range - Same as first page
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  // Get last month date range - Same as first page
  const getLastMonthRange = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return {
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0]
    };
  };

  const setCurrentMonth = () => {
    const range = getCurrentMonthRange();
    setStart(range.start);
    setEnd(range.end);
  };

  const setLastMonth = () => {
    const range = getLastMonthRange();
    setStart(range.start);
    setEnd(range.end);
  };

  const clearFilters = () => {
    setStart("");
    setEnd("");
  };

  const downloadPdf = async () => {
    try {
      if (!start && !end && entriesWithBalances.length === 0) {
        alert("No transactions available to generate PDF");
        return;
      }

      setDownloadingPdf(true);

      const pdfData = {
        startDate: start,
        endDate: end,
        ledgerEntries: entriesWithBalances,
        openingBalance: { gold: openingGold, kwd: openingKwd },
        closingBalance: calculateClosingBalance,
        totals: {
          goldDebit: totalGoldDebit,
          goldCredit: totalGoldCredit,
          kwdDebit: totalKwdDebit,
          kwdCredit: totalKwdCredit,
        },
        periodGold,
        periodKwd,
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

      const fileName = `open-balance-ledger-${start || "all"}-to-${end || "all"}.pdf`;

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
              <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-blue-300 transform hover:scale-105 transition-transform duration-300">
                <svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4 tracking-tight">
              Open Balance Ledger
            </h1>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <span className="inline-flex px-6 py-3 rounded-full text-lg font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                Gold Fixing Transactions
              </span>
              <p className="text-xl text-blue-700 font-light">
                Combined Ledger for Market REC (Gold Fixing) and GFV Vouchers
              </p>
            </div>
          </div>

          {/* Summary Cards - Blue theme */}
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
                  <p className="text-2xl font-bold text-blue-800">{allLedgerEntries.length}</p>
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
                  <p className="text-sm font-medium text-blue-700">Opening Balance</p>
                  <p className="text-lg font-bold text-blue-800">
                    {formatBalance(openingGold, 'gold')}<br />
                    {formatBalance(openingKwd, 'kwd')}
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
                  <p className="text-2xl font-bold text-blue-800">{allLedgerEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-blue-300">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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

          {/* Combined Balance Summary Card - Blue theme */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 border-2 border-blue-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-blue-400 rounded-full -translate-x-16 -translate-y-16 opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-200 to-indigo-400 rounded-full translate-x-24 translate-y-24 opacity-20"></div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-blue-800">Current Balance Summary</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                calculateClosingBalance.gold >= 0 
                  ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Total Gold Balance</p>
                <p className="text-3xl font-bold">{formatBalance(calculateClosingBalance.gold, 'gold')}</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  {calculateClosingBalance.gold >= 0 ? "Gold Credit Balance" : "Gold Debit Balance"}
                </p>
              </div>
              <div className={`rounded-2xl p-6 text-center shadow-lg border-2 ${
                calculateClosingBalance.kwd >= 0 
                  ? "bg-gradient-to-r from-blue-600 to-blue-800 border-blue-400 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-700 border-red-400 text-white"
              } transform hover:-translate-y-1 transition-transform duration-300`}>
                <p className="text-lg font-semibold mb-2">Total Amount Balance</p>
                <p className="text-3xl font-bold">{formatBalance(calculateClosingBalance.kwd, 'kwd')}</p>
                <p className="text-sm mt-3 opacity-90 font-medium">
                  {calculateClosingBalance.kwd >= 0 ? "Amount Credit Balance" : "Amount Debit Balance"}
                </p>
              </div>
            </div>
          </div>

          {/* Date Range Filters - Blue theme */}
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
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full min-w-0 box-border rounded-xl border-2 border-blue-300 bg-white/80 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* To Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blue-700">To Date</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
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

              {/* Filter Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleFilter}
                  disabled={isFiltering}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-900 disabled:from-blue-400 disabled:to-blue-600 transition-all duration-300 border-2 border-blue-400 shadow-lg hover:shadow-xl"
                >
                  {isFiltering ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Filtering...
                    </>
                  ) : (
                    "Apply Filter"
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Reset
                </button>
              </div>

              {/* Active Filters Summary */}
              <div className="flex flex-wrap gap-2">
                {start ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-300">
                    From: {formatDate(start)}
                    <button
                      onClick={() => setStart("")}
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
                {end ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                    To: {formatDate(end)}
                    <button
                      onClick={() => setEnd("")}
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

          {/* Results Summary - Blue theme */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border-2 border-blue-300">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-blue-800">
                  Showing {allLedgerEntries.length} transactions
                </h3>
                <p className="text-blue-700">
                  {start || end 
                    ? `Filtered by date range ${start ? `from ${formatDate(start)}` : ''} ${end ? `to ${formatDate(end)}` : ''}`
                    : "Showing all transactions"}
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

          {/* Ledger Table with Opening/Closing Balances - Blue theme */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-300">
            <div className="px-6 py-4 border-b-2 border-blue-300 bg-blue-100">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-blue-800">Open Balance Ledger</h2>
                <span className="text-blue-700 font-medium">
                  {allLedgerEntries.length} Gold Fixing transaction(s)
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
                  {start || end 
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
                        Details
                      </th>
                      <th className="border border-blue-300 px-4 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                        Type
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
                          entry.isOpeningBalance ? 'bg-blue-50' : 
                          entry.isClosingBalance ? 'bg-indigo-50' : 
                          'bg-white hover:bg-blue-50/50'
                        }`}
                      >
                        <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-blue-700 text-center">
                          {entry.isOpeningBalance || entry.isClosingBalance 
                            ? (entry.date === "Beginning" || entry.date === "Present" 
                                ? entry.date 
                                : formatDate(entry.date))
                            : formatDate(entry.date)
                          }
                        </td>
                        <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex flex-col">
                            <span className="font-semibold text-blue-900">{entry.accountName}</span>
                            {entry.accountNo > 0 && (
                              <span className="text-xs text-blue-600">#{entry.accountNo}</span>
                            )}
                            <span className={`inline-flex px-2 py-1 mt-1 text-xs font-semibold rounded-full ${getAccountTypeStyle(entry.accountType)}`}>
                              {entry.accountType}
                            </span>
                          </div>
                        </td>
                        <td className="border border-blue-300 px-4 py-3 text-sm text-blue-700 max-w-xs truncate text-center">
                          {entry.mvn ? `MVN: ${entry.mvn} - ${entry.description}` : entry.description}
                        </td>
                        <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-center">
                          {!entry.isOpeningBalance && !entry.isClosingBalance ? (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getVoucherTypeStyle({vt: entry.type as "REC" | "GFV", goldRate: entry.goldRate})}`}>
                              {entry.type === "REC" ? "REC (Gold Fixing)" : "GFV"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-200 text-blue-900 border border-blue-400">
                              BAL
                            </span>
                          )}
                        </td>
                        <td className="border border-blue-300 px-4 py-3 whitespace-nowrap text-sm text-center text-blue-700 font-mono">
                          {entry.goldRate ? formatCurrency(entry.goldRate) : "-"}
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
                        {/* Amount Columns */}
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
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-100">
                    <tr>
                      <td colSpan={5} className="border border-blue-300 px-4 py-4 text-sm font-semibold text-blue-800 text-right">
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
                      {/* Amount Totals */}
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
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Transaction Summary - Blue theme */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-800 rounded-3xl p-8 text-white shadow-2xl border-2 border-blue-400">
              <h3 className="text-xl font-bold mb-4">Open Balance Summary</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm opacity-90 mb-2">Opening Balance</p>
                  <p className="text-lg font-bold">{formatBalance(openingGold, 'gold')}</p>
                  <p className="text-lg font-bold">{formatBalance(openingKwd, 'kwd')}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90 mb-2">Closing Balance</p>
                  <p className="text-lg font-bold">{formatBalance(calculateClosingBalance.gold, 'gold')}</p>
                  <p className="text-lg font-bold">{formatBalance(calculateClosingBalance.kwd, 'kwd')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-2 border-blue-300">
              <h3 className="text-xl font-bold text-blue-800 mb-4">Transaction Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">Market REC (Gold Fixing):</span>
                  <span className="font-semibold text-blue-800">
                    {allLedgerEntries.filter(v => v.type === "REC").length} transactions
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">GFV Vouchers:</span>
                  <span className="font-semibold text-blue-800">
                    {allLedgerEntries.filter(v => v.type === "GFV").length} transactions
                  </span>
                </div>
                <div className="pt-4 border-t border-blue-300">
                  <div className="flex justify-between mb-2">
                    <span className="text-blue-700">Net Change Gold:</span>
                    <span className={`font-bold ${periodGold >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {formatBalance(periodGold, 'gold')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Net Change KWD:</span>
                    <span className={`font-bold ${periodKwd >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {formatBalance(periodKwd, 'kwd')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend - Blue theme */}
          <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-2 border-blue-300">
            <h3 className="text-xl font-bold text-blue-800 mb-4">Legend</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <div className="flex items-center mb-3">
                  <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 mr-3">
                    REC (Gold Fixing)
                  </span>
                  <span className="text-blue-700">Market REC with Gold Rate</span>
                </div>
                <ul className="text-blue-600 text-sm space-y-1 ml-4">
                  <li>• Gold: Positive (+)</li>
                  <li>• Fixing Amount: Positive (+)</li>
                  <li>• Gold Rate: Required</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center mb-3">
                  <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300 mr-3">
                    GFV (Gold Fixing)
                  </span>
                  <span className="text-blue-700">Gold Fixing Vouchers</span>
                </div>
                <ul className="text-blue-600 text-sm space-y-1 ml-4">
                  <li>• Gold: Negative (-)</li>
                  <li>• KWD: Negative (-)</li>
                  <li>• Gold Rate: May be present</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons - Blue theme */}
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