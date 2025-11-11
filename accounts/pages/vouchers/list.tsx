import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useMemo } from "react";
import Link from "next/link";

type Voucher = {
  id: string;
  date: string;
  mvn?: string | null;
  description?: string | null;
  vt: string;
  accountId: string;
  gold: number;
  kwd: number;
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

export default function VouchersListPage({ vouchers: initialVouchers, accounts }: Props) {
  const [vouchers] = useState<Voucher[]>(initialVouchers);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
  };

  const handleCancelEdit = () => {
    setEditingVoucher(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucher) return;

    setIsSubmitting(true);
    try {
      const payload = {
        date: editingVoucher.date,
        vt: editingVoucher.vt,
        accountId: editingVoucher.accountId,
        gold: editingVoucher.gold,
        kwd: editingVoucher.kwd,
        mvn: editingVoucher.mvn,
        description: editingVoucher.description,
      };

      const res = await fetch(`/api/vouchers/${editingVoucher.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        return alert(errorData?.message || "Error updating voucher");
      }

      const updated = await res.json();
      // Update the local state with the updated voucher
      const updatedVouchers = vouchers.map(v => v.id === updated.id ? { ...updated, account: editingVoucher.account } : v);
      // Note: Since we're using initialVouchers prop and local state, we need to refresh the page to see changes
      // In a real app, you might want to use a state management solution
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Error updating voucher");
    } finally {
      setIsSubmitting(false);
    }
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
    return value.toFixed(3);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Vouchers</h1>
          <p className="text-gray-600 mb-4">Manage and edit your vouchers</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link 
              href="/vouchers/create" 
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Vouchers
            </Link>
            <Link 
              href="/" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl bg-white hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-4">
            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Vouchers
              </label>
              <input
                type="text"
                placeholder="Search by date, MVN, description, or account name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Account Type Filter */}
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Account Number Filter */}
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Number
              </label>
              <input
                type="text"
                placeholder="Filter by account no..."
                value={accountNoFilter}
                onChange={(e) => setAccountNoFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
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
                <optgroup label="Date">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </optgroup>
                <optgroup label="Account">
                  <option value="accountNo">Account No (Asc)</option>
                  <option value="accountNoDesc">Account No (Desc)</option>
                </optgroup>
                <optgroup label="Description">
                  <option value="description">Description (A-Z)</option>
                  <option value="descriptionDesc">Description (Z-A)</option>
                </optgroup>
                <optgroup label="Amount">
                  <option value="gold">Gold (Low to High)</option>
                  <option value="goldDesc">Gold (High to Low)</option>
                  <option value="kwd">KWD (Low to High)</option>
                  <option value="kwdDesc">KWD (High to Low)</option>
                </optgroup>
                <optgroup label="Type">
                  <option value="type">Voucher Type (A-Z)</option>
                  <option value="typeDesc">Voucher Type (Z-A)</option>
                </optgroup>
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
              Showing {filteredAndSortedVouchers.length} of {vouchers.length} vouchers
            </p>
            {(searchTerm || accountTypeFilter || accountNoFilter) && (
              <p className="text-sm text-blue-600 font-medium">
                Filters Active
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{filteredAndSortedVouchers.length}</div>
            <div className="text-sm text-gray-600">Filtered Vouchers</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredAndSortedVouchers.reduce((sum, v) => sum + v.gold, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Gold</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {filteredAndSortedVouchers.reduce((sum, v) => sum + v.kwd, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total KWD</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-amber-600">
              {[...new Set(filteredAndSortedVouchers.map(v => v.accountId))].length}
            </div>
            <div className="text-sm text-gray-600">Accounts Used</div>
          </div>
        </div>

        {/* Edit Modal */}
        {editingVoucher && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Voucher</h3>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={editingVoucher.date.split('T')[0]}
                      onChange={(e) => setEditingVoucher({...editingVoucher, date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={editingVoucher.vt}
                      onChange={(e) => setEditingVoucher({...editingVoucher, vt: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="REC">REC (Receipt)</option>
                      <option value="INV">INV (Invoice)</option>
                      <option value="GFV">GFV (Gold Fixing)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                    <select
                      value={editingVoucher.accountId}
                      onChange={(e) => setEditingVoucher({...editingVoucher, accountId: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.accountNo} - {account.name} ({account.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">MVN</label>
                    <input
                      type="text"
                      value={editingVoucher.mvn || ""}
                      onChange={(e) => setEditingVoucher({...editingVoucher, mvn: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Manual Voucher Number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={editingVoucher.description || ""}
                      onChange={(e) => setEditingVoucher({...editingVoucher, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Voucher description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gold</label>
                    <input
                      type="number"
                      step="0.001"
                      value={editingVoucher.gold}
                      onChange={(e) => setEditingVoucher({...editingVoucher, gold: parseFloat(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">KWD</label>
                    <input
                      type="number"
                      step="0.001"
                      value={editingVoucher.kwd}
                      onChange={(e) => setEditingVoucher({...editingVoucher, kwd: parseFloat(e.target.value) || 0})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                    >
                      {isSubmitting ? 'Updating...' : 'Update'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Vouchers Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Voucher Records</h2>
              <div className="mt-2 sm:mt-0 text-sm text-gray-600">
                Sorted by: {
                  sortOption === 'newest' ? 'Newest First' :
                  sortOption === 'oldest' ? 'Oldest First' :
                  sortOption === 'accountNo' ? 'Account No (Asc)' :
                  sortOption === 'accountNoDesc' ? 'Account No (Desc)' :
                  sortOption === 'description' ? 'Description (A-Z)' :
                  sortOption === 'descriptionDesc' ? 'Description (Z-A)' :
                  sortOption === 'gold' ? 'Gold (Low to High)' :
                  sortOption === 'goldDesc' ? 'Gold (High to Low)' :
                  sortOption === 'kwd' ? 'KWD (Low to High)' :
                  sortOption === 'kwdDesc' ? 'KWD (High to Low)' :
                  sortOption === 'type' ? 'Voucher Type (A-Z)' :
                  'Voucher Type (Z-A)'
                }
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KWD</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAndSortedVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatDate(voucher.date)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        <div className="font-medium">{voucher.mvn || voucher.description}</div>
                        {voucher.mvn && voucher.description && (
                          <div className="text-xs text-gray-500 mt-1">{voucher.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        voucher.vt === 'REC' 
                          ? 'bg-green-100 text-green-800' 
                          : voucher.vt === 'INV'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {voucher.vt}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">{voucher.account.name}</div>
                        <div className="text-xs text-gray-500">#{voucher.account.accountNo}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {voucher.account.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(voucher.gold)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(voucher.kwd)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(voucher)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(voucher.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedVouchers.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No vouchers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || accountTypeFilter || accountNoFilter 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating a new voucher."}
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
      </div>
    </main>
  );
}