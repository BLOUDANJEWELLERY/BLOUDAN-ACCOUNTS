import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useEffect } from "react";

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

  const [filter, setFilter] = useState({
    type: "",
    search: "",
  });

  const predefinedTypes = ["Market", "Casting", "Finishing", "Project"];

  // When user selects a type → auto-number next account
  useEffect(() => {
    const type = form.type?.trim();
    if (!type) return;

    const filtered = accounts.filter(
      (acc) => acc.type.toLowerCase() === type.toLowerCase()
    );
    const nextNo = filtered.length > 0
      ? Math.max(...filtered.map((a) => a.accountNo)) + 1
      : 1;
    setForm((prev) => ({ ...prev, accountNo: nextNo }));
  }, [form.type, accounts]);

  // Handle Submit (Create / Update)
  const handleSubmit = async () => {
    if (!form.name || !form.type) return alert("Name and Type are required.");

    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/accounts/${editingId}` : "/api/accounts";

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
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account?")) return;
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (res.ok) setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setForm(acc);
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

  return (
    <main className="min-h-screen p-8 bg-[#fef3c7]">
      <h1 className="text-2xl font-bold mb-6">Accounts</h1>

      {/* Account Form */}
      <div className="flex flex-col gap-2 mb-8 max-w-md bg-white p-4 border rounded shadow">
        {/* Disabled auto-generated Account No */}
        <input
          type="number"
          placeholder="Account No (auto)"
          value={form.accountNo ?? ""}
          disabled
          className="border p-2 rounded bg-gray-100 text-gray-600"
        />

        <input
          type="text"
          placeholder="Name"
          value={form.name ?? ""}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border p-2 rounded"
        />

        {/* Type Dropdown + Manual Entry */}
        <div className="flex gap-2">
          <select
            value={predefinedTypes.includes(form.type || "") ? form.type : ""}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border p-2 rounded flex-1"
          >
            <option value="">Select Type</option>
            {predefinedTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Or type new"
            value={
              !predefinedTypes.includes(form.type || "") ? form.type ?? "" : ""
            }
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border p-2 rounded flex-1"
          />
        </div>

        <input
          type="text"
          placeholder="Phone"
          value={form.phone ?? ""}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="border p-2 rounded"
        />

        <input
          type="text"
          placeholder="C.R / Civil ID No"
          value={form.crOrCivilIdNo ?? ""}
          onChange={(e) => setForm({ ...form, crOrCivilIdNo: e.target.value })}
          className="border p-2 rounded"
        />

        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update Account" : "Add Account"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">All Types</option>
          {predefinedTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search by name, phone, or account no..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          className="border p-2 rounded flex-1"
        />
      </div>

      {/* Table */}
      <table className="min-w-full border border-gray-400 bg-white">
        <thead>
          <tr className="bg-yellow-200">
            <th className="p-2 border">#</th>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">C.R / Civil ID</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAccounts.map((acc) => (
            <tr key={acc.id}>
              <td className="p-2 border text-center">{acc.accountNo}</td>
              <td className="p-2 border">{acc.name}</td>
              <td className="p-2 border">{acc.type}</td>
              <td className="p-2 border">{acc.phone}</td>
              <td className="p-2 border">{acc.crOrCivilIdNo}</td>
              <td className="p-2 border space-x-2 text-center">
                <button
                  onClick={() => handleEdit(acc)}
                  className="px-2 py-1 bg-yellow-500 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="px-2 py-1 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
                <a
                  href={`/balance-sheet/${acc.id}`}
                  className="px-2 py-1 bg-green-600 text-white rounded"
                >
                  Ledger
                </a>
              </td>
            </tr>
          ))}
          {filteredAccounts.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center p-4 text-gray-500">
                No accounts found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}