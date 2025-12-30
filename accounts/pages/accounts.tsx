import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useEffect } from "react";
import Link from "next/link";

type Account = {
  id: string;
  accountNo: number;
  name: string;
  type: string;
  phone?: string;
  crOrCivilIdNo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = { accounts: Account[] };

export const getServerSideProps: GetServerSideProps = async () => {
  const accounts = await prisma.account.findMany({ 
    orderBy: { accountNo: "asc" }
  });
  return { props: { accounts: JSON.parse(JSON.stringify(accounts)) } };
};

// Get account type color function
const getTypeColor = (type: string) => {
  const colors = {
    Market: {
      bg: 'bg-blue-500',
      lightBg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      gradient: 'from-blue-500 to-blue-600',
      dot: 'bg-blue-500',
    },
    Casting: {
      bg: 'bg-purple-500',
      lightBg: 'bg-purple-50',
      text: 'text-purple-800',
      border: 'border-purple-200',
      gradient: 'from-purple-500 to-purple-600',
      dot: 'bg-purple-500',
    },
    Faceting: {
      bg: 'bg-amber-500',
      lightBg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      gradient: 'from-amber-500 to-amber-600',
      dot: 'bg-amber-500',
    },
    Project: {
      bg: 'bg-emerald-500',
      lightBg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      gradient: 'from-emerald-500 to-emerald-600',
      dot: 'bg-emerald-500',
    },
    'Gold Fixing': {
      bg: 'bg-yellow-500',
      lightBg: 'bg-yellow-50',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      gradient: 'from-yellow-500 to-yellow-600',
      dot: 'bg-yellow-500',
    },
  };
  return colors[type as keyof typeof colors] || {
    bg: 'bg-gray-500',
    lightBg: 'bg-gray-50',
    text: 'text-gray-800',
    border: 'border-gray-200',
    gradient: 'from-gray-500 to-gray-600',
    dot: 'bg-gray-500',
  };
};

export default function AccountsPage({ accounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [form, setForm] = useState<Partial<Account>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState({ type: "", search: "", status: "active" });
  const [sortBy, setSortBy] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'type',
    direction: 'asc'
  });

  // Predefined types only
  const predefinedTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  // Auto-number new accounts by type
  useEffect(() => {
    if (editingId) return;
    const type = form.type?.trim();
    if (!type) return;

    const filtered = accounts.filter(
      (acc) => acc.type.toLowerCase() === type.toLowerCase() && acc.isActive
    );
    const nextNo = filtered.length > 0
      ? Math.max(...filtered.map((a) => a.accountNo)) + 1
      : 1;
    setForm((prev) => ({ ...prev, accountNo: nextNo }));
  }, [form.type, accounts, editingId]);

  // Handle Submit (Create / Update)
  const handleSubmit = async () => {
    if (!form.name || !form.type) return alert("Name and Type are required.");

    setIsSubmitting(true);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/accounts/${editingId}` : "/api/accounts";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          isActive: true
        }),
      });

      if (!res.ok) return alert("Error saving account");

      const updated = await res.json();
      if (editingId) {
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setEditingId(null);
      } else {
        setAccounts((prev) => [...prev, updated]);
      }
      setForm({});
      alert(editingId ? "Account updated successfully!" : "Account created successfully!");
    } catch (error) {
      alert("Error saving account");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Close Account
  const handleCloseAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to close this account? This will prevent any new transactions.")) {
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      if (!res.ok) return alert("Error closing account");

      const updated = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      alert("Account closed successfully!");
    } catch (error) {
      alert("Error closing account");
    }
  };

  // Handle Reopen Account
  const handleReopenAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (!res.ok) return alert("Error reopening account");

      const updated = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      alert("Account reopened successfully!");
    } catch (error) {
      alert("Error reopening account");
    }
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setForm(acc);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  // Filtering logic
  const filteredAccounts = accounts.filter((acc) => {
    const matchesType = filter.type
      ? acc.type.toLowerCase() === filter.type.toLowerCase()
      : true;

    const matchesStatus = filter.status === "all" 
      ? true 
      : filter.status === "active" 
        ? acc.isActive 
        : !acc.isActive;

    const searchTerm = filter.search.toLowerCase();
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm) ||
      acc.phone?.toLowerCase().includes(searchTerm);

    return matchesType && matchesStatus && matchesSearch;
  });

  // Sorting logic
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    let aValue: any = a[sortBy.field as keyof Account];
    let bValue: any = b[sortBy.field as keyof Account];
    
    if (aValue === undefined || aValue === null) aValue = '';
    if (bValue === undefined || bValue === null) bValue = '';
    
    if (sortBy.field === 'type') {
      if (a.type !== b.type) {
        const result = a.type.localeCompare(b.type);
        return sortBy.direction === 'asc' ? result : -result;
      }
      return a.accountNo - b.accountNo;
    }
    
    if (sortBy.field === 'accountNo') {
      return sortBy.direction === 'asc' 
        ? a.accountNo - b.accountNo 
        : b.accountNo - a.accountNo;
    }
    
    if (sortBy.field === 'name') {
      const result = a.name.localeCompare(b.name);
      return sortBy.direction === 'asc' ? result : -result;
    }
    
    if (sortBy.field === 'createdAt') {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortBy.direction === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (aValue < bValue) return sortBy.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortBy.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Statistics
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(a => a.isActive).length;
  const closedAccounts = accounts.filter(a => !a.isActive).length;
  
  const accountsByType = predefinedTypes.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.type === type && a.isActive).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            Account Management
          </h1>
          <p className="text-xl text-blue-700 mb-6">Create and manage your business accounts</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </Link>
            <Link 
              href="/balance-sheet/type-summary" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Type Summary
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total Accounts</p>
                <p className="text-2xl font-bold text-blue-800">{totalAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Active Accounts</p>
                <p className="text-2xl font-bold text-blue-800">{activeAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Closed Accounts</p>
                <p className="text-2xl font-bold text-blue-800">{closedAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Account Types</p>
                <p className="text-2xl font-bold text-blue-800">{predefinedTypes.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Account Form Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border-2 border-blue-300">
            <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-blue-800">
                  {editingId ? "Edit Account" : "Create New Account"}
                </h2>
                {editingId && (
                  <button
                    onClick={handleCancel}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Account Number
                </label>
                <input
                  type="number"
                  placeholder="Auto-generated"
                  value={form.accountNo ?? ""}
                  disabled
                  className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 bg-blue-100 text-blue-600 cursor-not-allowed text-base"
                />
                <p className="text-sm text-blue-500 mt-2">Automatically generated based on account type</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter account name"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Account Type *
                </label>
                <select
                  value={form.type ?? ""}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                >
                  <option value="">Select Type</option>
                  {predefinedTypes.map((t) => {
                    const typeColor = getTypeColor(t);
                    return (
                      <option key={t} value={t} className={typeColor.text}>
                        {t}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter phone number"
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    C.R / Civil ID No
                  </label>
                  <input
                    type="text"
                    placeholder="Enter ID number"
                    value={form.crOrCivilIdNo ?? ""}
                    onChange={(e) => setForm({ ...form, crOrCivilIdNo: e.target.value })}
                    className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.name || !form.type || isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {editingId ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingId ? "Update Account" : "Create Account"
                )}
              </button>
            </div>
          </div>

          {/* Accounts List Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border-2 border-blue-300">
            <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
              <h2 className="text-xl font-semibold text-blue-800">All Accounts</h2>
              <p className="text-sm text-blue-700 mt-1">Manage and view all accounts</p>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
              {/* Filters and Sort */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">Status</label>
                  <select
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="border-2 border-blue-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white/80"
                  >
                    <option value="active">Active Accounts</option>
                    <option value="closed">Closed Accounts</option>
                    <option value="all">All Accounts</option>
                  </select>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">Type</label>
                  <select
                    value={filter.type}
                    onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                    className="border-2 border-blue-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white/80"
                  >
                    <option value="">All Types</option>
                    {predefinedTypes.map((t) => {
                      const typeColor = getTypeColor(t);
                      return (
                        <option key={t} value={t} className={typeColor.text}>
                          {t}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    className="border-2 border-blue-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white/80 min-w-[200px]"
                  />
                </div>
              </div>

              {/* Sort Options */}
              <div className="mt-4 sm:mt-0">
                <label className="block text-sm font-medium text-blue-700 mb-2">Sort By</label>
                <select
                  value={`${sortBy.field}-${sortBy.direction}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split('-');
                    setSortBy({ field, direction: direction as 'asc' | 'desc' });
                  }}
                  className="border-2 border-blue-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white/80"
                >
                  <option value="type-asc">Type: A to Z</option>
                  <option value="type-desc">Type: Z to A</option>
                  <option value="accountNo-asc">Account No: Low to High</option>
                  <option value="accountNo-desc">Account No: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                  <option value="createdAt-desc">Recently Created</option>
                  <option value="createdAt-asc">Oldest First</option>
                </select>
              </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto p-2">
              {sortedAccounts.map((acc) => {
                const typeColor = getTypeColor(acc.type);
                
                return (
                  <div key={acc.id} className={`border-2 ${acc.isActive ? 'border-blue-300' : 'border-gray-300'} rounded-2xl p-4 hover:border-blue-500 hover:shadow-lg transition-all ${!acc.isActive ? 'bg-gray-50/80' : 'bg-white/80'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base ${acc.isActive ? `bg-gradient-to-r ${typeColor.gradient}` : 'bg-gradient-to-r from-gray-400 to-gray-600'}`}>
                          {acc.accountNo}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className={`font-semibold ${!acc.isActive ? 'text-gray-600' : 'text-blue-900'}`}>
                              {acc.name}
                            </h3>
                            <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${acc.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                              {acc.isActive ? 'Active' : 'Closed'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${typeColor.lightBg} ${typeColor.text} border ${typeColor.border}`}>
                              {acc.type}
                            </span>
                            {acc.phone && (
                              <span className={`text-sm ${!acc.isActive ? 'text-gray-500' : 'text-blue-600'} flex items-center`}>
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {acc.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {acc.isActive ? (
                          <>
                            <button
                              onClick={() => handleEdit(acc)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors border border-blue-300"
                              title="Edit Account"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            
                            <Link
                              href={`/balance-sheet/${acc.id}?accountType=${encodeURIComponent(acc.type)}`}
                              className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-300"
                              title="View Ledger"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </Link>
                            
                            <button
                              onClick={() => handleCloseAccount(acc.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors border border-red-300"
                              title="Close Account"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReopenAccount(acc.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-300"
                              title="Reopen Account"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            
                            <Link
                              href={`/balance-sheet/${acc.id}?accountType=${encodeURIComponent(acc.type)}`}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-300"
                              title="View Ledger"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {acc.crOrCivilIdNo && (
                      <div className={`mt-3 text-sm ${!acc.isActive ? 'text-gray-500' : 'text-blue-600'} flex items-center`}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9a2 2 0 10-4 0v5a2 2 0 01-2 2h6m-6-4h4m8 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ID: {acc.crOrCivilIdNo}
                      </div>
                    )}
                  </div>
                );
              })}

              {sortedAccounts.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 text-blue-400">👤</div>
                  <h3 className="text-lg font-medium text-blue-800">No accounts found</h3>
                  <p className="text-blue-600 mt-1">
                    {filter.search || filter.type ? "Try adjusting your search filters" : "Get started by creating a new account"}
                  </p>
                  {!filter.search && !filter.type && (
                    <div className="mt-6">
                      <button
                        onClick={() => setForm({})}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl hover:from-blue-700 hover:to-blue-900 transition-colors shadow-lg"
                      >
                        Create Account
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Statistics */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300">
          <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-800">Account Statistics</h2>
            <p className="text-sm text-blue-700 mt-1">Overview of account distribution</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="text-center p-6 border-2 border-blue-300 rounded-2xl bg-white/80">
              <div className="text-3xl font-bold text-blue-800 mb-2">{totalAccounts}</div>
              <div className="text-sm text-blue-700">Total Accounts</div>
            </div>
            <div className="text-center p-6 border-2 border-blue-300 rounded-2xl bg-white/80">
              <div className="text-3xl font-bold text-blue-800 mb-2">{activeAccounts}</div>
              <div className="text-sm text-blue-700">Active Accounts</div>
            </div>
            <div className="text-center p-6 border-2 border-blue-300 rounded-2xl bg-white/80">
              <div className="text-3xl font-bold text-blue-800 mb-2">{closedAccounts}</div>
              <div className="text-sm text-blue-700">Closed Accounts</div>
            </div>
            <div className="text-center p-6 border-2 border-blue-300 rounded-2xl bg-white/80">
              <div className="text-3xl font-bold text-blue-800 mb-2">
                {totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0}%
              </div>
              <div className="text-sm text-blue-700">Active Rate</div>
            </div>
            <div className="text-center p-6 border-2 border-blue-300 rounded-2xl bg-white/80">
              <div className="text-3xl font-bold text-blue-800 mb-2">{predefinedTypes.length}</div>
              <div className="text-sm text-blue-700">Account Types</div>
            </div>
          </div>
        </div>

        {/* Account Type Distribution */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border-2 border-blue-300">
          <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-800">Account Type Distribution</h2>
            <p className="text-sm text-blue-700 mt-1">Active accounts by type</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {predefinedTypes.map((type) => {
              const typeColor = getTypeColor(type);
              const count = accountsByType[type] || 0;
              
              return (
                <div key={type} className={`p-5 rounded-2xl border-2 ${typeColor.border} ${typeColor.lightBg}`}>
                  <div className="flex items-center mb-3">
                    <div className={`w-3 h-3 rounded-full ${typeColor.dot} mr-2`}></div>
                    <h3 className={`font-semibold ${typeColor.text}`}>{type}</h3>
                  </div>
                  <div className="text-2xl font-bold text-blue-800">{count}</div>
                  <div className="text-sm text-blue-600">active account{count !== 1 ? 's' : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}