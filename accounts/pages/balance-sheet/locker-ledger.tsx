// pages/balance-sheet/locker-ledger.tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
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
};

type Props = {
  vouchers: LockerVoucher[];
  startDate?: string;
  endDate?: string;
  openingLockerGold: number;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const startDateParam = context.query.startDate as string | undefined;
  const endDateParam = context.query.endDate as string | undefined;

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Step 1: Calculate Opening Locker Gold (vouchers before startDate)
  let openingLockerGold = 0;

  if (startDate) {
    // Get all vouchers before start date for locker calculation
    const previousVouchers = await prisma.voucher.findMany({
      where: {
        date: { lt: startDate },
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

    // Calculate opening locker gold
    previousVouchers.forEach((v) => {
      const lockerChange = calculateLockerGoldChange(v);
      openingLockerGold += lockerChange;
    });
  }

  // Step 2: Fetch vouchers within date range for Locker Ledger
  const whereClause: any = {
    vt: { in: ["INV", "REC"] },
    // Exclude GFV vouchers
    NOT: { vt: "GFV" }
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

  // Step 3: Compute running balances for Locker Gold
  let lockerGoldBalance = openingLockerGold;
  
  const processedVouchers = vouchers.map((v) => {
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
      vouchers: JSON.parse(JSON.stringify(processedVouchers)),
      startDate: startDateParam || null,
      endDate: endDateParam || null,
      openingLockerGold,
    },
  };
};

export default function LockerLedger({
  vouchers,
  startDate,
  endDate,
  openingLockerGold,
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
    
    await router.push(`/balance-sheet/locker-ledger?${params.toString()}`);
    setIsFiltering(false);
  };

  const handleReset = async () => {
    setIsFiltering(true);
    await router.push(`/balance-sheet/locker-ledger`);
    setIsFiltering(false);
  };

  // Calculate totals
  const totalLockerGold = vouchers.length > 0 ? vouchers[vouchers.length - 1].lockerGoldBalance : openingLockerGold;

  // Calculate period totals
  const periodLockerGold = vouchers.reduce((sum, v) => sum + v.lockerGoldChange, 0);

  // Helper function to get display amount with proper sign and formatting
  const getDisplayAmount = (voucher: LockerVoucher) => {
    return voucher.lockerGoldChange;
  };

  // Get voucher type label
  const getVoucherTypeLabel = (voucher: LockerVoucher) => {
    return `${voucher.vt} (${voucher.account.type})`;
  };

  // Get voucher type styling
  const getVoucherTypeStyle = (voucher: LockerVoucher) => {
    if (voucher.vt === "REC") {
      if (voucher.account.type === "Market" && voucher.paymentMethod === "cheque") {
        return "bg-gray-100 text-gray-800";
      }
      return "bg-green-100 text-green-800";
    } else if (voucher.vt === "INV") {
      return "bg-red-100 text-red-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  // Get account type styling
  const getAccountTypeStyle = (type: string) => {
    const colors = {
      Market: 'bg-blue-100 text-blue-800',
      Casting: 'bg-purple-100 text-purple-800',
      Faceting: 'bg-amber-100 text-amber-800',
      Project: 'bg-green-100 text-green-800',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Check if voucher affects locker (has non-zero locker gold change)
  const affectsLocker = (voucher: LockerVoucher) => {
    return voucher.lockerGoldChange !== 0;
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
    <main className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Locker Gold Ledger
              </h1>
              <div className="flex items-center space-x-3">
                <span className="inline-flex px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  Physical Gold Transactions
                </span>
                <span className="text-lg text-gray-600">
                  Track physical gold movements in locker
                </span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(openingLockerGold)} Gold
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
                <p className={`text-2xl font-bold ${periodLockerGold >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodLockerGold >= 0 ? '+' : ''}{formatCurrency(periodLockerGold)} Gold
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Closing Balance Card */}
        <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Closing Locker Balance</p>
              <p className="text-3xl font-bold">
                {formatCurrency(totalLockerGold)} Gold
              </p>
              <p className="text-sm opacity-80 mt-1">
                Opening: {formatCurrency(openingLockerGold)} + Net Change: {periodLockerGold >= 0 ? '+' : ''}{formatCurrency(periodLockerGold)}
              </p>
            </div>
            <div className="p-3 bg-white bg-opacity-20 rounded-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                disabled={isFiltering}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center"
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

        {/* Locker Ledger Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Locker Gold Ledger
            </h2>
          </div>

          {vouchers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No locker transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {startDate || endDate ? "Try adjusting your date filters" : "No locker-affecting transactions recorded"}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Locker Change</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Locker Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={7}>
                      Opening Locker Balance
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingLockerGold)}
                    </td>
                  </tr>

                  {vouchers.map((v, index) => (
                    <tr 
                      key={v.id} 
                      className={`
                        ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        ${!affectsLocker(v) ? 'opacity-60' : ''}
                      `}
                    >
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
                        {formatCurrency(v.gold)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {v.paymentMethod ? (
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            v.paymentMethod === 'cheque' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {v.paymentMethod}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <span className={`font-semibold ${v.lockerGoldChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {v.lockerGoldChange >= 0 ? '+' : ''}{formatCurrency(v.lockerGoldChange)}
                        </span>
                        {!affectsLocker(v) && (
                          <div className="text-xs text-gray-500">No effect on locker</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(v.lockerGoldBalance)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance Row */}
                  <tr className="bg-green-50 font-bold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={7}>
                      Closing Locker Balance
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(totalLockerGold)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Locker Gold Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-90">Opening Balance</p>
                <p className="text-xl font-bold">{formatCurrency(openingLockerGold)} Gold</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Closing Balance</p>
                <p className="text-xl font-bold">{formatCurrency(totalLockerGold)} Gold</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white border-opacity-20">
              <div className="flex justify-between">
                <span className="text-sm opacity-90">Net Change:</span>
                <span className={`text-lg font-bold ${periodLockerGold >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {periodLockerGold >= 0 ? '+' : ''}{formatCurrency(periodLockerGold)} Gold
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Transactions affecting locker:</span>
                <span className="font-semibold">
                  {vouchers.filter(v => affectsLocker(v)).length} transactions
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Transactions with no locker effect:</span>
                <span className="font-semibold">
                  {vouchers.filter(v => !affectsLocker(v)).length} transactions
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Total Gold Added:</span>
                  <span className="font-semibold text-green-600">
                    +{formatCurrency(vouchers.reduce((sum, v) => sum + Math.max(0, v.lockerGoldChange), 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Gold Removed:</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(vouchers.reduce((sum, v) => sum + Math.min(0, v.lockerGoldChange), 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Locker Gold Rules</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Market Accounts</h4>
              <ul className="text-gray-600 space-y-1">
                <li className="flex items-center">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 mr-2">
                    INV
                  </span>
                  <span>Gold: Negative (-) - Gold removed from locker</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 mr-2">
                    REC (Cash)
                  </span>
                  <span>Gold: Positive (+) - Gold added to locker</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 mr-2">
                    REC (Cheque)
                  </span>
                  <span>Gold: No effect - Not counted in locker</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Other Accounts</h4>
              <ul className="text-gray-600 space-y-1">
                <li className="flex items-center">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 mr-2">
                    INV
                  </span>
                  <span>Gold: Negative (-) - Gold removed from locker</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 mr-2">
                    REC
                  </span>
                  <span>Gold: Positive (+) - Gold added to locker</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 mr-2">
                    Gold Fixing REC
                  </span>
                  <span>Gold: Positive (+) - Gold added to locker</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Note: GFV vouchers are excluded from locker calculations. Transactions with no locker effect are shown in lighter color.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}