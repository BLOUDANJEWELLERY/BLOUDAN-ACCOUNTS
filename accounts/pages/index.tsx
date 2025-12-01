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

  const getVoucherTypeColor = (type: string) => {
    const colors = {
      INV: 'bg-blue-100 text-blue-800 border border-blue-200',
      REC: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      GFV: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      Alloy: 'bg-purple-100 text-purple-800 border border-purple-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-600 via-purple-700 to-blue-800 text-white py-16 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-300 rounded-full opacity-10 -translate-x-16 -translate-y-16"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-300 rounded-full opacity-10 translate-x-20 translate-y-20"></div>
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-blue-300 rounded-full opacity-10"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-block mb-4">
              <div className="bg-gradient-to-r from-yellow-300 to-amber-400 p-1 rounded-full">
                <div className="bg-gradient-to-r from-amber-600 via-purple-700 to-blue-800 p-4 rounded-full">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-yellow-300 via-white to-blue-300 bg-clip-text text-transparent">
              Bloudan Jewellery
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 font-light">Gold Ledger & Account Management System</p>
            <p className="text-lg opacity-80 max-w-3xl mx-auto font-light">
              Manage your jewellery business accounts, create vouchers, track gold and KWD transactions, 
              and maintain perfect financial records.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Accounts Card */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAccounts}</p>
              </div>
            </div>
          </div>

          {/* Total Vouchers Card */}
          <div className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl p-6 shadow-lg border border-emerald-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Vouchers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVouchers}</p>
              </div>
            </div>
          </div>

          {/* Total Gold Card */}
          <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl p-6 shadow-lg border border-amber-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gold Balance</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalGoldBalance)}</p>
              </div>
            </div>
          </div>

          {/* Total KWD Card */}
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 shadow-lg border border-purple-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total KWD Balance</p>
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
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
              <div className="p-2 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/accounts"
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-amber-500 hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100 transition-all group"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Account Types</h2>
              <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="space-y-4">
              {accountTypes.map((type) => {
                const typeStats = stats.accountsByType.find(item => item.type === type);
                const count = typeStats?.count || 0;
                
                const getTypeStyle = (type: string) => {
                  switch(type) {
                    case 'Market': return 'bg-blue-100 text-blue-800 border border-blue-200';
                    case 'Casting': return 'bg-purple-100 text-purple-800 border border-purple-200';
                    case 'Faceting': return 'bg-amber-100 text-amber-800 border border-amber-200';
                    case 'Project': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                    case 'Gold Fixing': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
                    default: return 'bg-gray-100 text-gray-800 border border-gray-200';
                  }
                };

                return (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        type === 'Market' ? 'bg-blue-500' :
                        type === 'Casting' ? 'bg-purple-500' :
                        type === 'Faceting' ? 'bg-amber-500' :
                        type === 'Project' ? 'bg-emerald-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <span className="ml-3 font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{type}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm px-3 py-1 rounded-full ${getTypeStyle(type)}`}>
                        {count} account{count !== 1 ? 's' : ''}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="mt-8 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
            <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getVoucherTypeColor(activity.type)}`}>
                      {activity.type}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-500">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-block p-4 mb-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
              <p className="mt-1 text-sm text-gray-500 mb-4">Get started by creating your first voucher.</p>
              <Link
                href="/vouchers/create"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-yellow-700 transition-all"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create First Voucher
              </Link>
            </div>
          )}
        </div>

        {/* Additional Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold">Secure & Reliable</h3>
            </div>
            <p className="text-sm opacity-90">Bank-grade security for all your financial data</p>
          </div>

          <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold">Real-time Updates</h3>
            </div>
            <p className="text-sm opacity-90">Instant balance updates and transaction tracking</p>
          </div>

          <div className="bg-gradient-to-r from-amber-500 to-yellow-600 rounded-2xl p-6 text-white">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold">Detailed Reports</h3>
            </div>
            <p className="text-sm opacity-90">Comprehensive financial reports and insights</p>
          </div>
        </div>
      </div>
    </main>
  );
}