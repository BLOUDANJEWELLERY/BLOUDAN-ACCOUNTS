// pages/vouchers/list.tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type Voucher = {
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
  account: {
    accountNo: number;
    name: string;
    type: string;
  };
};

type Account = {
  id: string;
  accountNo: number;
  name: string;
  type: string;
};

type Props = {
  vouchers: Voucher[];
  accounts: Account[];
};

export const getServerSideProps: GetServerSideProps = async () => {
  const vouchers = await prisma.voucher.findMany({ 
    orderBy: { date: "desc" },
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
  
  const accounts = await prisma.account.findMany({
    select: { id: true, accountNo: true, name: true, type: true },
    orderBy: { accountNo: "asc" },
  });

  return {
    props: {
      vouchers: JSON.parse(JSON.stringify(vouchers)),
      accounts: JSON.parse(JSON.stringify(accounts)),
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

// Get voucher type color
const getVoucherTypeColor = (vt: string) => {
  switch (vt) {
    case 'INV': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    case 'REC': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    case 'GFV': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    case 'Alloy': return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
  }
};

// Get balance color
const getBalanceColor = (balance: number) => {
  if (balance > 0) return 'text-blue-700';
  if (balance < 0) return 'text-red-600';
  return 'text-gray-600';
};

export default function VouchersListPage({ vouchers: initialVouchers, accounts }: Props) {
  const [vouchers] = useState<Voucher[]>(initialVouchers);
  const router = useRouter();

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [accountNoFilter, setAccountNoFilter] = useState("");
  const [sortOption, setSortOption] = useState("newest");

  // Get unique account types for filter dropdown
  const accountTypes = useMemo(() => {
    return [...new Set(accounts.map(account => account.type))].sort();
  }, [accounts]);

  // Filter and sort vouchers
  const filteredAndSortedVouchers = useMemo(() => {
    let filtered = vouchers.filter(voucher => {
      // Search term filter (date, mvn, description, account name)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        voucher.date.toLowerCase().includes(searchLower) ||
        (voucher.mvn && voucher.mvn.toLowerCase().includes(searchLower)) ||
        (voucher.description && voucher.description.toLowerCase().includes(searchLower)) ||
        voucher.account.name.toLowerCase().includes(searchLower) ||
        voucher.account.accountNo.toString().includes(searchTerm);

      // Account type filter
      const matchesType = 
        !accountTypeFilter || 
        voucher.account.type === accountTypeFilter;

      // Account number filter
      const matchesAccountNo = 
        !accountNoFilter || 
        voucher.account.accountNo.toString().includes(accountNoFilter);

      return matchesSearch && matchesType && matchesAccountNo;
    });

    // Sort the filtered results
    switch (sortOption) {
      case "newest":
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case "oldest":
        filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "accountNo":
        filtered.sort((a, b) => a.account.accountNo - b.account.accountNo);
        break;
      case "accountNoDesc":
        filtered.sort((a, b) => b.account.accountNo - a.account.accountNo);
        break;
      case "description":
        filtered.sort((a, b) => {
          const descA = a.description || a.mvn || "";
          const descB = b.description || b.mvn || "";
          return descA.localeCompare(descB);
        });
        break;
      case "descriptionDesc":
        filtered.sort((a, b) => {
          const descA = a.description || a.mvn || "";
          const descB = b.description || b.mvn || "";
          return descB.localeCompare(descA);
        });
        break;
      case "gold":
        filtered.sort((a, b) => a.gold - b.gold);
        break;
      case "goldDesc":
        filtered.sort((a, b) => b.gold - a.gold);
        break;
      case "kwd":
        filtered.sort((a, b) => a.kwd - b.kwd);
        break;
      case "kwdDesc":
        filtered.sort((a, b) => b.kwd - a.kwd);
        break;
      case "type":
        filtered.sort((a, b) => a.vt.localeCompare(b.vt));
        break;
      case "typeDesc":
        filtered.sort((a, b) => b.vt.localeCompare(a.vt));
        break;
      default:
        break;
    }

    return filtered;
  }, [vouchers, searchTerm, accountTypeFilter, accountNoFilter, sortOption]);

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setAccountTypeFilter("");
    setAccountNoFilter("");
    setSortOption("newest");
  };

  const handleEdit = (id: string) => {
    router.push(`/vouchers/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this voucher?")) return;
    
    const res = await fetch(`/api/vouchers/${id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Error deleting voucher");
    }
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            All Vouchers
          </h1>
          <p className="text-xl text-blue-700 mb-6">Manage and edit your vouchers</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/vouchers/create" 
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl font-medium hover:from-blue-700 hover:to-blue-900 transition-colors shadow-xl hover:shadow-2xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Vouchers
            </Link>
            <Link 
              href="/" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-2xl font-medium bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300">
          <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-800">Search & Filter Vouchers</h2>
            <p className="text-sm text-blue-700 mt-1">Find vouchers by various criteria</p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-6 mb-6">
            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Search Vouchers
              </label>
              <input
                type="text"
                placeholder="Search by date, MVN, description, or account name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
              />
            </div>

            {/* Account Type Filter */}
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Account Type
              </label>
              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
              >
                <option value="">All Types</option>
                {accountTypes.map(type => {
                  const typeColor = getTypeColor(type);
                  return (
                    <option key={type} value={type} className={typeColor.text}>
                      {type}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Account Number Filter */}
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Account Number
              </label>
              <input
                type="text"
                placeholder="Filter by account no..."
                value={accountNoFilter}
                onChange={(e) => setAccountNoFilter(e.target.value)}
                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
              />
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
                <optgroup label="Date" className="text-blue-700">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </optgroup>
                <optgroup label="Account" className="text-blue-700">
                  <option value="accountNo">Account No (Asc)</option>
                  <option value="accountNoDesc">Account No (Desc)</option>
                </optgroup>
                <optgroup label="Description" className="text-blue-700">
                  <option value="description">Description (A-Z)</option>
                  <option value="descriptionDesc">Description (Z-A)</option>
                </optgroup>
                <optgroup label="Amount" className="text-blue-700">
                  <option value="gold">Gold (Low to High)</option>
                  <option value="goldDesc">Gold (High to Low)</option>
                  <option value="kwd">KWD (Low to High)</option>
                  <option value="kwdDesc">KWD (High to Low)</option>
                </optgroup>
                <optgroup label="Type" className="text-blue-700">
                  <option value="type">Voucher Type (A-Z)</option>
                  <option value="typeDesc">Voucher Type (Z-A)</option>
                </optgroup>
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
              Showing {filteredAndSortedVouchers.length} of {vouchers.length} vouchers
            </p>
            {(searchTerm || accountTypeFilter || accountNoFilter) && (
              <div className="flex items-center mt-2 sm:mt-0">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
                <p className="text-sm font-medium text-blue-700">
                  Filters Active
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Filtered Vouchers</p>
                <p className="text-2xl font-bold text-blue-800">{filteredAndSortedVouchers.length}</p>
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
                <p className="text-sm font-medium text-blue-700">Total Gold</p>
                <p className="text-2xl font-bold text-blue-800">
                  {formatCurrency(filteredAndSortedVouchers.reduce((sum, v) => sum + v.gold, 0))}
                </p>
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
                <p className="text-sm font-medium text-blue-700">Total KWD</p>
                <p className="text-2xl font-bold text-blue-800">
                  {formatCurrency(filteredAndSortedVouchers.reduce((sum, v) => sum + v.kwd, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Accounts Used</p>
                <p className="text-2xl font-bold text-blue-800">
                  {[...new Set(filteredAndSortedVouchers.map(v => v.accountId))].length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Vouchers Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden mb-8 border-2 border-blue-300">
          <div className="px-6 py-4 border-b-2 border-blue-300 bg-blue-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-800">Voucher Records</h2>
                <p className="text-sm text-blue-700 mt-1">
                  {sortOption === 'newest' ? 'Sorted by: Newest First' :
                   sortOption === 'oldest' ? 'Sorted by: Oldest First' :
                   sortOption === 'accountNo' ? 'Sorted by: Account No (Asc)' :
                   sortOption === 'accountNoDesc' ? 'Sorted by: Account No (Desc)' :
                   sortOption === 'description' ? 'Sorted by: Description (A-Z)' :
                   sortOption === 'descriptionDesc' ? 'Sorted by: Description (Z-A)' :
                   sortOption === 'gold' ? 'Sorted by: Gold (Low to High)' :
                   sortOption === 'goldDesc' ? 'Sorted by: Gold (High to Low)' :
                   sortOption === 'kwd' ? 'Sorted by: KWD (Low to High)' :
                   sortOption === 'kwdDesc' ? 'Sorted by: KWD (High to Low)' :
                   sortOption === 'type' ? 'Sorted by: Voucher Type (A-Z)' :
                   'Sorted by: Voucher Type (Z-A)'}
                </p>
              </div>
              <div className="flex items-center mt-2 sm:mt-0">
                <div className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                  {filteredAndSortedVouchers.length} records
                </div>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-blue-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Account Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider">Gold</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-blue-800 uppercase tracking-wider">KWD</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-800 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-300">
                {filteredAndSortedVouchers.map((voucher) => {
                  const typeColor = getTypeColor(voucher.account.type);
                  const voucherTypeColor = getVoucherTypeColor(voucher.vt);
                  const goldColor = getBalanceColor(voucher.gold);
                  const kwdColor = getBalanceColor(voucher.kwd);
                  
                  return (
                    <tr key={voucher.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-900">{formatDate(voucher.date)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-blue-900 max-w-xs">
                          <div className="font-medium">{voucher.mvn || voucher.description}</div>
                          {voucher.mvn && voucher.description && (
                            <div className="text-xs text-blue-500 mt-1">{voucher.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${voucherTypeColor.bg} ${voucherTypeColor.text} border ${voucherTypeColor.border}`}>
                          {voucher.vt}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full ${typeColor.bg} mr-2`}></div>
                          <div>
                            <div className="text-sm font-medium text-blue-900">{voucher.account.name}</div>
                            <div className="text-xs text-blue-600">#{voucher.account.accountNo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${typeColor.lightBg} ${typeColor.text} border ${typeColor.border}`}>
                          {voucher.account.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${goldColor}`}>{formatCurrency(voucher.gold)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${kwdColor}`}>{formatCurrency(voucher.kwd)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(voucher.id)}
                            className="inline-flex items-center px-3 py-1 border-2 border-blue-300 text-xs font-medium rounded-xl text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(voucher.id)}
                            className="inline-flex items-center px-3 py-1 border-2 border-red-300 text-xs font-medium rounded-xl text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredAndSortedVouchers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 text-blue-400">📊</div>
              <h3 className="text-lg font-medium text-blue-800">No vouchers found</h3>
              <p className="text-blue-600 mt-1">
                {searchTerm || accountTypeFilter || accountNoFilter 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating a new voucher."}
              </p>
              <div className="mt-6">
                <Link
                  href="/vouchers/create"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl hover:from-blue-700 hover:to-blue-900 transition-colors shadow-lg"
                >
                  Create Voucher
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Summary Card */}
        {filteredAndSortedVouchers.length > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-2xl border-2 border-blue-400">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="mb-4 md:mb-0">
                <h3 className="text-xl font-bold">Vouchers Summary</h3>
                <p className="opacity-90">Showing results for: {
                  searchTerm ? `"${searchTerm}"` : 
                  accountTypeFilter ? `${accountTypeFilter} accounts` :
                  accountNoFilter ? `Account #${accountNoFilter}` :
                  "All vouchers"
                }</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="text-center sm:text-right">
                  <div className="text-lg font-bold">{formatCurrency(filteredAndSortedVouchers.reduce((sum, v) => sum + v.gold, 0))}</div>
                  <div className="text-xs opacity-80">Total Gold</div>
                </div>
                <div className="text-center sm:text-right">
                  <div className="text-lg font-bold">{formatCurrency(filteredAndSortedVouchers.reduce((sum, v) => sum + v.kwd, 0))}</div>
                  <div className="text-xs opacity-80">Total KWD</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}