// pages/vouchers.tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useEffect } from "react";

type Voucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: string;
  accountNo: number;
  gold: number;
  kwd: number;
};

type Account = {
  accountNo: number;
  name: string;
  type: string;
};

type Props = {
  vouchers: Voucher[];
  accounts: Account[];
};

export const getServerSideProps: GetServerSideProps = async () => {
  const vouchers = await prisma.voucher.findMany({ orderBy: { date: "desc" } });
  const accounts = await prisma.account.findMany({
    select: { accountNo: true, name: true, type: true },
    orderBy: { accountNo: "asc" },
  });

  return {
    props: {
      vouchers: JSON.parse(JSON.stringify(vouchers)),
      accounts: JSON.parse(JSON.stringify(accounts)),
    },
  };
};

export default function VouchersPage({ vouchers: initialVouchers, accounts }: Props) {
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);
  const [form, setForm] = useState<Partial<Voucher>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");

  const filteredAccounts = accounts.filter((a) => a.type === selectedType);

  // Clear accountNo if type changes
  useEffect(() => {
    setForm((prev) => ({ ...prev, accountNo: undefined }));
  }, [selectedType]);

const handleSubmit = async () => {
  if (
    !form.date ||
    !form.vt ||
    !form.accountNo ||
    (selectedType === "Market" ? !form.mvn : !form.description)
  ) {
    return alert("Missing required fields");
  }

  const method = editingId ? "PUT" : "POST";
  const url = editingId ? `/api/vouchers/${editingId}` : "/api/vouchers";

  // Build payload with correct nullable fields
  const payload = {
    date: form.date,
    vt: form.vt,
    accountNo: Number(form.accountNo),
    gold: form.gold ?? 0,
    kwd: form.kwd ?? 0,
    mvn: selectedType === "Market" ? form.mvn ?? null : null,
    description: selectedType !== "Market" ? form.description ?? null : null,
  };

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return alert("Error saving voucher");

    const updated = await res.json();

    if (editingId) {
      setVouchers((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setEditingId(null);
    } else {
      setVouchers((prev) => [updated, ...prev]);
    }

    // Reset form
    setForm({});
    setSelectedType("");
  } catch (error) {
    console.error(error);
    alert("Error saving voucher");
  }
};

  const handleEdit = (v: Voucher) => {
    setEditingId(v.id);
    const acc = accounts.find((a) => a.accountNo === v.accountNo);
    setSelectedType(acc?.type ?? "");
    setForm(v);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this voucher?")) return;
    const res = await fetch(`/api/vouchers/${id}`, { method: "DELETE" });
    if (res.ok) setVouchers((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <main className="min-h-screen p-8 bg-[#fef3c7]">
      <h1 className="text-2xl font-bold mb-6">Vouchers</h1>

      {/* Form */}
      <div className="flex flex-col gap-2 mb-8 max-w-lg">
        <input
          type="date"
          value={form.date?.split("T")[0] ?? ""}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border p-2 rounded"
        />

        {/* Account Type first */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Select Account Type</option>
          {[...new Set(accounts.map((a) => a.type))].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Account selection depends on type */}
        <select
          value={form.accountNo ?? ""}
          onChange={(e) => setForm({ ...form, accountNo: Number(e.target.value) })}
          className="border p-2 rounded"
          disabled={!selectedType}
        >
          <option value="">Select Account</option>
          {filteredAccounts.map((a) => (
            <option key={a.accountNo} value={a.accountNo}>
              {a.accountNo} - {a.name}
            </option>
          ))}
        </select>

        {/* MVN or Description based on type */}
        {selectedType === "Market" ? (
          <input
            type="text"
            placeholder="Manual Voucher No"
            value={form.mvn ?? ""}
            onChange={(e) => setForm({ ...form, mvn: e.target.value })}
            className="border p-2 rounded"
          />
        ) : (
          <input
            type="text"
            placeholder="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border p-2 rounded"
          />
        )}

        <select
          value={form.vt ?? ""}
          onChange={(e) => setForm({ ...form, vt: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Select Type</option>
          <option value="REC">REC (Receipt)</option>
          <option value="INV">INV (Invoice)</option>
        </select>

        <input
          type="number"
          placeholder="Gold"
          value={form.gold ?? ""}
          onChange={(e) => setForm({ ...form, gold: parseFloat(e.target.value) })}
          className="border p-2 rounded"
        />

        <input
          type="number"
          placeholder="KWD"
          value={form.kwd ?? ""}
          onChange={(e) => setForm({ ...form, kwd: parseFloat(e.target.value) })}
          className="border p-2 rounded"
        />

        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {editingId ? "Update Voucher" : "Add Voucher"}
        </button>
      </div>

      {/* Table */}
      <table className="min-w-full border border-gray-400 bg-white">
        <thead>
          <tr className="bg-yellow-200">
            <th className="p-2 border">Date</th>
            <th className="p-2 border">MVN / Description</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Account No</th>
            <th className="p-2 border">Gold</th>
            <th className="p-2 border">KWD</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => (
            <tr key={v.id}>
              <td className="p-2 border">{v.date.split("T")[0]}</td>
              <td className="p-2 border">{v.mvn || v.description}</td>
              <td className="p-2 border">{v.vt}</td>
              <td className="p-2 border">{v.accountNo}</td>
              <td className="p-2 border">{v.gold}</td>
              <td className="p-2 border">{v.kwd}</td>
              <td className="p-2 border space-x-2">
                <button
                  onClick={() => handleEdit(v)}
                  className="px-2 py-1 bg-yellow-500 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="px-2 py-1 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}