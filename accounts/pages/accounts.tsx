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
};

type Props = { accounts: Account[] };

export const getServerSideProps: GetServerSideProps = async () => {
  const accounts = await prisma.account.findMany({ orderBy: { accountNo: "asc" } });
  return { props: { accounts: JSON.parse(JSON.stringify(accounts)) } };
};

export default function AccountsPage({ accounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [form, setForm] = useState<Partial<Account>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState({ type: "", search: "" });

  const predefinedTypes = ["Market", "Casting", "Finishing", "Project"];

  // Auto-number new accounts by type
  useEffect(() => {
    if (editingId) return;
    const type = form.type?.trim();
    if (!type) return;

    const filtered = accounts.filter(
      (acc) => acc.type.toLowerCase() === type.toLowerCase()
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
        body: JSON.stringify(form),
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

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setForm(acc);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.id !== id));
        alert("Account deleted successfully!");
      } else {
        alert("Error deleting account");
      }
    } catch (error) {
      alert("Error deleting account");
    }
  };

  // Filtering logic
  const filteredAccounts = accounts.filter((acc) => {
    const matchesType = filter.type
      ? acc.type.toLowerCase() === filter.type.toLowerCase()
      : true;

    const searchTerm = filter.search.toLowerCase();
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm) ||
      acc.phone?.toLowerCase().includes(searchTerm) ||
      acc.accountNo.toString().includes(searchTerm) ||
      acc.crOrCivilIdNo?.toLowerCase().includes(searchTerm);

    return matchesType && matchesSearch;
  });

  // Statistics
  const totalAccounts = accounts.length;
  const accountsByType = predefinedTypes.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.type === type).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Management</h1>
          <p className="text-gray-600 mb-4">Create and manage your business accounts</p>
          <Link 
            href="/" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <div className="text-2xl font-bold text-emerald-600">{totalAccounts}</div>
            <div className="text-sm text-gray-600">Total Accounts</div>
          </div>
          {predefinedTypes.map((type) => (
            <div key={type} className="bg-white rounded-2xl p-6 shadow-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{accountsByType[type] || 0}</div>
              <div className="text-sm text-gray-600">{type}</div>
            </div>
          ))}
        </div>

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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type *
                </label>
                {!editingId ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={predefinedTypes.includes(form.type || "") ? form.type : ""}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    >
                      <option value="">Select Type</option>
                      {predefinedTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Or type custom"
                      value={
                        !predefinedTypes.includes(form.type || "") ? form.type ?? "" : ""
                      }
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form.type ?? ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-600"
                  />
                )}
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.name || !form.type || isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
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
              
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                >
                  <option value="">All Types</option>
                  {predefinedTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors min-w-[200px]"
                />
              </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredAccounts.map((acc) => (
                <div key={acc.id} className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {acc.accountNo}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{acc.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            acc.type === 'Market' ? 'bg-blue-100 text-blue-800' :
                            acc.type === 'Casting' ? 'bg-purple-100 text-purple-800' :
                            acc.type === 'Finishing' ? 'bg-amber-100 text-amber-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {acc.type}
                          </span>
                          {acc.phone && (
                            <span className="text-xs text-gray-500 flex items-center">
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
                        onClick={() => handleDelete(acc.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Account"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {acc.crOrCivilIdNo && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9a2 2 0 10-4 0v5a2 2 0 01-2 2h6m-6-4h4m8 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ID: {acc.crOrCivilIdNo}
                    </div>
                  )}
                </div>
              ))}

              {filteredAccounts.length === 0 && (
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
      </div>
    </main>
  );
}