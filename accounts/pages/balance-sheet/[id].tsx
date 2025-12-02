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
  goldBalance?: number;
  kwdBalance?: number;
};

type AccountInfo = {
  id: string;
  name: string;
  type: string;
  phone?: string;
  crOrCivilIdNo?: string;
};

type Props = {
  account: AccountInfo;
  vouchers: Voucher[];
  startDate?: string;
  endDate?: string;
  openingGold: number;
  openingKwd: number;
};

// Helper function to get current month date range
const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

// Helper function to get date range for different periods
const getDateRangeForPeriod = (period: string) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'current-month':
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      break;
    case 'last-month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setMonth(end.getMonth());
      end.setDate(0);
      break;
    case '3-months':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6-months':
      start.setMonth(start.getMonth() - 6);
      break;
    default:
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const id = context.params?.id as string;
  const accountType = context.query.accountType as string;
  let startDateParam = context.query.startDate as string | undefined;
  let endDateParam = context.query.endDate as string | undefined;

  // If no dates provided, default to current month
  if (!startDateParam && !endDateParam) {
    const currentMonth = getCurrentMonthRange();
    startDateParam = currentMonth.start;
    endDateParam = currentMonth.end;
  }

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Fetch account with all fields
  const account = await prisma.account.findUnique({ 
    where: { id },
    select: {
      id: true,
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

  // Step 1: Opening Balance (vouchers before startDate)
  let openingGold = 0;
  let openingKwd = 0;

  if (startDate) {
    const previousVouchers = await prisma.voucher.findMany({
      where: {
        accountId: account.id,
        date: { lt: startDate },
      },
      orderBy: { date: "asc" },
    });

    previousVouchers.forEach((v) => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        openingGold += v.gold;
        openingKwd += v.kwd;
      } else if (v.vt === "REC") {
        openingGold -= v.gold;
        openingKwd -= v.kwd;
      } else if (v.vt === "GFV") {
        openingGold += v.gold;
        openingKwd -= v.kwd;
      }
    });
  }

  // Step 2: Fetch vouchers within date range
  const whereClause: any = { accountId: account.id };
  if (startDate && endDate) whereClause.date = { gte: startDate, lte: endDate };
  else if (startDate) whereClause.date = { gte: startDate };
  else if (endDate) whereClause.date = { lte: endDate };

  const vouchers = await prisma.voucher.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });

  // Step 3: Compute running balances
  let goldBalance = openingGold;
  let kwdBalance = openingKwd;
  const processed = vouchers.map((v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      goldBalance += v.gold;
      kwdBalance += v.kwd;
    } else if (v.vt === "REC") {
      goldBalance -= v.gold;
      kwdBalance -= v.kwd;
    } else if (v.vt === "GFV") {
      goldBalance += v.gold;
      kwdBalance -= v.kwd;
    }
    return { ...v, goldBalance, kwdBalance };
  });

  return {
    props: {
      account: {
        id: account.id,
        name: account.name,
        type: accountType,
        phone: account.phone || null,
        crOrCivilIdNo: account.crOrCivilIdNo || null,
      },
      vouchers: JSON.parse(JSON.stringify(processed)),
      startDate: startDateParam || null,
      endDate: endDateParam || null,
      openingGold,
      openingKwd,
    },
  };
};

export default function BalanceSheetPage({
  account,
  vouchers,
  startDate,
  endDate,
  openingGold,
  openingKwd,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(startDate || getCurrentMonthRange().start);
  const [end, setEnd] = useState(endDate || getCurrentMonthRange().end);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Sync local state with props when they change
  useEffect(() => {
    if (startDate !== undefined) {
      setStart(startDate || getCurrentMonthRange().start);
    }
    if (endDate !== undefined) {
      setEnd(endDate || getCurrentMonthRange().end);
    }
  }, [startDate, endDate]);

  // Calculate debit/credit for each voucher
  const ledgerData = useMemo(() => {
    let currentGoldBalance = openingGold;
    let currentKwdBalance = openingKwd;
    let totalGoldDebit = 0;
    let totalGoldCredit = 0;
    let totalKwdDebit = 0;
    let totalKwdCredit = 0;

    const entries = vouchers.map(voucher => {
      let goldDebit = 0;
      let goldCredit = 0;
      let kwdDebit = 0;
      let kwdCredit = 0;

      if (voucher.vt === 'INV' || voucher.vt === 'Alloy') {
        goldDebit = voucher.gold;
        kwdDebit = voucher.kwd;
        totalGoldDebit += voucher.gold;
        totalKwdDebit += voucher.kwd;
      } else if (voucher.vt === 'REC') {
        goldCredit = voucher.gold;
        kwdCredit = voucher.kwd;
        totalGoldCredit += voucher.gold;
        totalKwdCredit += voucher.kwd;
      } else if (voucher.vt === 'GFV') {
        goldDebit = voucher.gold;
        kwdCredit = voucher.kwd;
        totalGoldDebit += voucher.gold;
        totalKwdCredit += voucher.kwd;
      }

      // Update running balances
      if (voucher.vt === 'INV' || voucher.vt === 'Alloy' || voucher.vt === 'GFV') {
        currentGoldBalance += voucher.gold;
      } else if (voucher.vt === 'REC') {
        currentGoldBalance -= voucher.gold;
      }

      if (voucher.vt === 'INV' || voucher.vt === 'Alloy') {
        currentKwdBalance += voucher.kwd;
      } else if (voucher.vt === 'REC' || voucher.vt === 'GFV') {
        currentKwdBalance -= voucher.kwd;
      }

      return {
        ...voucher,
        goldDebit,
        goldCredit,
        kwdDebit,
        kwdCredit,
        currentGoldBalance: voucher.goldBalance || currentGoldBalance,
        currentKwdBalance: voucher.kwdBalance || currentKwdBalance,
      };
    });

    const closingGold = vouchers.length > 0 
      ? (vouchers[vouchers.length - 1].goldBalance || currentGoldBalance)
      : openingGold;
    const closingKwd = vouchers.length > 0 
      ? (vouchers[vouchers.length - 1].kwdBalance || currentKwdBalance)
      : openingKwd;

    return {
      entries,
      totals: {
        goldDebit: totalGoldDebit,
        goldCredit: totalGoldCredit,
        kwdDebit: totalKwdDebit,
        kwdCredit: totalKwdCredit,
        closingGold,
        closingKwd,
      }
    };
  }, [vouchers, openingGold, openingKwd]);

  const handleQuickFilter = async (period: string) => {
    setIsFiltering(true);
    const range = getDateRangeForPeriod(period);
    setStart(range.start);
    setEnd(range.end);
    
    const params = new URLSearchParams();
    params.append("startDate", range.start);
    params.append("endDate", range.end);
    params.append("accountType", account.type);
    
    await router.push(`/balance-sheet/${account.id}?${params.toString()}`);
    setIsFiltering(false);
  };

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true);
    
    try {
      const params = new URLSearchParams({
        id: account.id,
        accountType: account.type,
        ...(start && { startDate: start }),
        ...(end && { endDate: end }),
        _t: Date.now().toString(),
      });
      
      const pdfUrl = `/api/ledger/pdf?${params.toString()}`;
      window.open(pdfUrl, '_blank');
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setTimeout(() => setIsGeneratingPDF(false), 1000);
    }
  };

  const handleFilter = async () => {
    setIsFiltering(true);
    const params = new URLSearchParams();
    if (start) params.append("startDate", start);
    if (end) params.append("endDate", end);
    if (account.type) params.append("accountType", account.type);
    
    await router.push(`/balance-sheet/${account.id}?${params.toString()}`);
    setIsFiltering(false);
  };

  const handleReset = async () => {
    setIsFiltering(true);
    const currentMonth = getCurrentMonthRange();
    setStart(currentMonth.start);
    setEnd(currentMonth.end);
    
    await router.push(`/balance-sheet/${account.id}?accountType=${account.type}&startDate=${currentMonth.start}&endDate=${currentMonth.end}`);
    setIsFiltering(false);
  };

  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatBalance = (value: number) => {
    const absValue = Math.abs(value);
    const suffix = value >= 0 ? 'Cr' : 'Db';
    return `${formatCurrency(absValue)} ${suffix}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getVoucherTypeStyle = (vt: string) => {
    switch (vt) {
      case 'REC': return 'bg-red-100 text-red-800';
      case 'INV': return 'bg-green-100 text-green-800';
      case 'GFV': return 'bg-yellow-100 text-yellow-800';
      case 'Alloy': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVoucherTypeText = (vt: string) => {
    switch (vt) {
      case 'REC': return 'Receipt';
      case 'INV': return 'Invoice';
      case 'GFV': return 'Gold Form Voucher';
      case 'Alloy': return 'Alloy';
      default: return vt;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Ledger</h1>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-gray-600">
                <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                  {account.type}
                </span>
                <span className="text-lg font-semibold">{account.name}</span>
                {account.phone && (
                  <span className="text-sm text-gray-500">
                    📞 {account.phone}
                  </span>
                )}
                {account.crOrCivilIdNo && (
                  <span className="text-sm text-gray-500">
                    📄 {account.crOrCivilIdNo}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
              <Link 
                href="/vouchers/list" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Vouchers
              </Link>
              <Link 
                href="/accounts" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Accounts
              </Link>
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 transition-colors"
              >
                {isGeneratingPDF ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{vouchers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Gold Movement</p>
                <p className={`text-lg font-bold ${ledgerData.totals.goldDebit - ledgerData.totals.goldCredit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {ledgerData.totals.goldDebit - ledgerData.totals.goldCredit >= 0 ? '+' : ''}{formatCurrency(ledgerData.totals.goldDebit - ledgerData.totals.goldCredit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">KWD Movement</p>
                <p className={`text-lg font-bold ${ledgerData.totals.kwdDebit - ledgerData.totals.kwdCredit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {ledgerData.totals.kwdDebit - ledgerData.totals.kwdCredit >= 0 ? '+' : ''}{formatCurrency(ledgerData.totals.kwdDebit - ledgerData.totals.kwdCredit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Closing Balance</p>
                <p className="text-lg font-bold text-gray-900">
                  Gold: {formatBalance(ledgerData.totals.closingGold)}<br />
                  KWD: {formatBalance(ledgerData.totals.closingKwd)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Card with Quick Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Transactions</h2>
          
          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => handleQuickFilter('current-month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                start === getCurrentMonthRange().start ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Current Month
            </button>
            <button
              onClick={() => handleQuickFilter('last-month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                start === getDateRangeForPeriod('last-month').start ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => handleQuickFilter('3-months')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Last 3 Months
            </button>
            <button
              onClick={() => handleQuickFilter('6-months')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Last 6 Months
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                disabled={isFiltering}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center"
              >
                {isFiltering ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600">
                Showing {vouchers.length} transaction{vouchers.length !== 1 ? 's' : ''}
                {startDate && ` from ${formatDate(startDate)}`}
                {endDate && ` to ${formatDate(endDate)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Transaction Ledger</h2>
          </div>

          {vouchers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {startDate || endDate ? "Try adjusting your date filters" : "No transactions recorded for this account"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th colSpan={3} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-r-2 border-gray-300">
                      Gold
                    </th>
                    <th colSpan={3} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-r-2 border-gray-300">Balance</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(start || new Date().toISOString())}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">-</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        BAL
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">Opening Balance</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">-</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">-</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r-2 border-gray-300">
                      {formatBalance(openingGold)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">-</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">-</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatBalance(openingKwd)}
                    </td>
                  </tr>

                  {ledgerData.entries.map((entry, index) => (
                    <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.mvn || entry.id.substring(0, 8)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVoucherTypeStyle(entry.vt)}`}>
                          {getVoucherTypeText(entry.vt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                        <div className="truncate max-w-[200px]">{entry.description || entry.mvn || 'No description'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {entry.goldDebit > 0 ? formatCurrency(entry.goldDebit) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {entry.goldCredit > 0 ? formatCurrency(entry.goldCredit) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right border-r-2 border-gray-300">
                        {formatBalance(entry.currentGoldBalance)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {entry.kwdDebit > 0 ? formatCurrency(entry.kwdDebit) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {entry.kwdCredit > 0 ? formatCurrency(entry.kwdCredit) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {formatBalance(entry.currentKwdBalance)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance Row */}
                  <tr className="bg-green-50 font-bold">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(end || new Date().toISOString())}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">-</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        BAL
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">Closing Balance</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(ledgerData.totals.goldDebit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(ledgerData.totals.goldCredit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r-2 border-gray-300">
                      {formatBalance(ledgerData.totals.closingGold)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(ledgerData.totals.kwdDebit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(ledgerData.totals.kwdCredit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatBalance(ledgerData.totals.closingKwd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Account Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-90">Opening Balance</p>
                <p className="text-lg font-bold">Gold: {formatBalance(openingGold)}</p>
                <p className="text-lg font-bold">KWD: {formatBalance(openingKwd)}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Closing Balance</p>
                <p className="text-lg font-bold">Gold: {formatBalance(ledgerData.totals.closingGold)}</p>
                <p className="text-lg font-bold">KWD: {formatBalance(ledgerData.totals.closingKwd)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Period Activity</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Transactions:</span>
                <span className="font-semibold">{vouchers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date Range:</span>
                <span className="font-semibold">
                  {startDate ? formatDate(startDate) : 'Start'} - {endDate ? formatDate(endDate) : 'Present'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gold Debit Total:</span>
                <span className="font-semibold text-green-600">{formatCurrency(ledgerData.totals.goldDebit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gold Credit Total:</span>
                <span className="font-semibold text-red-600">{formatCurrency(ledgerData.totals.goldCredit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">KWD Debit Total:</span>
                <span className="font-semibold text-green-600">{formatCurrency(ledgerData.totals.kwdDebit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">KWD Credit Total:</span>
                <span className="font-semibold text-red-600">{formatCurrency(ledgerData.totals.kwdCredit)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}