// pages/balance-sheet/open-balance.tsx:
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
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
};

type Props = {
  vouchers: OpenBalanceVoucher[];
  startDate?: string;
  endDate?: string;
  openingGold: number;
  openingKwd: number;
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
    if (v.vt === "REC" && v.goldRate) {
      // Market REC with Gold Fixing: Gold positive, Fixing Amount positive
      goldBalance += v.gold;
      kwdBalance += v.fixingAmount || 0;
    } else if (v.vt === "GFV") {
      // GFV: Gold negative, KWD negative
      goldBalance -= v.gold;
      kwdBalance -= v.kwd;
    }
    
    return { 
      ...v, 
      goldBalance, 
      kwdBalance 
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
  const [start, setStart] = useState(startDate || "");
  const [end, setEnd] = useState(endDate || "");
  const [isFiltering, setIsFiltering] = useState(false);

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

  // Calculate totals
  const totalGold = vouchers.length > 0 ? vouchers[vouchers.length - 1].goldBalance : openingGold;
  const totalKwd = vouchers.length > 0 ? vouchers[vouchers.length - 1].kwdBalance : openingKwd;

  // Calculate period totals
  const periodGold = vouchers.reduce((sum, v) => {
    if (v.vt === "REC" && v.goldRate) {
      return sum + v.gold;
    } else if (v.vt === "GFV") {
      return sum - v.gold;
    }
    return sum;
  }, 0);

  const periodKwd = vouchers.reduce((sum, v) => {
    if (v.vt === "REC" && v.goldRate) {
      return sum + (v.fixingAmount || 0);
    } else if (v.vt === "GFV") {
      return sum - v.kwd;
    }
    return sum;
  }, 0);

  // Helper function to get display amount with proper sign
  const getDisplayAmount = (voucher: OpenBalanceVoucher, field: 'gold' | 'kwd' | 'fixingAmount') => {
    if (voucher.vt === "REC" && voucher.goldRate) {
      // Market REC with Gold Fixing: Gold positive, Fixing Amount positive
      if (field === 'gold') return voucher.gold;
      if (field === 'fixingAmount') return voucher.fixingAmount || 0;
      if (field === 'kwd') return 0; // KWD not used for Market REC Gold Fixing
    } else if (voucher.vt === "GFV") {
      // GFV: Gold negative, KWD negative
      if (field === 'gold') return -voucher.gold;
      if (field === 'kwd') return -voucher.kwd;
      if (field === 'fixingAmount') return 0; // Fixing Amount not used for GFV
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

  // Get voucher type styling
  const getVoucherTypeStyle = (voucher: OpenBalanceVoucher) => {
    if (voucher.vt === "REC" && voucher.goldRate) {
      return "bg-yellow-100 text-yellow-800";
    } else if (voucher.vt === "GFV") {
      return "bg-purple-100 text-purple-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  // Get account type styling
  const getAccountTypeStyle = (type: string) => {
    const colors = {
      Market: 'bg-blue-100 text-blue-800',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Open Balance Ledger
              </h1>
              <div className="flex items-center space-x-3">
                <span className="inline-flex px-4 py-2 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                  Gold Fixing Transactions
                </span>
                <span className="text-lg text-gray-600">
                  Combined Ledger for Market REC (Gold Fixing) and GFV Vouchers
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
              <Link 
                href="../vouchers/list" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Vouchers
              </Link>
              <Link 
                href="/" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Opening Balance</p>
                <p className="text-lg font-bold text-gray-900">
                  Gold: {formatCurrency(openingGold)}<br />
                  KWD: {formatCurrency(openingKwd)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Net Change</p>
                <p className="text-lg font-bold text-gray-900">
                  Gold: {formatCurrency(periodGold)}<br />
                  KWD: {formatCurrency(periodKwd)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Closing Balance</p>
                <p className="text-lg font-bold text-gray-900">
                  Gold: {formatCurrency(totalGold)}<br />
                  KWD: {formatCurrency(totalKwd)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Transactions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                disabled={isFiltering}
                className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 disabled:bg-orange-400 transition-colors flex items-center justify-center"
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

        {/* Open Balance Ledger Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Open Balance Ledger
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Market REC (Gold Fixing) vouchers: Gold (+), Fixing Amount (+)
              <br />
              GFV vouchers: Gold (-), KWD (-)
            </p>
          </div>

          {vouchers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {startDate || endDate ? "Try adjusting your date filters" : "No Gold Fixing transactions recorded"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KWD Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={6}>
                      Opening Balance
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingKwd)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingGold)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingKwd)}
                    </td>
                  </tr>

                  {vouchers.map((v, index) => (
                    <tr key={v.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(v.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{v.account.name}</div>
                        <div className="text-xs text-gray-500">#{v.account.accountNo}</div>
                        <span className={`inline-flex px-1 py-0.5 text-xs rounded ${getAccountTypeStyle(v.account.type)}`}>
                          {v.account.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div>{v.mvn || v.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVoucherTypeStyle(v)}`}>
                          {getVoucherTypeLabel(v)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {v.goldRate ? formatCurrency(v.goldRate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(getDisplayAmount(v, 'gold'))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {v.vt === "REC" && v.goldRate 
                          ? formatCurrency(getDisplayAmount(v, 'fixingAmount'))
                          : formatCurrency(getDisplayAmount(v, 'kwd'))
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(v.goldBalance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(v.kwdBalance)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance Row */}
                  <tr className="bg-green-50 font-bold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={6}>
                      Closing Balance
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(periodKwd)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(totalGold)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(totalKwd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Open Balance Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-90">Opening Balance</p>
                <p className="text-lg font-bold">Gold: {formatCurrency(openingGold)}</p>
                <p className="text-lg font-bold">KWD: {formatCurrency(openingKwd)}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Closing Balance</p>
                <p className="text-lg font-bold">Gold: {formatCurrency(totalGold)}</p>
                <p className="text-lg font-bold">KWD: {formatCurrency(totalKwd)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Market REC (Gold Fixing):</span>
                <span className="font-semibold">
                  {vouchers.filter(v => v.vt === "REC" && v.goldRate).length} transactions
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">GFV Vouchers:</span>
                <span className="font-semibold">
                  {vouchers.filter(v => v.vt === "GFV").length} transactions
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">Net Change Gold:</span>
                  <span className={`font-semibold ${periodGold >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodGold >= 0 ? '+' : ''}{formatCurrency(periodGold)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Net Change KWD:</span>
                  <span className={`font-semibold ${periodKwd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodKwd >= 0 ? '+' : ''}{formatCurrency(periodKwd)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center mb-2">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 mr-2">
                  REC (Gold Fixing)
                </span>
                <span className="text-gray-600">Market REC with Gold Rate</span>
              </div>
              <ul className="text-gray-600 text-xs space-y-1 ml-4">
                <li>• Gold: Positive (+)</li>
                <li>• Fixing Amount: Positive (+)</li>
                <li>• Gold Rate: Required</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center mb-2">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 mr-2">
                  GFV (Gold Fixing)
                </span>
                <span className="text-gray-600">Gold Fixing Vouchers</span>
              </div>
              <ul className="text-gray-600 text-xs space-y-1 ml-4">
                <li>• Gold: Negative (-)</li>
                <li>• KWD: Negative (-)</li>
                <li>• Gold Rate: May be present</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}