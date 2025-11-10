import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type AccountTypeSummary = {
  type: string;
  totalAccounts: number;
  totalTransactions: number;
  goldBalance: number;
  kwdBalance: number;
};

type OpenBalanceSummary = {
  goldBalance: number;
  kwdBalance: number;
  totalTransactions: number;
  marketRecCount: number;
  gfvCount: number;
};

type Props = {
  typeSummaries: AccountTypeSummary[];
  openBalance: OpenBalanceSummary;
  overallGold: number;
  overallKwd: number;
  totalAccounts: number;
  totalTransactions: number;
  grandTotalGold: number;
  grandTotalKwd: number;
  error?: string;
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Define the account types we want to summarize - Added "Gold Fixing"
    const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

    // Get all accounts grouped by type
    const accountsByType = await prisma.account.findMany({
      where: {
        type: { in: accountTypes }
      },
      select: {
        id: true,
        type: true,
      },
    });

    // Get all vouchers
    const allVouchers = await prisma.voucher.findMany({
      select: {
        id: true,
        accountId: true,
        vt: true,
        gold: true,
        kwd: true,
        goldRate: true,
        fixingAmount: true,
        account: {
          select: {
            type: true,
          },
        },
      },
    });

    // Calculate balances for each account type with GFV handling
    const typeSummaries: AccountTypeSummary[] = accountTypes.map(type => {
      const typeAccountIds = accountsByType
        .filter(account => account.type === type)
        .map(account => account.id);

      const typeVouchers = allVouchers.filter(v => 
        typeAccountIds.includes(v.accountId)
      );

      let goldBalance = 0;
      let kwdBalance = 0;

      typeVouchers.forEach(voucher => {
        if (voucher.vt === "INV") {
          goldBalance += voucher.gold;
          kwdBalance += voucher.kwd;
        } else if (voucher.vt === "REC") {
          goldBalance -= voucher.gold;
          kwdBalance -= voucher.kwd;
        } else if (voucher.vt === "GFV") {
          // GFV: Gold positive, KWD negative
          goldBalance += voucher.gold;
          kwdBalance -= voucher.kwd;
        }
      });

      return {
        type,
        totalAccounts: typeAccountIds.length,
        totalTransactions: typeVouchers.length,
        goldBalance,
        kwdBalance,
      };
    });

    // Calculate Open Balance (Market REC with Gold Fixing + GFV vouchers)
    let openBalanceGold = 0;
    let openBalanceKwd = 0;
    let marketRecCount = 0;
    let gfvCount = 0;

    allVouchers.forEach(voucher => {
      // Market REC with Gold Fixing (goldRate exists)
      if (voucher.vt === "REC" && voucher.account.type === "Market" && voucher.goldRate) {
        openBalanceGold += voucher.gold; // Positive
        openBalanceKwd += voucher.fixingAmount || 0; // Positive
        marketRecCount++;
      }
      // GFV vouchers
      else if (voucher.vt === "GFV") {
        openBalanceGold -= voucher.gold; // Negative
        openBalanceKwd -= voucher.kwd; // Negative
        gfvCount++;
      }
    });

    const openBalance: OpenBalanceSummary = {
      goldBalance: openBalanceGold,
      kwdBalance: openBalanceKwd,
      totalTransactions: marketRecCount + gfvCount,
      marketRecCount,
      gfvCount,
    };

    // Calculate overall totals (account types only)
    const overallGold = typeSummaries.reduce((sum, summary) => sum + summary.goldBalance, 0);
    const overallKwd = typeSummaries.reduce((sum, summary) => sum + summary.kwdBalance, 0);
    const totalAccounts = typeSummaries.reduce((sum, summary) => sum + summary.totalAccounts, 0);
    const totalTransactions = typeSummaries.reduce((sum, summary) => sum + summary.totalTransactions, 0);

    // Calculate GRAND TOTALS (including Open Balance)
    const grandTotalGold = overallGold + openBalanceGold;
    const grandTotalKwd = overallKwd + openBalanceKwd;

    return {
      props: {
        typeSummaries,
        openBalance,
        overallGold,
        overallKwd,
        totalAccounts,
        totalTransactions,
        grandTotalGold,
        grandTotalKwd,
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        typeSummaries: [],
        openBalance: {
          goldBalance: 0,
          kwdBalance: 0,
          totalTransactions: 0,
          marketRecCount: 0,
          gfvCount: 0,
        },
        overallGold: 0,
        overallKwd: 0,
        totalAccounts: 0,
        totalTransactions: 0,
        grandTotalGold: 0,
        grandTotalKwd: 0,
        error: 'Failed to load account type summary data. Please check if you have accounts and vouchers in the database.'
      },
    };
  }
};

export default function TypeSummaryPage({
  typeSummaries,
  openBalance,
  overallGold,
  overallKwd,
  totalAccounts,
  totalTransactions,
  grandTotalGold,
  grandTotalKwd,
  error,
}: Props) {
  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const getTypeColor = (type: string) => {
    const colors = {
      Market: {
        bg: 'bg-blue-500',
        lightBg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        gradient: 'from-blue-500 to-blue-600',
      },
      Casting: {
        bg: 'bg-purple-500',
        lightBg: 'bg-purple-50',
        text: 'text-purple-800',
        border: 'border-purple-200',
        gradient: 'from-purple-500 to-purple-600',
      },
      Faceting: {
        bg: 'bg-amber-500',
        lightBg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        gradient: 'from-amber-500 to-amber-600',
      },
      Project: {
        bg: 'bg-green-500',
        lightBg: 'bg-green-50',
        text: 'text-green-800',
        border: 'border-green-200',
        gradient: 'from-green-500 to-green-600',
      },
      'Gold Fixing': {
        bg: 'bg-yellow-500',
        lightBg: 'bg-yellow-50',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        gradient: 'from-yellow-500 to-yellow-600',
      },
      'Open Balance': {
        bg: 'bg-orange-500',
        lightBg: 'bg-orange-50',
        text: 'text-orange-800',
        border: 'border-orange-200',
        gradient: 'from-orange-500 to-orange-600',
      },
    };
    return colors[type as keyof typeof colors] || {
      bg: 'bg-gray-500',
      lightBg: 'bg-gray-50',
      text: 'text-gray-800',
      border: 'border-gray-200',
      gradient: 'from-gray-500 to-gray-600',
    };
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Data</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/accounts" 
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Accounts
              </Link>
              <Link 
                href="/vouchers/create" 
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                Create Vouchers
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Account Type Summary
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Complete financial overview across all account types
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/accounts" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-lg font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Manage Accounts
            </Link>
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-lg font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View All Vouchers
            </Link>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{totalAccounts}</p>
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
                <p className="text-sm font-medium text-gray-600">Overall Gold Balance</p>
                <p className={`text-2xl font-bold ${getBalanceColor(overallGold)}`}>
                  {formatCurrency(overallGold)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overall KWD Balance</p>
                <p className={`text-2xl font-bold ${getBalanceColor(overallKwd)}`}>
                  {formatCurrency(overallKwd)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{totalTransactions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grand Total Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-white bg-opacity-20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium opacity-90">Grand Total Gold</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(grandTotalGold)}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  Account Types: {formatCurrency(overallGold)} + Open Balance: {formatCurrency(openBalance.goldBalance)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-white bg-opacity-20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium opacity-90">Grand Total KWD</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(grandTotalKwd)}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  Account Types: {formatCurrency(overallKwd)} + Open Balance: {formatCurrency(openBalance.kwdBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Check if we have data */}
        {typeSummaries.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Data Available</h2>
            <p className="text-gray-600 mb-6">No account type summary data found. You may need to create accounts and vouchers first.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/accounts" 
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Accounts
              </Link>
              <Link 
                href="/vouchers/create" 
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                Create Vouchers
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Account Type Summary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-8">
              {typeSummaries.map((summary) => {
                const typeColor = getTypeColor(summary.type);
                return (
                  <div key={summary.type} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className={`bg-gradient-to-r ${typeColor.gradient} px-6 py-4 text-white`}>
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">{summary.type} Accounts</h2>
                        <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                          {summary.totalAccounts} account{summary.totalAccounts !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getBalanceColor(summary.goldBalance)}`}>
                            {formatCurrency(summary.goldBalance)}
                          </div>
                          <div className="text-sm text-gray-600">Gold Balance</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${getBalanceColor(summary.kwdBalance)}`}>
                            {formatCurrency(summary.kwdBalance)}
                          </div>
                          <div className="text-sm text-gray-600">KWD Balance</div>
                        </div>
                      </div>

                      <div className="flex justify-between text-sm text-gray-600 mb-4">
                        <span>{summary.totalTransactions} transactions</span>
                        <span>Total Balance</span>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/accounts/balance/${summary.type}`}
                          className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors text-sm"
                        >
                          View Balances
                        </Link>
                        <Link
                          href={`/balance-sheet/type/${summary.type}`}
                          className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors text-sm"
                        >
                          View Ledger
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Open Balance Card */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-orange-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 text-white">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Open Balance</h2>
                    <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                      {openBalance.totalTransactions} transactions
                    </span>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getBalanceColor(openBalance.goldBalance)}`}>
                        {formatCurrency(openBalance.goldBalance)}
                      </div>
                      <div className="text-sm text-gray-600">Gold Balance</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getBalanceColor(openBalance.kwdBalance)}`}>
                        {formatCurrency(openBalance.kwdBalance)}
                      </div>
                      <div className="text-sm text-gray-600">KWD Balance</div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-3">
                    <div className="flex justify-between mb-1">
                      <span>Market REC (Gold Fixing):</span>
                      <span className="font-medium">{openBalance.marketRecCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GFV Vouchers:</span>
                      <span className="font-medium">{openBalance.gfvCount}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-4 p-2 bg-orange-50 rounded-lg">
                    <div className="font-medium mb-1">Sign Convention:</div>
                    <div>• Market REC (Gold Fixing): Gold (+), Fixing Amount (+)</div>
                    <div>• GFV: Gold (-), KWD (-)</div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Link
                      href="/open-balance"
                      className="flex-1 text-center bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      View Open Balance
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Summary Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Detailed Account Type Summary
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Complete breakdown of all account types and their financial positions
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account Type
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Accounts
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gold Balance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        KWD Balance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {typeSummaries.map((summary) => {
                      const typeColor = getTypeColor(summary.type);
                      return (
                        <tr key={summary.type} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full ${typeColor.bg} mr-3`}></div>
                              <div className="text-sm font-semibold text-gray-900">{summary.type}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-gray-900 font-medium">{summary.totalAccounts}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-gray-900 font-medium">{summary.totalTransactions}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className={`text-sm font-semibold ${getBalanceColor(summary.goldBalance)}`}>
                              {formatCurrency(summary.goldBalance)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className={`text-sm font-semibold ${getBalanceColor(summary.kwdBalance)}`}>
                              {formatCurrency(summary.kwdBalance)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end space-x-2">
                              <Link
                                href={`/accounts/balance/${summary.type}`}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                              >
                                Balances
                              </Link>
                              <Link
                                href={`/balance-sheet/type/${summary.type}`}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                              >
                                Ledger
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Open Balance Row */}
                    <tr className="hover:bg-orange-50 transition-colors border-t-2 border-orange-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-orange-500 mr-3"></div>
                          <div className="text-sm font-semibold text-gray-900">Open Balance</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-500 font-medium">-</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-900 font-medium">{openBalance.totalTransactions}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${getBalanceColor(openBalance.goldBalance)}`}>
                          {formatCurrency(openBalance.goldBalance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${getBalanceColor(openBalance.kwdBalance)}`}>
                          {formatCurrency(openBalance.kwdBalance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Link
                            href="/open-balance"
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-orange-600 hover:bg-orange-700 transition-colors"
                          >
                            View Open Balance
                          </Link>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  {/* Footer with totals */}
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        Account Types Total
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {totalAccounts}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {totalTransactions}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        <span className={getBalanceColor(overallGold)}>
                          {formatCurrency(overallGold)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        <span className={getBalanceColor(overallKwd)}>
                          {formatCurrency(overallKwd)}
                        </span>
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                    <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        GRAND TOTAL (Including Open Balance)
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        -
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {totalTransactions + openBalance.totalTransactions}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        <span className={getBalanceColor(grandTotalGold)}>
                          {formatCurrency(grandTotalGold)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        <span className={getBalanceColor(grandTotalKwd)}>
                          {formatCurrency(grandTotalKwd)}
                        </span>
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}