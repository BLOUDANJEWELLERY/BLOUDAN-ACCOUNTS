import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type AccountBalance = {
  id: string;
  accountNo: number;
  name: string;
  type: string;
  phone: string | null;
  crOrCivilIdNo: string | null;
  goldBalance: number;
  kwdBalance: number;
  transactionCount: number;
};

type Props = {
  accountType: string;
  accounts: AccountBalance[];
  totalGold: number;
  totalKwd: number;
  totalAccounts: number;
  totalTransactions: number;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const type = context.params?.type as string;

  // Validate account type
  const validTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];
  if (!validTypes.includes(type)) {
    return { notFound: true };
  }

  // Fetch all accounts of this type
  const accounts = await prisma.account.findMany({
    where: { type },
    select: { 
      id: true, 
      accountNo: true, 
      name: true, 
      type: true,
      phone: true,
      crOrCivilIdNo: true,
    },
    orderBy: { accountNo: "asc" },
  });

  if (accounts.length === 0) {
    return {
      props: {
        accountType: type,
        accounts: [],
        totalGold: 0,
        totalKwd: 0,
        totalAccounts: 0,
        totalTransactions: 0,
      },
    };
  }

  const accountIds = accounts.map(account => account.id);

  // Fetch all vouchers for these accounts
  const vouchers = await prisma.voucher.findMany({
    where: {
      accountId: { in: accountIds }
    },
    orderBy: { date: "asc" },
  });

  // Calculate balances for each account with voucher type handling
  const accountsWithBalances: AccountBalance[] = accounts.map(account => {
    const accountVouchers = vouchers.filter(v => v.accountId === account.id);
    let goldBalance = 0;
    let kwdBalance = 0;

    accountVouchers.forEach(v => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        // Both INV and Alloy add positively to both balances
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
      // Note: If there are other voucher types, they can be added here
    });

    return {
      ...account,
      goldBalance,
      kwdBalance,
      transactionCount: accountVouchers.length,
    };
  });

  // Calculate totals
  const totalGold = accountsWithBalances.reduce((sum, acc) => sum + acc.goldBalance, 0);
  const totalKwd = accountsWithBalances.reduce((sum, acc) => sum + acc.kwdBalance, 0);
  const totalTransactions = accountsWithBalances.reduce((sum, acc) => sum + acc.transactionCount, 0);

  return {
    props: {
      accountType: type,
      accounts: JSON.parse(JSON.stringify(accountsWithBalances)),
      totalGold,
      totalKwd,
      totalAccounts: accounts.length,
      totalTransactions,
    },
  };
};

export default function AccountBalancesPage({
  accountType,
  accounts,
  totalGold,
  totalKwd,
  totalAccounts,
  totalTransactions,
}: Props) {
  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const getTypeColor = (type: string) => {
    const colors = {
      Market: 'bg-blue-100 text-blue-800 border-blue-200',
      Casting: 'bg-purple-100 text-purple-800 border-purple-200',
      Faceting: 'bg-amber-100 text-amber-800 border-amber-200',
      Project: 'bg-green-100 text-green-800 border-green-200',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {accountType} Account Balances
              </h1>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${getTypeColor(accountType)}`}>
                  {accountType} Accounts
                </span>
                <span className="text-lg text-gray-600">
                  Current Balances Overview
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
              <Link 
                href={`/balance-sheet/type/${accountType}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Detailed Ledger
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
                <p className="text-sm font-medium text-gray-600">Total Gold Balance</p>
                <p className={`text-2xl font-bold ${getBalanceColor(totalGold)}`}>
                  {formatCurrency(totalGold)}
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
                <p className="text-sm font-medium text-gray-600">Total KWD Balance</p>
                <p className={`text-2xl font-bold ${getBalanceColor(totalKwd)}`}>
                  {formatCurrency(totalKwd)}
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

        {/* Account Balances Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Current Balances - {accountType} Accounts
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Real-time balance overview for all {accountType.toLowerCase()} accounts
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No {accountType.toLowerCase()} accounts found in the system.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Details
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
                  {accounts.map((account, index) => (
                    <tr key={account.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                            accountType === 'Market' ? 'bg-blue-500' :
                            accountType === 'Casting' ? 'bg-purple-500' :
                            accountType === 'Faceting' ? 'bg-amber-500' :
                            accountType === 'Project' ? 'bg-green-500' :
                            accountType === 'Gold Fixing' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            {account.accountNo}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{account.name}</div>
                            <div className="text-xs text-gray-500">
                              #{account.accountNo}
                              {account.phone && ` • ${account.phone}`}
                            </div>
                            {account.crOrCivilIdNo && (
                              <div className="text-xs text-gray-400 mt-1">
                                ID: {account.crOrCivilIdNo}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-900 font-medium">
                          {account.transactionCount}
                        </div>
                        <div className="text-xs text-gray-500">transactions</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${getBalanceColor(account.goldBalance)} flex items-center justify-end`}>
                          <span className="mr-1">{getBalanceIcon(account.goldBalance)}</span>
                          {formatCurrency(account.goldBalance)}
                        </div>
                        <div className="text-xs text-gray-500">Gold</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${getBalanceColor(account.kwdBalance)} flex items-center justify-end`}>
                          <span className="mr-1">{getBalanceIcon(account.kwdBalance)}</span>
                          {formatCurrency(account.kwdBalance)}
                        </div>
                        <div className="text-xs text-gray-500">KWD</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <Link
                            href={`/balance-sheet/${account.id}?accountType=${accountType}`}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                          >
                            Ledger
                          </Link>
                          <Link
                            href={`/accounts`}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer with totals */}
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Total {accountType} Accounts: {accounts.length}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {totalTransactions}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      <span className={getBalanceColor(totalGold)}>
                        {formatCurrency(totalGold)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      <span className={getBalanceColor(totalKwd)}>
                        {formatCurrency(totalKwd)}
                      </span>
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow text-center">
            <div className="text-sm text-gray-600">Positive Gold Balances</div>
            <div className="text-xl font-bold text-green-600">
              {accounts.filter(a => a.goldBalance > 0).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow text-center">
            <div className="text-sm text-gray-600">Positive KWD Balances</div>
            <div className="text-xl font-bold text-green-600">
              {accounts.filter(a => a.kwdBalance > 0).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow text-center">
            <div className="text-sm text-gray-600">Zero Balances</div>
            <div className="text-xl font-bold text-gray-600">
              {accounts.filter(a => a.goldBalance === 0 && a.kwdBalance === 0).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow text-center">
            <div className="text-sm text-gray-600">Active Accounts</div>
            <div className="text-xl font-bold text-blue-600">
              {accounts.filter(a => a.transactionCount > 0).length}
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center p-6 bg-white rounded-2xl shadow-lg">
          <div className="text-sm text-gray-600">
            Need detailed transaction history? View the complete ledger.
          </div>
          <div className="flex space-x-3 mt-4 sm:mt-0">
            <Link
              href={`/balance-sheet/type/${accountType}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Complete Ledger
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Manage Accounts
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}