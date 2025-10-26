import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type AccountTypeSummary = {
  type: string;
  totalAccounts: number;
  totalTransactions: number;
  goldBalance: number;
  kwdBalance: number;
  accounts: Array<{
    id: string;
    name: string;
    accountNo: number;
    goldBalance: number;
    kwdBalance: number;
    transactionCount: number;
  }>;
};

type Props = {
  typeSummaries: AccountTypeSummary[];
  overallGold: number;
  overallKwd: number;
  totalAccounts: number;
  totalTransactions: number;
};

export const getServerSideProps: GetServerSideProps = async () => {
  // Define the account types we want to summarize
  const accountTypes = ["Market", "Casting", "Finishing", "Project"];

  // Fetch all accounts and their vouchers in one go for efficiency
  const accountsWithVouchers = await prisma.account.findMany({
    where: {
      type: { in: accountTypes }
    },
    include: {
      vouchers: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { type: "asc", accountNo: "asc" },
  });

  // Group accounts by type and calculate balances
  const typeSummaries: AccountTypeSummary[] = accountTypes.map(type => {
    const typeAccounts = accountsWithVouchers.filter(account => account.type === type);
    
    // Calculate balances for each account in this type
    const accountsWithBalances = typeAccounts.map(account => {
      let goldBalance = 0;
      let kwdBalance = 0;

      account.vouchers.forEach(voucher => {
        if (voucher.vt === "INV") {
          goldBalance += voucher.gold;
          kwdBalance += voucher.kwd;
        } else if (voucher.vt === "REC") {
          goldBalance -= voucher.gold;
          kwdBalance -= voucher.kwd;
        }
      });

      return {
        id: account.id,
        name: account.name,
        accountNo: account.accountNo,
        goldBalance,
        kwdBalance,
        transactionCount: account.vouchers.length,
      };
    });

    // Calculate totals for this type
    const goldBalance = accountsWithBalances.reduce((sum, acc) => sum + acc.goldBalance, 0);
    const kwdBalance = accountsWithBalances.reduce((sum, acc) => sum + acc.kwdBalance, 0);
    const totalTransactions = accountsWithBalances.reduce((sum, acc) => sum + acc.transactionCount, 0);

    return {
      type,
      totalAccounts: typeAccounts.length,
      totalTransactions,
      goldBalance,
      kwdBalance,
      accounts: accountsWithBalances,
    };
  });

  // Calculate overall totals
  const overallGold = typeSummaries.reduce((sum, summary) => sum + summary.goldBalance, 0);
  const overallKwd = typeSummaries.reduce((sum, summary) => sum + summary.kwdBalance, 0);
  const totalAccounts = typeSummaries.reduce((sum, summary) => sum + summary.totalAccounts, 0);
  const totalTransactions = typeSummaries.reduce((sum, summary) => sum + summary.totalTransactions, 0);

  return {
    props: {
      typeSummaries: JSON.parse(JSON.stringify(typeSummaries)),
      overallGold,
      overallKwd,
      totalAccounts,
      totalTransactions,
    },
  };
};

export default function TypeSummaryPage({
  typeSummaries,
  overallGold,
  overallKwd,
  totalAccounts,
  totalTransactions,
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
      Finishing: {
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

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return '↗';
    if (balance < 0) return '↘';
    return '→';
  };

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

        {/* Account Type Summary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
                    <span>{summary.accounts.filter(a => a.transactionCount > 0).length} active accounts</span>
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

                {/* Top Accounts (simplified view) */}
                {summary.accounts.length > 0 && (
                  <div className="border-t border-gray-200">
                    <div className="px-6 py-3 bg-gray-50">
                      <h3 className="text-sm font-medium text-gray-900">Top Accounts</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {summary.accounts.slice(0, 5).map((account) => (
                        <div key={account.id} className="px-6 py-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center">
                                <div className={`w-2 h-2 rounded-full ${typeColor.bg} mr-2`}></div>
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {account.name}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 ml-4">
                                #{account.accountNo} • {account.transactionCount} transactions
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-semibold ${getBalanceColor(account.goldBalance)}`}>
                                {formatCurrency(account.goldBalance)}
                              </div>
                              <div className="text-xs text-gray-500">Gold</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {summary.accounts.length > 5 && (
                        <div className="px-6 py-3 text-center text-sm text-gray-500">
                          +{summary.accounts.length - 5} more accounts
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{summary.type}</div>
                            <div className="text-xs text-gray-500">
                              {summary.accounts.filter(a => a.transactionCount > 0).length} active accounts
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-900 font-medium">{summary.totalAccounts}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-900 font-medium">{summary.totalTransactions}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${getBalanceColor(summary.goldBalance)} flex items-center justify-end`}>
                          <span className="mr-1">{getBalanceIcon(summary.goldBalance)}</span>
                          {formatCurrency(summary.goldBalance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${getBalanceColor(summary.kwdBalance)} flex items-center justify-end`}>
                          <span className="mr-1">{getBalanceIcon(summary.kwdBalance)}</span>
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
              </tbody>
              {/* Footer with totals */}
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Overall Total
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
              </tfoot>
            </table>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Financial Overview</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Assets (Positive):</span>
                <span className="font-semibold">
                  Gold: {formatCurrency(typeSummaries.reduce((sum, s) => sum + Math.max(0, s.goldBalance), 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Liabilities (Negative):</span>
                <span className="font-semibold">
                  Gold: {formatCurrency(typeSummaries.reduce((sum, s) => sum + Math.min(0, s.goldBalance), 0))}
                </span>
              </div>
              <div className="pt-2 border-t border-white border-opacity-20">
                <div className="flex justify-between text-lg font-bold">
                  <span>Net Position:</span>
                  <span>{formatCurrency(overallGold)} Gold</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Activity</h3>
            <div className="space-y-3">
              {typeSummaries.map((summary) => {
                const activePercentage = summary.totalAccounts > 0 
                  ? (summary.accounts.filter(a => a.transactionCount > 0).length / summary.totalAccounts) * 100
                  : 0;
                
                return (
                  <div key={summary.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{summary.type}</span>
                      <span className="font-medium">{Math.round(activePercentage)}% active</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${activePercentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Navigation</h3>
            <div className="space-y-3">
              {typeSummaries.map((summary) => (
                <div key={summary.type} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{summary.type}</span>
                  <div className="flex space-x-2">
                    <Link
                      href={`/accounts/balance/${summary.type}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Balances
                    </Link>
                    <Link
                      href={`/balance-sheet/type/${summary.type}`}
                      className="text-xs text-green-600 hover:text-green-800 font-medium"
                    >
                      Ledger
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/accounts"
                className="w-full text-center block bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Manage All Accounts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}