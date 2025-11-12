// pages/cheques/index.tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useMemo } from "react";
import Link from "next/link";

type ChequeVoucher = {
  id: string;
  date: string;
  mvn?: string | null;
  description?: string | null;
  vt: string;
  accountId: string;
  gold: number;
  kwd: number;
  goldRate?: number | null;
  paymentMethod?: string | null;
  fixingAmount?: number | null;
  bankName?: string | null;
  branch?: string | null;
  chequeNo?: string | null;
  chequeDate?: string | null;
  chequeAmount?: number | null;
  cashedDate?: string | null;
  account: {
    accountNo: number;
    name: string;
    type: string;
  };
};

type Props = {
  cheques: ChequeVoucher[];
};

export const getServerSideProps: GetServerSideProps = async () => {
  const cheques = await prisma.voucher.findMany({
    where: {
      OR: [
        { paymentMethod: "cheque" },
        { paymentMethod: "cash", chequeNo: { not: null } }
      ]
    },
    orderBy: { chequeDate: "asc" },
    include: {
      account: {
        select: {
          accountNo: true,
          name: true,
          type: true
        }
      }
    }
  });

  return {
    props: {
      cheques: JSON.parse(JSON.stringify(cheques)),
    },
  };
};

export default function ChequesPage({ cheques: initialCheques }: Props) {
  const [cheques, setCheques] = useState<ChequeVoucher[]>(initialCheques);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "outstanding" | "cashed">("outstanding");
  const [bankFilter, setBankFilter] = useState("");
  const [sortOption, setSortOption] = useState("chequeDate");
  const [isCashing, setIsCashing] = useState<string | null>(null);

  // Get unique banks for filter
  const banks = useMemo(() => {
    return [...new Set(cheques
      .filter(cheque => cheque.bankName)
      .map(cheque => cheque.bankName as string)
    )].sort();
  }, [cheques]);

  // Calculate cheque status and days
  const getChequeStatus = (cheque: ChequeVoucher) => {
    const today = new Date();
    const chequeDate = new Date(cheque.chequeDate || cheque.date);
    const daysDifference = Math.floor((today.getTime() - chequeDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (cheque.paymentMethod === "cash" && cheque.cashedDate) {
      const cashedDate = new Date(cheque.cashedDate);
      const daysToCash = Math.floor((cashedDate.getTime() - chequeDate.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "cashed", days: daysToCash, daysSince: daysDifference };
    } else {
      const daysUntilCashable = 1; // Cheques can be cashed after 1 day
      const canBeCashed = daysDifference >= daysUntilCashable;
      return { 
        status: "outstanding", 
        days: daysDifference, 
        canBeCashed,
        daysUntilCashable: Math.max(0, daysUntilCashable - daysDifference)
      };
    }
  };

  // Filter and sort cheques
  const filteredAndSortedCheques = useMemo(() => {
    let filtered = cheques.filter(cheque => {
      // Status filter
      const status = getChequeStatus(cheque).status;
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "outstanding" && status === "outstanding") ||
        (statusFilter === "cashed" && status === "cashed");

      // Search term
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        (cheque.bankName && cheque.bankName.toLowerCase().includes(searchLower)) ||
        (cheque.chequeNo && cheque.chequeNo.toLowerCase().includes(searchLower)) ||
        cheque.account.name.toLowerCase().includes(searchLower) ||
        cheque.account.accountNo.toString().includes(searchTerm);

      // Bank filter
      const matchesBank = !bankFilter || cheque.bankName === bankFilter;

      return matchesStatus && matchesSearch && matchesBank;
    });

    // Sort
    switch (sortOption) {
      case "chequeDate":
        filtered.sort((a, b) => new Date(a.chequeDate || a.date).getTime() - new Date(b.chequeDate || b.date).getTime());
        break;
      case "chequeDateDesc":
        filtered.sort((a, b) => new Date(b.chequeDate || b.date).getTime() - new Date(a.chequeDate || a.date).getTime());
        break;
      case "amount":
        filtered.sort((a, b) => (a.chequeAmount || 0) - (b.chequeAmount || 0));
        break;
      case "amountDesc":
        filtered.sort((a, b) => (b.chequeAmount || 0) - (a.chequeAmount || 0));
        break;
      case "bank":
        filtered.sort((a, b) => (a.bankName || "").localeCompare(b.bankName || ""));
        break;
      case "account":
        filtered.sort((a, b) => a.account.accountNo - b.account.accountNo);
        break;
      default:
        break;
    }

    return filtered;
  }, [cheques, searchTerm, statusFilter, bankFilter, sortOption]);

  const handleCashCheque = async (chequeId: string) => {
    if (!confirm("Are you sure you want to mark this cheque as cashed?")) return;
    
    setIsCashing(chequeId);
    try {
      const res = await fetch(`/api/cheques/${chequeId}/cash`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashedDate: new Date().toISOString().split('T')[0] }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.message || "Error cashing cheque");
      }

      const updatedCheque = await res.json();
      
      // Update local state
      setCheques(prev => prev.map(cheque => 
        cheque.id === chequeId ? updatedCheque : cheque
      ));
      
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error cashing cheque");
    } finally {
      setIsCashing(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("outstanding");
    setBankFilter("");
    setSortOption("chequeDate");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KW', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(value);
  };

  // Statistics
  const stats = useMemo(() => {
    const outstanding = cheques.filter(cheque => getChequeStatus(cheque).status === "outstanding");
    const cashed = cheques.filter(cheque => getChequeStatus(cheque).status === "cashed");
    
    return {
      total: cheques.length,
      outstanding: outstanding.length,
      cashed: cashed.length,
      totalAmount: cheques.reduce((sum, cheque) => sum + (cheque.chequeAmount || 0), 0),
      outstandingAmount: outstanding.reduce((sum, cheque) => sum + (cheque.chequeAmount || 0), 0),
      cashedAmount: cashed.reduce((sum, cheque) => sum + (cheque.chequeAmount || 0), 0),
    };
  }, [cheques]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cheques Management</h1>
          <p className="text-gray-600 mb-4">Track and manage all cheque payments</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Vouchers
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Cheques</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(stats.totalAmount)} KWD
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.outstanding}</div>
            <div className="text-sm text-gray-600">Outstanding</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(stats.outstandingAmount)} KWD
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-green-600">{stats.cashed}</div>
            <div className="text-sm text-gray-600">Cashed</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(stats.cashedAmount)} KWD
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-4">
            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Cheques
              </label>
              <input
                type="text"
                placeholder="Search by bank, cheque no, account name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="outstanding">Outstanding</option>
                <option value="cashed">Cashed</option>
                <option value="all">All Cheques</option>
              </select>
            </div>

            {/* Bank Filter */}
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank
              </label>
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All Banks</option>
                {banks.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>

            {/* Sort Option */}
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="chequeDate">Cheque Date (Oldest First)</option>
                <option value="chequeDateDesc">Cheque Date (Newest First)</option>
                <option value="amount">Amount (Low to High)</option>
                <option value="amountDesc">Amount (High to Low)</option>
                <option value="bank">Bank Name (A-Z)</option>
                <option value="account">Account No (Asc)</option>
              </select>
            </div>

            {/* Reset Button */}
            <div>
              <button
                onClick={resetFilters}
                className="w-full lg:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {filteredAndSortedCheques.length} of {cheques.length} cheques
            </p>
            {(searchTerm || statusFilter !== "outstanding" || bankFilter) && (
              <p className="text-sm text-blue-600 font-medium">
                Filters Active
              </p>
            )}
          </div>
        </div>

        {/* Cheques Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedCheques.map((cheque) => {
            const status = getChequeStatus(cheque);
            
            return (
              <div key={cheque.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl">
                {/* Header */}
                <div className={`px-6 py-4 ${
                  status.status === "cashed" ? "bg-green-500" : "bg-blue-500"
                } text-white`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{cheque.bankName}</h3>
                      <p className="text-blue-100 text-sm">{cheque.branch}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      status.status === "cashed" 
                        ? "bg-green-600 text-white" 
                        : "bg-amber-500 text-white"
                    }`}>
                      {status.status === "cashed" ? "CASHED" : "OUTSTANDING"}
                    </span>
                  </div>
                </div>

                {/* Cheque Details */}
                <div className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cheque No:</span>
                      <span className="font-mono font-semibold">{cheque.chequeNo}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cheque Date:</span>
                      <span className="font-medium">{formatDate(cheque.chequeDate || cheque.date)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Amount:</span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(cheque.chequeAmount || 0)} KWD
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Account:</span>
                      <span className="text-sm font-medium text-right">
                        {cheque.account.accountNo} - {cheque.account.name}
                      </span>
                    </div>

                    {/* Status Information */}
                    <div className="mt-4 p-3 rounded-lg bg-gray-50">
                      {status.status === "cashed" ? (
                        <div className="text-center">
                          <p className="text-sm text-green-600 font-medium">Cashed</p>
                          <p className="text-xs text-gray-600">
                            Cashed after {status.days} day{status.days !== 1 ? 's' : ''}
                          </p>
                          {cheque.cashedDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              on {formatDate(cheque.cashedDate)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {status.canBeCashed ? "Ready to Cash" : "Not Yet Cashable"}
                          </p>
                          <p className="text-xs text-gray-600">
                            {status.canBeCashed 
                              ? `${status.days} day${status.days !== 1 ? 's' : ''} passed`
                              : `${status.daysUntilCashable} day${status.daysUntilCashable !== 1 ? 's' : ''} until cashable`
                            }
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    {status.status === "outstanding" && status.canBeCashed && (
                      <button
                        onClick={() => handleCashCheque(cheque.id)}
                        disabled={isCashing === cheque.id}
                        className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-green-400 transition-colors flex items-center justify-center"
                      >
                        {isCashing === cheque.id ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Cashing...
                          </>
                        ) : (
                          "Mark as Cashed"
                        )}
                      </button>
                    )}

                    {status.status === "outstanding" && !status.canBeCashed && (
                      <div className="w-full mt-4 bg-gray-300 text-gray-600 py-2 rounded-lg font-medium text-center">
                        Available in {status.daysUntilCashable} day{status.daysUntilCashable !== 1 ? 's' : ''}
                      </div>
                    )}

                    {status.status === "cashed" && (
                      <div className="w-full mt-4 bg-green-100 text-green-700 py-2 rounded-lg font-medium text-center">
                        Cheque Cashed
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t">
                  <p className="text-xs text-gray-500 text-center">
                    Voucher: {cheque.mvn || cheque.description} • {formatDate(cheque.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredAndSortedCheques.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No cheques found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== "outstanding" || bankFilter 
                ? "Try adjusting your search or filters" 
                : "No cheques have been recorded yet."}
            </p>
            <div className="mt-6">
              <Link
                href="/vouchers/create"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700"
              >
                Create Voucher
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}