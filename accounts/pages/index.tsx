import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type DashboardStats = {
  totalAccounts: number;
  totalVouchers: number;
  totalGoldBalance: number;
  totalKwdBalance: number;
  accountsByType: { type: string; count: number }[];
  recentActivity: { date: string; description: string; type: string }[];
};

type Props = {
  stats: DashboardStats;
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Get total accounts count
    const totalAccounts = await prisma.account.count();

    // Get total vouchers count
    const totalVouchers = await prisma.voucher.count();

    // Get accounts by type
    const accountsByType = await prisma.account.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
    });

    // Calculate total balances (simplified - you might want to use your existing logic)
    const allVouchers = await prisma.voucher.findMany({
      include: {
        account: {
          select: {
            type: true,
          },
        },
      },
    });

    let totalGoldBalance = 0;
    let totalKwdBalance = 0;

    allVouchers.forEach(voucher => {
      if (voucher.vt === "INV" || voucher.vt === "Alloy") {
        // Both INV and Alloy add positively to both balances
        totalGoldBalance += voucher.gold;
        totalKwdBalance += voucher.kwd;
      } else if (voucher.vt === "REC") {
        totalGoldBalance -= voucher.gold;
        totalKwdBalance -= voucher.kwd;
      } else if (voucher.vt === "GFV") {
        totalGoldBalance += voucher.gold;
        totalKwdBalance -= voucher.kwd;
      }
    });

    // Get recent activity (last 5 vouchers)
    const recentVouchers = await prisma.voucher.findMany({
      take: 5,
      orderBy: {
        date: 'desc',
      },
      include: {
        account: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    const recentActivity = recentVouchers.map(voucher => ({
      date: voucher.date.toISOString().split('T')[0],
      description: `${voucher.account.name} - ${voucher.mvn || voucher.description || 'No description'}`,
      type: voucher.vt,
    }));

    const stats: DashboardStats = {
      totalAccounts,
      totalVouchers,
      totalGoldBalance,
      totalKwdBalance,
      accountsByType: accountsByType.map(item => ({
        type: item.type,
        count: item._count.id,
      })),
      recentActivity,
    };

    return {
      props: {
        stats,
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      props: {
        stats: {
          totalAccounts: 0,
          totalVouchers: 0,
          totalGoldBalance: 0,
          totalKwdBalance: 0,
          accountsByType: [],
          recentActivity: [],
        },
      },
    };
  }
};

export default function HomePage({ stats }: Props) {
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
    };
    return colors[type as keyof typeof colors] || {
      bg: 'bg-gray-500',
      lightBg: 'bg-gray-50',
      text: 'text-gray-800',
      border: 'border-gray-200',
      gradient: 'from-gray-500 to-gray-600',
    };
  };

  const getVoucherTypeColor = (type: string) => {
    const colors = {
      INV: 'bg-blue-100 text-blue-800',
      REC: 'bg-green-100 text-green-800',
      GFV: 'bg-yellow-100 text-yellow-800',
      Alloy: 'bg-gray-100 text-gray-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-blue-700';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            Bloudan Accounts
          </h1>
          <p className="text-xl text-blue-700 mb-6 max-w-3xl mx-auto">
            Complete Business Management Solution for Accounts, Vouchers, and Financial Records
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Accounts Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total Accounts</p>
                <p className="text-2xl font-bold text-blue-800">{stats.totalAccounts}</p>
              </div>
            </div>
          </div>

          {/* Total Vouchers Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total Vouchers</p>
                <p className="text-2xl font-bold text-blue-800">{stats.totalVouchers}</p>
              </div>
            </div>
          </div>

          {/* Total Gold Balance Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total Gold</p>
                <p className={`text-2xl font-bold ${getBalanceColor(stats.totalGoldBalance)}`}>
                  {formatCurrency(stats.totalGoldBalance)}
                </p>
              </div>
            </div>
          </div>

          {/* Total KWD Balance Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total KWD</p>
                <p className={`text-2xl font-bold ${getBalanceColor(stats.totalKwdBalance)}`}>
                  {formatCurrency(stats.totalKwdBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border-2 border-blue-300">
            <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
              <h2 className="text-xl font-semibold text-blue-800">
                Quick Actions
              </h2>
              <p className="text-sm text-blue-700 mt-1">
                Essential operations for daily management
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Manage Accounts */}
              <Link
                href="/accounts"
                className="p-4 border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group bg-white/80"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-blue-900">Manage Accounts</h3>
                    <p className="text-sm text-blue-700">Create and edit accounts</p>
                  </div>
                </div>
              </Link>

              {/* Create Vouchers */}
              <Link
                href="/vouchers/create"
                className="p-4 border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group bg-white/80"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-blue-900">Create Vouchers</h3>
                    <p className="text-sm text-blue-700">Add new transactions</p>
                  </div>
                </div>
              </Link>

              {/* View Vouchers */}
              <Link
                href="/vouchers/list"
                className="p-4 border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group bg-white/80"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-blue-900">View Vouchers</h3>
                    <p className="text-sm text-blue-700">Browse all transactions</p>
                  </div>
                </div>
              </Link>

              {/* Type Summary */}
              <Link
                href="/balance-sheet/type-summary"
                className="p-4 border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group bg-white/80"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-blue-900">Type Summary</h3>
                    <p className="text-sm text-blue-700">Account type overview</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Account Types Overview */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border-2 border-blue-300">
            <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
              <h2 className="text-xl font-semibold text-blue-800">
                Account Types Overview
              </h2>
              <p className="text-sm text-blue-700 mt-1">
                Breakdown of accounts by type
              </p>
            </div>
            
            <div className="space-y-4">
              {accountTypes.map((type) => {
                const typeStats = stats.accountsByType.find(item => item.type === type);
                const count = typeStats?.count || 0;
                const typeColor = getTypeColor(type);
                
                return (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="flex items-center justify-between p-4 border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all bg-white/80"
                  >
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${typeColor.bg} mr-3`}></div>
                      <span className="font-semibold text-blue-900">{type}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-blue-700">{count} account{count !== 1 ? 's' : ''}</span>
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden mb-8 border-2 border-blue-300">
          <div className="px-6 py-4 border-b-2 border-blue-300 bg-blue-100">
            <h2 className="text-xl font-semibold text-blue-800">
              Recent Activity
            </h2>
            <p className="text-sm text-blue-700 mt-1">
              Latest transactions and updates
            </p>
          </div>

          <div className="p-6">
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border-2 border-blue-300 rounded-2xl bg-white/80">
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getVoucherTypeColor(activity.type)}`}>
                        {activity.type}
                      </span>
                      <div>
                        <p className="font-medium text-blue-900">{activity.description}</p>
                        <p className="text-sm text-blue-600">{formatDate(activity.date)}</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4 text-blue-400">📊</div>
                <h3 className="text-lg font-medium text-blue-800">No recent activity</h3>
                <p className="text-blue-600 mt-1">Get started by creating your first voucher.</p>
                <Link
                  href="/vouchers/create"
                  className="inline-flex items-center px-6 py-3 mt-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl hover:from-blue-700 hover:to-blue-900 transition-colors shadow-lg"
                >
                  Create Voucher
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Additional Navigation */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-2xl border-2 border-blue-400">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold">Need More Insights?</h3>
              <p className="opacity-90">Explore detailed reports and analytics</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/balance-sheet/type-summary"
                className="px-6 py-2 bg-white text-blue-700 rounded-xl font-medium hover:bg-blue-50 transition-colors"
              >
                View Type Summary
              </Link>
              <Link
                href="/open-balance"
                className="px-6 py-2 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors"
              >
                Open Balance
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}