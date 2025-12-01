import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";

type Voucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "REC" | "INV" | "GFV" | "Alloy"; // Added "Alloy" to voucher types
  accountId: string;
  gold: number;
  kwd: number;
  goldBalance: number;
  kwdBalance: number;
  account: {
    name: string;
    accountNo: number;
  };
};

type Props = {
  accountType: string;
  vouchers: Voucher[];
  startDate?: string;
  endDate?: string;
  openingGold: number;
  openingKwd: number;
  accounts: Array<{
    id: string;
    name: string;
    accountNo: number;
  }>;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const type = context.params?.type as string;
  const startDateParam = context.query.startDate as string | undefined;
  const endDateParam = context.query.endDate as string | undefined;

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Validate account type - Added "Gold Fixing"
  const validTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];
  if (!validTypes.includes(type)) {
    return { notFound: true };
  }

  // Fetch all accounts of this type
  const accounts = await prisma.account.findMany({
    where: { type },
    select: { id: true, name: true, accountNo: true },
    orderBy: { accountNo: "asc" },
  });

  if (accounts.length === 0) {
    return {
      props: {
        accountType: type,
        vouchers: [],
        startDate: startDateParam || null,
        endDate: endDateParam || null,
        openingGold: 0,
        openingKwd: 0,
        accounts: [],
      },
    };
  }

  const accountIds = accounts.map(account => account.id);

  // Step 1: Calculate Opening Balance (vouchers before startDate)
  let openingGold = 0;
  let openingKwd = 0;

  if (startDate) {
    const previousVouchers = await prisma.voucher.findMany({
      where: {
        accountId: { in: accountIds },
        date: { lt: startDate },
      },
      include: {
        account: {
          select: {
            name: true,
            accountNo: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    previousVouchers.forEach((v) => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        // Treat Alloy same as INV (positive)
        openingGold += v.gold;
        openingKwd += v.kwd;
      } else if (v.vt === "REC") {
        openingGold -= v.gold;
        openingKwd -= v.kwd;
      } else if (v.vt === "GFV") {
        // GFV: Gold positive, KWD negative
        openingGold += v.gold;
        openingKwd -= v.kwd;
      }
    });
  }

  // Step 2: Fetch vouchers within date range
  const whereClause: any = { 
    accountId: { in: accountIds }
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
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Step 3: Compute running balances for the entire account type
  let goldBalance = openingGold;
  let kwdBalance = openingKwd;
  
  const processed = vouchers.map((v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      // Treat Alloy same as INV (positive)
      goldBalance += v.gold;
      kwdBalance += v.kwd;
    } else if (v.vt === "REC") {
      goldBalance -= v.gold;
      kwdBalance -= v.kwd;
    } else if (v.vt === "GFV") {
      // GFV: Gold positive, KWD negative
      goldBalance += v.gold;
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
      accountType: type,
      vouchers: JSON.parse(JSON.stringify(processed)),
      startDate: startDateParam || null,
      endDate: endDateParam || null,
      openingGold,
      openingKwd,
      accounts: JSON.parse(JSON.stringify(accounts)),
    },
  };
};

export default function AccountTypeBalanceSheet({
  accountType,
  vouchers,
  startDate,
  endDate,
  openingGold,
  openingKwd,
  accounts,
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
    
    await router.push(`/balance-sheet/type/${accountType}?${params.toString()}`);
    setIsFiltering(false);
  };

  const handleReset = async () => {
    setIsFiltering(true);
    await router.push(`/balance-sheet/type/${accountType}`);
    setIsFiltering(false);
  };

  // Calculate totals
  const totalGold = vouchers.length > 0 ? vouchers[vouchers.length - 1].goldBalance : openingGold;
  const totalKwd = vouchers.length > 0 ? vouchers[vouchers.length - 1].kwdBalance : openingKwd;

  // Calculate period totals with GFV and Alloy handling
  const periodGold = vouchers.reduce((sum, v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      return sum + v.gold;
    }
    if (v.vt === "REC") {
      return sum - v.gold;
    }
    if (v.vt === "GFV") {
      return sum + v.gold; // GFV: Gold positive
    }
    return sum;
  }, 0);

  const periodKwd = vouchers.reduce((sum, v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      return sum + v.kwd;
    }
    if (v.vt === "REC") {
      return sum - v.kwd;
    }
    if (v.vt === "GFV") {
      return sum - v.kwd; // GFV: KWD negative
    }
    return sum;
  }, 0);

  // Helper function to get display amount with proper sign for GFV and Alloy
  const getDisplayAmount = (voucher: Voucher, field: 'gold' | 'kwd') => {
    const value = voucher[field];
    if (voucher.vt === 'GFV') {
      // For GFV: Gold shows positive, KWD shows negative
      if (field === 'gold') return value;
      if (field === 'kwd') return -value;
    } else if (voucher.vt === 'Alloy') {
      // For Alloy: Both gold and KWD show positive (like INV)
      return value;
    } else {
      // For INV and REC: Normal display
      return value;
    }
    return value;
  };

  // Get display sign for amount (for showing + or -)
  const getDisplaySign = (voucher: Voucher, field: 'gold' | 'kwd') => {
    const amount = getDisplayAmount(voucher, field);
    return amount >= 0 ? '+' : '';
  };

  // Calculate totals by account with GFV and Alloy handling
  const accountTotals = accounts.map(account => {
    const accountVouchers = vouchers.filter(v => v.accountId === account.id);
    const goldTotal = accountVouchers.reduce((sum, v) => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        return sum + v.gold;
      }
      if (v.vt === "REC") {
        return sum - v.gold;
      }
      if (v.vt === "GFV") {
        return sum + v.gold; // GFV: Gold positive
      }
      return sum;
    }, 0);
    
    const kwdTotal = accountVouchers.reduce((sum, v) => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        return sum + v.kwd;
      }
      if (v.vt === "REC") {
        return sum - v.kwd;
      }
      if (v.vt === "GFV") {
        return sum - v.kwd; // GFV: KWD negative
      }
      return sum;
    }, 0);
    
    return {
      ...account,
      goldTotal,
      kwdTotal,
      transactionCount: accountVouchers.length,
    };
  });

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

  const getTypeColor = (type: string) => {
    const colors = {
      Market: 'bg-blue-100 text-blue-800',
      Casting: 'bg-purple-100 text-purple-800',
      Faceting: 'bg-amber-100 text-amber-800',
      Project: 'bg-green-100 text-green-800',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Helper function to get voucher type styling
  const getVoucherTypeStyle = (vt: string) => {
    if (vt === 'REC') return 'bg-green-100 text-green-800';
    if (vt === 'INV') return 'bg-blue-100 text-blue-800';
    if (vt === 'GFV') return 'bg-yellow-100 text-yellow-800';
    if (vt === 'Alloy') return 'bg-purple-100 text-purple-800'; // Added style for Alloy
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {accountType} Balance Sheet
              </h1>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${getTypeColor(accountType)}`}>
                  {accountType} Accounts
                </span>
                <span className="text-lg text-gray-600">
                  Combined Ledger for {accounts.length} Account{accounts.length !== 1 ? 's' : ''}
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
                href="/accounts" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Accounts
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
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
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        </div>

        {/* Account Summary */}
        {accounts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {accountType} Accounts Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accountTotals.map((account) => (
                <div key={account.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{account.name}</h3>
                    <span className="text-sm text-gray-500">#{account.accountNo}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Transactions:</span>
                      <span className="font-medium">{account.transactionCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Net Gold:</span>
                      <span className={`font-medium ${account.goldTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {account.goldTotal >= 0 ? '+' : ''}{formatCurrency(account.goldTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Net KWD:</span>
                      <span className={`font-medium ${account.kwdTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {account.kwdTotal >= 0 ? '+' : ''}{formatCurrency(account.kwdTotal)}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/balance-sheet/${account.id}?accountType=${accountType}`}
                    className="inline-block w-full mt-3 text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Individual Ledger →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                disabled={isFiltering}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center"
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

        {/* Combined Ledger Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Combined {accountType} Ledger
            </h2>
          </div>

          {vouchers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {startDate || endDate ? "Try adjusting your date filters" : "No transactions recorded for this account type"}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KWD</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KWD Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={4}>
                      Opening Balance (All {accountType} Accounts)
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingGold)}
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
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div>{v.mvn || v.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVoucherTypeStyle(v.vt)}`}>
                          {v.vt}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <span className={v.vt === 'REC' ? 'text-red-600' : 'text-green-600'}>
                          {getDisplaySign(v, 'gold')}{formatCurrency(getDisplayAmount(v, 'gold'))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <span className={
                          v.vt === 'GFV' || v.vt === 'REC' ? 'text-red-600' : 'text-green-600'
                        }>
                          {getDisplaySign(v, 'kwd')}{formatCurrency(getDisplayAmount(v, 'kwd'))}
                        </span>
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
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={4}>
                      Closing Balance (All {accountType} Accounts)
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(periodGold)}
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

        {/* Summary Footer */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">{accountType} Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-90">Opening Balance</p>
                <p className="text-xl font-bold">Gold: {formatCurrency(openingGold)}</p>
                <p className="text-xl font-bold">KWD: {formatCurrency(openingKwd)}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Closing Balance</p>
                <p className="text-xl font-bold">Gold: {formatCurrency(totalGold)}</p>
                <p className="text-xl font-bold">KWD: {formatCurrency(totalKwd)}</p>
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
                <span className="text-gray-600">Accounts Involved:</span>
                <span className="font-semibold">{accounts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date Range:</span>
                <span className="font-semibold">
                  {startDate ? formatDate(startDate) : 'Start'} - {endDate ? formatDate(endDate) : 'Present'}
                </span>
              </div>
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
    </main>
  );
}