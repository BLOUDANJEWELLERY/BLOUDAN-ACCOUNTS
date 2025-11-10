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
      if (voucher.vt === "INV") {
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

  const getVoucherTypeColor = (type: string) => {
    const colors = {
      INV: 'bg-blue-100 text-blue-800',
      REC: 'bg-green-100 text-green-800',
      GFV: 'bg-yellow-100 text-yellow-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">Gold Ledger Pro</h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">Complete Business Management Solution</p>
            <p className="text-lg opacity-80 max-w-3xl mx-auto">
              Manage your accounts, create vouchers, track gold and KWD transactions, and maintain perfect financial records.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
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
                <p className="text-2xl font-bold text-gray-900">{stats.totalAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Vouchers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVouchers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gold</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalGoldBalance)}</p>
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
                <p className="text-sm font-medium text-gray-600">Total KWD</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalKwdBalance)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/accounts"
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">Manage Accounts</h3>
                    <p className="text-sm text-gray-600">Create and edit accounts</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/vouchers/create"
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">Create Vouchers</h3>
                    <p className="text-sm text-gray-600">Add new transactions</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/vouchers/list"
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">View Vouchers</h3>
                    <p className="text-sm text-gray-600">Browse all transactions</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/balance-sheet/type-summary"
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">Type Summary</h3>
                    <p className="text-sm text-gray-600">Account type overview</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Account Types Overview */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Types</h2>
            <div className="space-y-4">
              {accountTypes.map((type) => {
                const typeStats = stats.accountsByType.find(item => item.type === type);
                const count = typeStats?.count || 0;
                
                return (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        type === 'Market' ? 'bg-blue-500' :
                        type === 'Casting' ? 'bg-purple-500' :
                        type === 'Faceting' ? 'bg-amber-500' :
                        type === 'Project' ? 'bg-green-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <span className="ml-3 font-medium text-gray-900">{type}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">{count} accounts</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVoucherTypeColor(activity.type)}`}>
                      {activity.type}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-500">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first voucher.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}