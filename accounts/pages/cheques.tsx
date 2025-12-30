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

// Get account type color
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
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            Cheques Management
          </h1>
          <p className="text-xl text-blue-700 mb-6">Track and manage all cheque payments</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Vouchers
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total Cheques</p>
                <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
                <p className="text-xs text-blue-600 mt-1">{formatCurrency(stats.totalAmount)} KWD</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Outstanding</p>
                <p className="text-2xl font-bold text-blue-800">{stats.outstanding}</p>
                <p className="text-xs text-blue-600 mt-1">{formatCurrency(stats.outstandingAmount)} KWD</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Cashed</p>
                <p className="text-2xl font-bold text-blue-800">{stats.cashed}</p>
                <p className="text-xs text-blue-600 mt-1">{formatCurrency(stats.cashedAmount)} KWD</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300">
          <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-800">Search & Filter Cheques</h2>
            <p className="text-sm text-blue-700 mt-1">Find cheques by various criteria</p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-6 mb-6">
            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Search Cheques
              </label>
              <input
                type="text"
                placeholder="Search by bank, cheque no, account name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
              >
                <option value="outstanding">Outstanding</option>
                <option value="cashed">Cashed</option>
                <option value="all">All Cheques</option>
              </select>
            </div>

            {/* Bank Filter */}
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Bank
              </label>
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
              >
                <option value="">All Banks</option>
                {banks.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>

            {/* Sort Option */}
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Sort By
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
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
            <div className="w-full lg:w-auto">
              <button
                onClick={resetFilters}
                className="w-full px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-xl font-medium bg-white/80 hover:bg-blue-50 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-blue-600">
              Showing {filteredAndSortedCheques.length} of {cheques.length} cheques
            </p>
            {(searchTerm || statusFilter !== "outstanding" || bankFilter) && (
              <div className="flex items-center mt-2 sm:mt-0">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
                <p className="text-sm font-medium text-blue-700">
                  Filters Active
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cheques Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedCheques.map((cheque) => {
            const status = getChequeStatus(cheque);
            const typeColor = getTypeColor(cheque.account.type);
            
            return (
              <div key={cheque.id} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-300 transition-all hover:border-blue-500 hover:shadow-2xl">
                {/* Header */}
                <div className={`px-6 py-4 ${
                  status.status === "cashed" 
                    ? "bg-gradient-to-r from-green-500 to-green-600" 
                    : "bg-gradient-to-r from-blue-500 to-blue-600"
                } text-white`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{cheque.bankName}</h3>
                      <p className="text-blue-100 text-sm">{cheque.branch}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      status.status === "cashed" 
                        ? "bg-green-700 text-white" 
                        : "bg-amber-500 text-white"
                    }`}>
                      {status.status === "cashed" ? "CASHED" : "OUTSTANDING"}
                    </span>
                  </div>
                </div>

                {/* Cheque Details */}
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-600">Cheque No:</span>
                      <span className="font-mono font-semibold text-blue-800">{cheque.chequeNo}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-600">Cheque Date:</span>
                      <span className="font-medium text-blue-800">{formatDate(cheque.chequeDate || cheque.date)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-600">Amount:</span>
                      <span className="text-xl font-bold text-blue-800">
                        {formatCurrency(cheque.chequeAmount || 0)} KWD
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-600">Account:</span>
                      <div className="text-right">
                        <div className="flex items-center justify-end mb-1">
                          <div className={`w-3 h-3 rounded-full ${typeColor.bg} mr-2`}></div>
                          <span className="text-sm font-medium text-blue-800">{cheque.account.accountNo}</span>
                        </div>
                        <div className="text-xs text-blue-600">{cheque.account.name}</div>
                      </div>
                    </div>

                    {/* Status Information */}
                    <div className="mt-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-300">
                      {status.status === "cashed" ? (
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-2">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-green-700">Cashed</p>
                          </div>
                          <p className="text-xs text-blue-600">
                            Cashed after {status.days} day{status.days !== 1 ? 's' : ''}
                          </p>
                          {cheque.cashedDate && (
                            <p className="text-xs text-blue-500 mt-1">
                              on {formatDate(cheque.cashedDate)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-2">
                            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center mr-2">
                              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className={`text-sm font-semibold ${status.canBeCashed ? "text-green-700" : "text-amber-700"}`}>
                              {status.canBeCashed ? "Ready to Cash" : "Not Yet Cashable"}
                            </p>
                          </div>
                          <p className="text-xs text-blue-600">
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
                        className="w-full mt-4 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-2xl font-medium hover:from-green-700 hover:to-green-800 disabled:from-green-400 disabled:to-green-500 transition-colors shadow-lg hover:shadow-xl flex items-center justify-center"
                      >
                        {isCashing === cheque.id ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Cashing...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Mark as Cashed
                          </>
                        )}
                      </button>
                    )}

                    {status.status === "outstanding" && !status.canBeCashed && (
                      <div className="w-full mt-4 bg-blue-100 text-blue-700 py-3 rounded-2xl font-medium text-center border-2 border-blue-300">
                        <div className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Available in {status.daysUntilCashable} day{status.daysUntilCashable !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}

                    {status.status === "cashed" && (
                      <div className="w-full mt-4 bg-green-100 text-green-700 py-3 rounded-2xl font-medium text-center border-2 border-green-300">
                        <div className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Cheque Cashed
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-blue-50 border-t-2 border-blue-300">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-blue-600">
                      {cheque.mvn || cheque.description}
                    </p>
                    <span className="text-xs text-blue-500 font-medium">
                      {formatDate(cheque.date)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredAndSortedCheques.length === 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 text-center border-2 border-blue-300">
            <div className="text-6xl mb-4 text-blue-400">💳</div>
            <h3 className="text-lg font-medium text-blue-800">No cheques found</h3>
            <p className="text-blue-600 mt-1">
              {searchTerm || statusFilter !== "outstanding" || bankFilter 
                ? "Try adjusting your search or filters" 
                : "No cheques have been recorded yet."}
            </p>
            <div className="mt-6">
              <Link
                href="/vouchers/create"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl hover:from-blue-700 hover:to-blue-900 transition-colors shadow-lg"
              >
                Create Voucher with Cheque
              </Link>
            </div>
          </div>
        )}

        {/* Summary Card */}
        {filteredAndSortedCheques.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-2xl border-2 border-blue-400">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="mb-4 md:mb-0">
                <h3 className="text-xl font-bold">Cheques Summary</h3>
                <p className="opacity-90">
                  {statusFilter === "outstanding" ? "Outstanding Cheques" :
                   statusFilter === "cashed" ? "Cashed Cheques" :
                   "All Cheques"}
                  {bankFilter && ` • ${bankFilter}`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
                <div className="text-center sm:text-right">
                  <div className="text-lg font-bold">{filteredAndSortedCheques.length}</div>
                  <div className="text-xs opacity-80">Cheques</div>
                </div>
                <div className="text-center sm:text-right">
                  <div className="text-lg font-bold">
                    {formatCurrency(filteredAndSortedCheques.reduce((sum, cheque) => sum + (cheque.chequeAmount || 0), 0))}
                  </div>
                  <div className="text-xs opacity-80">Total Amount</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}