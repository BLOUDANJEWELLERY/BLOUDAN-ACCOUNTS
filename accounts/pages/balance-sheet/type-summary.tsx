import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type AccountTypeSummary = {
  type: string;
  totalAccounts: number;
  totalTransactions: number;
  goldBalance: number;
  kwdBalance: number;
  lockerGold: number;
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
  totalActiveAccounts: number;
  totalTransactions: number;
  grandTotalGold: number;
  grandTotalKwd: number;
  lockerTotalGold: number;
  error?: string;
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Define the account types we want to summarize
    const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

    // Get all accounts grouped by type with isActive field
    const accountsByType = await prisma.account.findMany({
      where: {
        type: { in: accountTypes }
      },
      select: {
        id: true,
        type: true,
        isActive: true,
      },
    });

    // Get all vouchers with account's isActive included
    const allVouchers = await prisma.voucher.findMany({
      select: {
        id: true,
        accountId: true,
        vt: true,
        gold: true,
        kwd: true,
        goldRate: true,
        fixingAmount: true,
        paymentMethod: true,
        account: {
          select: {
            type: true,
            isActive: true,
          },
        },
      },
    });

    // Calculate balances for each account type
    const typeSummaries: AccountTypeSummary[] = accountTypes.map(type => {
      // Get ALL accounts of this type (both active and inactive)
      const allTypeAccounts = accountsByType
        .filter(account => account.type === type);
      
      // Get only ACTIVE accounts of this type for account type calculations
      const activeTypeAccounts = allTypeAccounts
        .filter(account => account.isActive);

      const activeTypeAccountIds = activeTypeAccounts.map(account => account.id);
      const allTypeAccountIds = allTypeAccounts.map(account => account.id);

      // For regular balances: Only use vouchers from ACTIVE accounts
      const activeTypeVouchers = allVouchers.filter(v => 
        activeTypeAccountIds.includes(v.accountId)
      );

      // For locker gold: Use vouchers from ALL accounts (active and inactive)
      const allTypeVouchersForLocker = allVouchers.filter(v => 
        allTypeAccountIds.includes(v.accountId)
      );

      let goldBalance = 0;
      let kwdBalance = 0;
      let lockerGold = 0;

      // REGULAR BALANCE CALCULATIONS (only from active accounts)
      activeTypeVouchers.forEach(voucher => {
        const isAlloy = voucher.vt === "Alloy";
        const isGFV = voucher.vt === "GFV";

        if (voucher.vt === "INV" || voucher.vt === "Alloy") {
          goldBalance += voucher.gold;
          kwdBalance += voucher.kwd;
        } else if (voucher.vt === "REC") {
          goldBalance -= voucher.gold;
          kwdBalance -= voucher.kwd;
        } else if (voucher.vt === "GFV") {
          if (type === "Gold Fixing") {
            goldBalance += voucher.gold;
            kwdBalance -= voucher.kwd;
          }
        }
      });

      // LOCKER GOLD CALCULATIONS (from all accounts, active and inactive)
      allTypeVouchersForLocker.forEach(voucher => {
        const isAlloy = voucher.vt === "Alloy";
        const isGFV = voucher.vt === "GFV";

        if (!isAlloy && !isGFV) {
          if (type === "Market") {
            if (voucher.vt === "INV") {
              lockerGold -= voucher.gold;
            } else if (voucher.vt === "REC") {
              if (voucher.paymentMethod !== "cheque") {
                lockerGold += voucher.gold;
              }
            }
          } else if (type === "Casting" || type === "Faceting" || type === "Project") {
            if (voucher.vt === "INV") {
              lockerGold -= voucher.gold;
            } else if (voucher.vt === "REC") {
              lockerGold += voucher.gold;
            }
          } else if (type === "Gold Fixing") {
            if (voucher.vt === "REC") {
              lockerGold += voucher.gold;
            }
          }
        }
      });

      return {
        type,
        totalAccounts: activeTypeAccounts.length, // Only count active accounts
        totalTransactions: activeTypeVouchers.length, // Only count vouchers from active accounts
        goldBalance,
        kwdBalance,
        lockerGold,
      };
    });

    // Calculate Open Balance (include ALL vouchers regardless of account's active status)
    let openBalanceGold = 0;
    let openBalanceKwd = 0;
    let marketRecCount = 0;
    let gfvCount = 0;

    allVouchers.forEach(voucher => {
      // Market REC with Gold Fixing (goldRate exists)
      if (voucher.vt === "REC" && voucher.account.type === "Market" && voucher.goldRate) {
        openBalanceGold += voucher.gold;
        openBalanceKwd += voucher.fixingAmount || 0;
        marketRecCount++;
      }
      // GFV vouchers
      else if (voucher.vt === "GFV") {
        openBalanceGold -= voucher.gold;
        openBalanceKwd -= voucher.kwd;
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

    // Calculate overall totals (only from active accounts)
    const overallGold = typeSummaries.reduce((sum, summary) => sum + summary.goldBalance, 0);
    const overallKwd = typeSummaries.reduce((sum, summary) => sum + summary.kwdBalance, 0);
    const totalActiveAccounts = typeSummaries.reduce((sum, summary) => sum + summary.totalAccounts, 0);
    const totalTransactions = typeSummaries.reduce((sum, summary) => sum + summary.totalTransactions, 0);

    // Calculate Locker Total Gold (from ALL accounts)
    const lockerTotalGold = typeSummaries.reduce((sum, summary) => sum + summary.lockerGold, 0);

    // Calculate GRAND TOTALS (including Open Balance)
    const grandTotalGold = overallGold + openBalanceGold;
    const grandTotalKwd = overallKwd + openBalanceKwd;

    return {
      props: {
        typeSummaries,
        openBalance,
        overallGold,
        overallKwd,
        totalActiveAccounts, // Renamed to be clear
        totalTransactions,
        grandTotalGold,
        grandTotalKwd,
        lockerTotalGold,
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
        totalActiveAccounts: 0,
        totalTransactions: 0,
        grandTotalGold: 0,
        grandTotalKwd: 0,
        lockerTotalGold: 0,
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
  totalActiveAccounts,
  totalTransactions,
  grandTotalGold,
  grandTotalKwd,
  lockerTotalGold,
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
        bg: 'bg-emerald-500',
        lightBg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        gradient: 'from-emerald-500 to-emerald-600',
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
      'Locker': {
        bg: 'bg-blue-500',
        lightBg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        gradient: 'from-blue-500 to-blue-600',
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
    if (balance > 0) return 'text-blue-700';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border-2 border-blue-300">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-blue-800 mb-4">Error Loading Data</h1>
            <p className="text-blue-600 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/accounts" 
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl hover:from-blue-700 hover:to-blue-900 transition-colors shadow-lg"
              >
                Manage Accounts
              </Link>
              <Link 
                href="/vouchers/create" 
                className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-2xl bg-white hover:bg-blue-50 transition-colors shadow-lg"
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            Account Type Summary
          </h1>
          <p className="text-xl text-blue-700 mb-6">
            Complete financial overview across all active accounts
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/accounts" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Manage Accounts
            </Link>
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View All Vouchers
            </Link>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Active Accounts</p>
                <p className="text-2xl font-bold text-blue-800">{totalActiveAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Account Types Gold</p>
                <p className={`text-2xl font-bold ${getBalanceColor(overallGold)}`}>
                  {formatCurrency(overallGold)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Account Types KWD</p>
                <p className={`text-2xl font-bold ${getBalanceColor(overallKwd)}`}>
                  {formatCurrency(overallKwd)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Active Transactions</p>
                <p className="text-2xl font-bold text-blue-800">{totalTransactions}</p>
              </div>
            </div>
          </div>

          {/* Locker Gold Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Locker Gold</p>
                <p className={`text-2xl font-bold ${getBalanceColor(lockerTotalGold)}`}>
                  {formatCurrency(lockerTotalGold)}
                </p>
                <p className="text-xs text-blue-500 mt-1">Includes all accounts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Check if we have data */}
        {typeSummaries.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 text-center border-2 border-blue-300">
            <div className="text-6xl mb-4 text-blue-400">📊</div>
            <h2 className="text-2xl font-bold text-blue-800 mb-2">No Data Available</h2>
            <p className="text-blue-600 mb-6">No account type summary data found. You may need to create accounts and vouchers first.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/accounts" 
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl hover:from-blue-700 hover:to-blue-900 transition-colors shadow-lg"
              >
                Create Accounts
              </Link>
              <Link 
                href="/vouchers/create" 
                className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-2xl bg-white hover:bg-blue-50 transition-colors shadow-lg"
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
                  <div key={summary.type} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-300">
                    {/* Header */}
                    <div className={`bg-gradient-to-r ${typeColor.gradient} px-6 py-4 text-white`}>
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">{summary.type} Accounts</h2>
                        <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                          {summary.totalAccounts} active account{summary.totalAccounts !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center">
                          <div className={`text-xl font-bold ${getBalanceColor(summary.goldBalance)}`}>
                            {formatCurrency(summary.goldBalance)}
                          </div>
                          <div className="text-xs text-blue-600">Gold Balance</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-xl font-bold ${getBalanceColor(summary.kwdBalance)}`}>
                            {formatCurrency(summary.kwdBalance)}
                          </div>
                          <div className="text-xs text-blue-600">KWD Balance</div>
                        </div>
                      </div>

                      <div className="flex justify-between text-sm text-blue-600 mb-4">
                        <span>{summary.totalTransactions} active transactions</span>
                        <span>Active Balance</span>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/accounts/balance/${summary.type}`}
                          className="flex-1 text-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-xl font-medium transition-colors text-sm border border-blue-300"
                        >
                          View Balances
                        </Link>
                        <Link
                          href={`/balance-sheet/type/${summary.type}`}
                          className="flex-1 text-center bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white py-2 rounded-xl font-medium transition-colors text-sm"
                        >
                          View Ledger
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Open Balance Card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-orange-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-white">
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
                      <div className="text-sm text-blue-600">Gold Balance</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getBalanceColor(openBalance.kwdBalance)}`}>
                        {formatCurrency(openBalance.kwdBalance)}
                      </div>
                      <div className="text-sm text-blue-600">KWD Balance</div>
                    </div>
                  </div>

                  <div className="text-sm text-blue-600 mb-4">
                    <div className="flex justify-between mb-1">
                      <span>Market REC (Gold Fixing):</span>
                      <span className="font-medium">{openBalance.marketRecCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GFV Vouchers:</span>
                      <span className="font-medium">{openBalance.gfvCount}</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Link
                      href="/open-balance"
                      className="flex-1 text-center bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white py-2 rounded-xl font-medium transition-colors text-sm"
                    >
                      View Open Balance
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Summary Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden mb-8 border-2 border-blue-300">
              <div className="px-6 py-4 border-b-2 border-blue-300 bg-blue-100">
                <h2 className="text-xl font-semibold text-blue-800">
                  Detailed Account Type Summary
                </h2>
                <p className="text-sm text-blue-700 mt-1">
                  Breakdown of active accounts and their financial positions
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">
                        Account Type
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-blue-800 uppercase tracking-wider">
                        Active Accounts
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-blue-800 uppercase tracking-wider">
                        Active Transactions
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider">
                        Gold Balance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider">
                        KWD Balance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-300">
                    {typeSummaries.map((summary) => {
                      const typeColor = getTypeColor(summary.type);
                      return (
                        <tr key={summary.type} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full ${typeColor.bg} mr-3`}></div>
                              <div className="text-sm font-semibold text-blue-900">{summary.type}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-blue-900 font-medium">{summary.totalAccounts}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm text-blue-900 font-medium">{summary.totalTransactions}</div>
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
                                className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                              >
                                Balances
                              </Link>
                              <Link
                                href={`/balance-sheet/type/${summary.type}`}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 transition-colors"
                              >
                                Ledger
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Account Types Total Row */}
                    <tr className="bg-blue-100 font-bold border-t-2 border-blue-300">
                      <td className="px-6 py-4 text-sm text-blue-900">
                        Active Accounts Total
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-blue-900">
                        {totalActiveAccounts}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-blue-900">
                        {totalTransactions}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-blue-900">
                        <span className={getBalanceColor(overallGold)}>
                          {formatCurrency(overallGold)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-blue-900">
                        <span className={getBalanceColor(overallKwd)}>
                          {formatCurrency(overallKwd)}
                        </span>
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>

                    {/* Open Balance Row */}
                    <tr className="hover:bg-orange-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-orange-500 mr-3"></div>
                          <div className="text-sm font-semibold text-blue-900">Open Balance</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-blue-500 font-medium">-</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-blue-900 font-medium">{openBalance.totalTransactions}</div>
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
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-lg text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 transition-colors"
                          >
                            View Open Balance
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {/* Grand Total Row */}
                    <tr className="bg-blue-100 font-bold border-t-2 border-blue-300">
                      <td className="px-6 py-4 text-sm text-blue-900">
                        GRAND TOTAL
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-blue-900">
                        -
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-blue-900">
                        {totalTransactions + openBalance.totalTransactions}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-blue-900">
                        <span className={getBalanceColor(grandTotalGold)}>
                          {formatCurrency(grandTotalGold)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-blue-900">
                        <span className={getBalanceColor(grandTotalKwd)}>
                          {formatCurrency(grandTotalKwd)}
                        </span>
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grand Total Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-2xl border-2 border-blue-400">
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
                      Active Accounts: {formatCurrency(overallGold)} + Open Balance: {formatCurrency(openBalance.goldBalance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-2xl border-2 border-blue-400">
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
                      Active Accounts: {formatCurrency(overallKwd)} + Open Balance: {formatCurrency(openBalance.kwdBalance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-700 to-blue-800 rounded-3xl p-6 text-white shadow-2xl border-2 border-blue-400">
                <div className="flex items-center">
                  <div className="p-3 bg-white bg-opacity-20 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium opacity-90">Total Locker Gold</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(lockerTotalGold)}
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      Includes all accounts (active & inactive)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}