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
  isActive: boolean;  // Added this field
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

  // Predefined types only - removed custom option
  const predefinedTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  // Auto-number new accounts by type
  useEffect(() => {
    if (editingId) return;
    const type = form.type?.trim();
    if (!type) return;

    // Count only active accounts of this type for numbering
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
          isActive: true // New accounts are always active
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
    
    // Handle undefined values
    if (aValue === undefined || aValue === null) aValue = '';
    if (bValue === undefined || bValue === null) bValue = '';
    
    // For type sorting, group by type then by account number
    if (sortBy.field === 'type') {
      if (a.type !== b.type) {
        const result = a.type.localeCompare(b.type);
        return sortBy.direction === 'asc' ? result : -result;
      }
      // Same type - sort by account number
      return a.accountNo - b.accountNo;
    }
    
    // For account number sorting
    if (sortBy.field === 'accountNo') {
      return sortBy.direction === 'asc' 
        ? a.accountNo - b.accountNo 
        : b.accountNo - a.accountNo;
    }
    
    // For name sorting
    if (sortBy.field === 'name') {
      const result = a.name.localeCompare(b.name);
      return sortBy.direction === 'asc' ? result : -result;
    }
    
    // For date sorting (createdAt only)
    if (sortBy.field === 'createdAt') {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortBy.direction === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    // Default string comparison
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

  // Get account type style (matching dashboard)
  const getAccountTypeStyle = (type: string) => {
    const colors = {
      Market: 'bg-blue-100 text-blue-800',
      Casting: 'bg-purple-100 text-purple-800',
      Faceting: 'bg-amber-100 text-amber-800',
      Project: 'bg-green-100 text-green-800',
      'Gold Fixing': 'bg-yellow-100 text-yellow-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get account status badge style
  const getAccountStatusStyle = (isActive: boolean) => {
    return isActive 
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      : 'bg-red-100 text-red-800 border border-red-200';
  };

  // Get account type dot color
  const getTypeDotColor = (type: string) => {
    return type === 'Market' ? 'bg-blue-500' :
           type === 'Casting' ? 'bg-purple-500' :
           type === 'Faceting' ? 'bg-amber-500' :
           type === 'Project' ? 'bg-green-500' :
           'bg-yellow-500';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">Account Management</h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">Create and manage your business accounts</p>
            <p className="text-lg opacity-80 max-w-3xl mx-auto">
              Organize all your jewellery business accounts, track customer information, and maintain complete records.
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
                <p className="text-2xl font-bold text-gray-900">{totalAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{activeAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Closed Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{closedAccounts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Account Types</p>
                <p className="text-2xl font-bold text-gray-900">{predefinedTypes.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Account Form Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Edit Account" : "Create New Account"}
              </h2>
              {editingId && (
                <button
                  onClick={handleCancel}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="number"
                  placeholder="Auto-generated"
                  value={form.accountNo ?? ""}
                  disabled
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Automatically generated based on account type</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter account name"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type *
                </label>
                <select
                  value={form.type ?? ""}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">Select Type</option>
                  {predefinedTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter phone number"
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    C.R / Civil ID No
                  </label>
                  <input
                    type="text"
                    placeholder="Enter ID number"
                    value={form.crOrCivilIdNo ?? ""}
                    onChange={(e) => setForm({ ...form, crOrCivilIdNo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.name || !form.type || isSubmitting}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {editingId ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingId ? "Update Account" : "Create Account"
                )}
              </button>
            </div>
          </div>

          {/* Accounts List Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">All Accounts</h2>
              
              {/* Filters and Sort */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Status Filter */}
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="active">Active Accounts</option>
                  <option value="closed">Closed Accounts</option>
                  <option value="all">All Accounts</option>
                </select>

                {/* Type Filter */}
                <select
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">All Types</option>
                  {predefinedTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-w-[200px]"
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="mb-4">
              <select
                value={`${sortBy.field}-${sortBy.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-');
                  setSortBy({ field, direction: direction as 'asc' | 'desc' });
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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

            {/* Accounts List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sortedAccounts.map((acc) => (
                <div key={acc.id} className={`border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all ${!acc.isActive ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${
                        acc.type === 'Market' ? 'from-blue-400 to-blue-600' :
                        acc.type === 'Casting' ? 'from-purple-400 to-purple-600' :
                        acc.type === 'Faceting' ? 'from-amber-400 to-amber-600' :
                        acc.type === 'Project' ? 'from-green-400 to-green-600' :
                        'from-yellow-400 to-yellow-600'
                      } rounded-lg flex items-center justify-center text-white font-bold text-sm ${!acc.isActive ? 'opacity-70' : ''}`}>
                        {acc.accountNo}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className={`font-semibold ${!acc.isActive ? 'text-gray-500' : 'text-gray-900'}`}>
                            {acc.name}
                            {!acc.isActive && <span className="ml-2 text-xs text-gray-400">(Closed)</span>}
                          </h3>
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getAccountStatusStyle(acc.isActive)}`}>
                            {acc.isActive ? 'Active' : 'Closed'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getAccountTypeStyle(acc.type)} ${!acc.isActive ? 'opacity-70' : ''}`}>
                            {acc.type}
                          </span>
                          {acc.phone && (
                            <span className={`text-xs ${!acc.isActive ? 'text-gray-400' : 'text-gray-500'} flex items-center`}>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Account"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <Link
                            href={`/balance-sheet/${acc.id}?accountType=${encodeURIComponent(acc.type)}`}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="View Ledger"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </Link>
                          
                          <button
                            onClick={() => handleCloseAccount(acc.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Close Account"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReopenAccount(acc.id)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Reopen Account"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          
                          <Link
                            href={`/balance-sheet/${acc.id}?accountType=${encodeURIComponent(acc.type)}`}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="View Ledger"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {acc.crOrCivilIdNo && (
                    <div className={`mt-2 text-xs ${!acc.isActive ? 'text-gray-400' : 'text-gray-500'} flex items-center`}>
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9a2 2 0 10-4 0v5a2 2 0 01-2 2h6m-6-4h4m8 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ID: {acc.crOrCivilIdNo}
                    </div>
                  )}
                </div>
              ))}

              {sortedAccounts.length === 0 && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {filter.search || filter.type ? "Try adjusting your search filters" : "Get started by creating a new account"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Statistics */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="text-center p-4 border border-gray-200 rounded-xl">
              <div className="text-3xl font-bold text-gray-900 mb-2">{totalAccounts}</div>
              <div className="text-sm text-gray-600">Total Accounts</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-xl">
              <div className="text-3xl font-bold text-emerald-600 mb-2">{activeAccounts}</div>
              <div className="text-sm text-gray-600">Active Accounts</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-xl">
              <div className="text-3xl font-bold text-red-600 mb-2">{closedAccounts}</div>
              <div className="text-sm text-gray-600">Closed Accounts</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-xl">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Active Rate</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-xl">
              <div className="text-3xl font-bold text-purple-600 mb-2">{predefinedTypes.length}</div>
              <div className="text-sm text-gray-600">Account Types</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}