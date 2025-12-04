import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { useState } from "react";

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

  const validTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];
  if (!validTypes.includes(type)) {
    return { notFound: true };
  }

  const accounts = await prisma.account.findMany({
    where: { 
      type,
      isActive: true,
    },
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

  const vouchers = await prisma.voucher.findMany({
    where: {
      accountId: { in: accountIds }
    },
    orderBy: { date: "asc" },
  });

  const accountsWithBalances: AccountBalance[] = accounts.map(account => {
    const accountVouchers = vouchers.filter(v => v.accountId === account.id);
    let goldBalance = 0;
    let kwdBalance = 0;

    accountVouchers.forEach(v => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        goldBalance += v.gold;
        kwdBalance += v.kwd;
      } else if (v.vt === "REC") {
        goldBalance -= v.gold;
        kwdBalance -= v.kwd;
      } else if (v.vt === "GFV") {
        goldBalance += v.gold;
        kwdBalance -= v.kwd;
      }
    });

    return {
      ...account,
      goldBalance,
      kwdBalance,
      transactionCount: accountVouchers.length,
    };
  });

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
  const [searchTerm, setSearchTerm] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const formatCurrency = (value: number, type: 'gold' | 'kwd') => {
    const absoluteValue = Math.abs(value);
    const suffix = value >= 0 ? 'Cr' : 'Db';
    const unit = type === 'gold' ? 'g' : 'KWD';
    const formatted = absoluteValue.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${formatted} ${unit} ${suffix}`;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Market: 'from-blue-600 to-blue-800',
      Casting: 'from-purple-600 to-purple-800',
      Faceting: 'from-amber-500 to-amber-700',
      Project: 'from-green-600 to-green-800',
      'Gold Fixing': 'from-yellow-600 to-yellow-800',
    };
    return colors[type] || 'from-emerald-600 to-emerald-800';
  };

  const getTypeLightColor = (type: string) => {
    const colors: Record<string, string> = {
      Market: 'bg-blue-100 text-blue-800 border-blue-200',
      Casting: 'bg-purple-100 text-purple-800 border-purple-200',
      Faceting: 'bg-amber-100 text-amber-800 border-amber-200',
      Project: 'bg-green-100 text-green-800 border-green-200',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[type] || 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? "text-emerald-700" : "text-amber-700";
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return '↗';
    if (balance < 0) return '↘';
    return '→';
  };

  const filteredAccounts = accounts.filter(account => {
    const searchLower = searchTerm.toLowerCase();
    return (
      account.name.toLowerCase().includes(searchLower) ||
      account.accountNo.toString().includes(searchTerm) ||
      (account.phone && account.phone.includes(searchTerm)) ||
      (account.crOrCivilIdNo && account.crOrCivilIdNo.toLowerCase().includes(searchLower))
    );
  });

  const accountsWithPositiveGold = accounts.filter(a => a.goldBalance > 0).length;
  const accountsWithPositiveKwd = accounts.filter(a => a.kwdBalance > 0).length;
  const accountsWithZeroBalance = accounts.filter(a => a.goldBalance === 0 && a.kwdBalance === 0).length;
  const activeAccounts = accounts.filter(a => a.transactionCount > 0).length;

  const generateAndHandlePDF = async (mode: 'download' | 'share') => {
    try {
      setPdfError(null);
      mode === 'download' ? setPdfLoading(true) : setExportingPdf(true);
      
      console.log("Starting PDF generation...");
      
      const response = await fetch("/api/generate-balance-pdf", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          accountType,
          accountBalances: filteredAccounts,
          totals: {
            totalGold,
            totalKwd,
            totalAccounts,
            totalTransactions,
            accountsWithPositiveGold,
            accountsWithPositiveKwd,
            accountsWithZeroBalance,
            activeAccounts
          },
          generatedAt: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }),
      });

      console.log("API Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("API Success response:", result);
      
      if (!result.success || !result.pdfData) {
        throw new Error(result.error || "PDF generation failed");
      }

      // Convert base64 to blob
      const binary = atob(result.pdfData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      
      const fileName = `zamzam-${accountType.toLowerCase()}-balances-${new Date()
        .toISOString()
        .split('T')[0]}.pdf`;
      
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Platform detection
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      // Try share if it's a share request and supported
      if (mode === 'share' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `${accountType} Account Balances PDF`,
            files: [file],
          });
          console.log("Share successful");
        } catch (shareError) {
          console.log("Share failed, falling back to download:", shareError);
          // Fallback to download if share fails
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        // Always download for non-share or unsupported share
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Download triggered");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      setPdfError(error instanceof Error ? error.message : "Failed to generate PDF");
      // Show error to user
      alert(`PDF Generation Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      mode === 'download' ? setPdfLoading(false) : setExportingPdf(false);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-r ${getTypeColor(accountType)} rounded-3xl blur-lg opacity-30 transform scale-110 -z-10`}></div>
            <div className={`w-20 h-20 bg-gradient-to-br ${getTypeColor(accountType)} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-amber-300 transform hover:scale-105 transition-transform duration-300`}>
              <svg className="w-10 h-10 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-emerald-700 to-emerald-900 bg-clip-text text-transparent mb-4 tracking-tight">
            {accountType} Account Balances
          </h1>
          <p className="text-xl text-emerald-700 font-light">Detailed overview of {accountType.toLowerCase()} account balances</p>
        </div>

        {/* PDF Error Alert */}
        {pdfError && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-3xl p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium text-red-800">PDF Error: {pdfError}</span>
            </div>
            <button
              onClick={() => setPdfError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`bg-gradient-to-r ${getTypeColor(accountType)} text-white rounded-3xl p-8 text-center shadow-2xl border-2 border-amber-400 transform hover:-translate-y-1 transition-transform duration-300`}>
            <p className="text-lg font-semibold mb-2">Total {accountType} Accounts</p>
            <p className="text-4xl font-bold">{totalAccounts}</p>
          </div>
          
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-3xl p-8 text-center shadow-2xl border-2 border-amber-400 transform hover:-translate-y-1 transition-transform duration-300">
            <p className="text-lg font-semibold mb-2">Total Gold Balance</p>
            <p className="text-3xl font-bold">{formatCurrency(totalGold, 'gold')}</p>
          </div>
          
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-white rounded-3xl p-8 text-center shadow-2xl border-2 border-amber-400 transform hover:-translate-y-1 transition-transform duration-300">
            <p className="text-lg font-semibold mb-2">Total Amount Balance</p>
            <p className="text-3xl font-bold">{formatCurrency(totalKwd, 'kwd')}</p>
          </div>
          
          <div className={`bg-gradient-to-r ${getTypeColor(accountType)} text-white rounded-3xl p-8 text-center shadow-2xl border-2 border-amber-400 transform hover:-translate-y-1 transition-transform duration-300`}>
            <p className="text-lg font-semibold mb-2">Total Transactions</p>
            <p className="text-4xl font-bold">{totalTransactions}</p>
            <p className="text-sm opacity-90 mt-2 font-medium">
              {activeAccounts} active accounts
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-emerald-300 text-center">
            <div className="text-sm text-emerald-700 font-medium mb-1">Positive Gold Balances</div>
            <div className="text-2xl font-bold text-emerald-700">{accountsWithPositiveGold}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-emerald-300 text-center">
            <div className="text-sm text-emerald-700 font-medium mb-1">Positive KWD Balances</div>
            <div className="text-2xl font-bold text-emerald-700">{accountsWithPositiveKwd}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-emerald-300 text-center">
            <div className="text-sm text-emerald-700 font-medium mb-1">Zero Balances</div>
            <div className="text-2xl font-bold text-emerald-700">{accountsWithZeroBalance}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border-2 border-emerald-300 text-center">
            <div className="text-sm text-emerald-700 font-medium mb-1">Active Accounts</div>
            <div className="text-2xl font-bold text-emerald-700">{activeAccounts}</div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-6 border-2 border-emerald-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-200 to-amber-400 rounded-full translate-x-12 -translate-y-12 opacity-20"></div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center relative z-10">
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={`Search ${accountType.toLowerCase()} accounts by name, account number, phone, or ID...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border-2 border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/80"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <span className="inline-flex items-center px-4 py-2 rounded-xl text-emerald-700 font-semibold bg-emerald-100 border-2 border-emerald-300">
                {filteredAccounts.length} accounts
              </span>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-amber-800">Debug Info</span>
            </div>
            <div className="mt-2 text-sm text-amber-700">
              <p>Accounts: {accounts.length}</p>
              <p>Filtered: {filteredAccounts.length}</p>
              <p>Total gold balance: {totalGold}</p>
              <p>Total KWD balance: {totalKwd}</p>
            </div>
          </div>
        )}

        {/* Account Balances Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-emerald-300">
          <div className="px-6 py-4 border-b-2 border-emerald-300 bg-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-emerald-800">{accountType} Account Balances</h2>
                <p className="text-sm text-emerald-700 mt-1">
                  Real-time balance overview for all {accountType.toLowerCase()} accounts
                </p>
              </div>
              <span className={`inline-flex px-4 py-2 rounded-xl text-sm font-semibold ${getTypeLightColor(accountType)}`}>
                {accountType}
              </span>
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="w-16 h-16 text-emerald-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-medium text-emerald-800 mb-2">No accounts found</h3>
              <p className="text-emerald-600">
                {searchTerm ? "Try adjusting your search terms" : `No ${accountType.toLowerCase()} accounts in the system`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-emerald-100">
                  <tr>
                    <th className="border border-emerald-300 px-4 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Account Details
                    </th>
                    <th className="border border-emerald-300 px-4 py-3 text-center text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="border border-emerald-300 px-4 py-3 text-right text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Gold Balance
                    </th>
                    <th className="border border-emerald-300 px-4 py-3 text-right text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Amount Balance
                    </th>
                    <th className="border border-emerald-300 px-4 py-3 text-right text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-300">
                  {filteredAccounts.map((account, index) => (
                    <tr key={account.id} className="bg-white hover:bg-emerald-50/50 transition-colors duration-150">
                      <td className="border border-emerald-300 px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                            accountType === 'Market' ? 'bg-gradient-to-r from-blue-600 to-blue-800' :
                            accountType === 'Casting' ? 'bg-gradient-to-r from-purple-600 to-purple-800' :
                            accountType === 'Faceting' ? 'bg-gradient-to-r from-amber-500 to-amber-700' :
                            accountType === 'Project' ? 'bg-gradient-to-r from-green-600 to-green-800' :
                            'bg-gradient-to-r from-yellow-600 to-yellow-800'
                          }`}>
                            {account.accountNo}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-emerald-900">{account.name}</div>
                            <div className="text-sm text-emerald-700">Acc: {account.accountNo}</div>
                            {account.phone && (
                              <div className="text-xs text-emerald-600">Phone: {account.phone}</div>
                            )}
                            {account.crOrCivilIdNo && (
                              <div className="text-xs text-emerald-600">ID: {account.crOrCivilIdNo}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="border border-emerald-300 px-4 py-3 whitespace-nowrap text-sm text-emerald-700 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          account.transactionCount > 0 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        }`}>
                          {account.transactionCount}
                        </span>
                      </td>
                      <td className={`border border-emerald-300 px-4 py-3 whitespace-nowrap text-sm text-right font-mono font-semibold ${getBalanceColor(account.goldBalance)}`}>
                        <div className="flex items-center justify-end space-x-1">
                          <span>{getBalanceIcon(account.goldBalance)}</span>
                          <span>{formatCurrency(account.goldBalance, 'gold')}</span>
                        </div>
                      </td>
                      <td className={`border border-emerald-300 px-4 py-3 whitespace-nowrap text-sm text-right font-mono font-semibold ${getBalanceColor(account.kwdBalance)}`}>
                        <div className="flex items-center justify-end space-x-1">
                          <span>{getBalanceIcon(account.kwdBalance)}</span>
                          <span>{formatCurrency(account.kwdBalance, 'kwd')}</span>
                        </div>
                      </td>
                      <td className="border border-emerald-300 px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/balance-sheet/${account.id}?accountType=${accountType}`}
                            className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white text-xs font-semibold rounded-xl hover:from-emerald-700 hover:to-emerald-900 transition-all duration-200 border-2 border-amber-400 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Ledger
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredAccounts.length > 0 && (
                  <tfoot className="bg-emerald-100">
                    <tr>
                      <td colSpan={2} className="border border-emerald-300 px-4 py-4 text-sm font-semibold text-emerald-800 text-right">
                        Totals:
                      </td>
                      <td className={`border border-emerald-300 px-4 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${getBalanceColor(totalGold)}`}>
                        {formatCurrency(totalGold, 'gold')}
                      </td>
                      <td className={`border border-emerald-300 px-4 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${getBalanceColor(totalKwd)}`}>
                        {formatCurrency(totalKwd, 'kwd')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`/balance-sheet/type/${accountType}`}
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-bold text-lg rounded-2xl hover:from-emerald-700 hover:to-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-amber-400 transform hover:-translate-y-1"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Complete Ledger
          </Link>
          <Link
            href="/accounts"
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-bold text-lg rounded-2xl hover:from-emerald-700 hover:to-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 border-2 border-amber-400 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Manage All Accounts
          </Link>
          <button
            onClick={() => generateAndHandlePDF('download')}
            disabled={pdfLoading || exportingPdf}
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-amber-400 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </>
            )}
          </button>
          <button
            onClick={() => generateAndHandlePDF('share')}
            disabled={exportingPdf || pdfLoading}
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-2xl hover:shadow-3xl border-2 border-amber-400 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingPdf ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    <footer className="text-center py-4 sm:py-6 bg-gradient-to-r from-emerald-800 to-emerald-900 text-white text-xs sm:text-sm border-t border-emerald-700 select-none mt-0">
      <p>© 2025 ZamZam Accounts | All Rights Reserved</p>
    </footer>
    </>
  );
}