import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useEffect } from "react";

type Voucher = {
  id: string;
  date: string;
  mvn?: string | null;
  description?: string | null;
  vt: string;
  accountId: string;
  gold: number;
  kwd: number;
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

type VoucherForm = {
  date: string;
  mvn?: string;
  description?: string;
  vt: string;
  accountId: string;
  gold: number;
  kwd: number;
};

export const getServerSideProps: GetServerSideProps = async () => {
  const vouchers = await prisma.voucher.findMany({ orderBy: { date: "desc" } });
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

export default function VouchersPage({ vouchers: initialVouchers, accounts }: Props) {
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [voucherForms, setVoucherForms] = useState<VoucherForm[]>([
    { date: new Date().toISOString().split('T')[0], vt: "", accountId: "", gold: 0, kwd: 0 }
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [singleForm, setSingleForm] = useState<Partial<Voucher>>({});

  const filteredAccounts = accounts.filter((a) => a.type === selectedType);

  // Reset account when type changes
  useEffect(() => {
    setSelectedAccountId("");
    setVoucherForms(forms => forms.map(form => ({
      ...form,
      accountId: "",
      mvn: "",
      description: ""
    })));
  }, [selectedType]);

  // Update all forms when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      setVoucherForms(forms => forms.map(form => ({
        ...form,
        accountId: selectedAccountId
      })));
    }
  }, [selectedAccountId]);

  const addVoucherForm = () => {
    setVoucherForms(forms => [
      ...forms,
      { 
        date: new Date().toISOString().split('T')[0], 
        vt: forms[0]?.vt || "", 
        accountId: selectedAccountId, 
        gold: 0, 
        kwd: 0 
      }
    ]);
  };

  const removeVoucherForm = (index: number) => {
    if (voucherForms.length > 1) {
      setVoucherForms(forms => forms.filter((_, i) => i !== index));
    }
  };

  const updateVoucherForm = (index: number, field: keyof VoucherForm, value: any) => {
    setVoucherForms(forms => forms.map((form, i) => 
      i === index ? { ...form, [field]: value } : form
    ));
  };

const handleBatchSubmit = async () => {
  // Validate all forms
  for (let i = 0; i < voucherForms.length; i++) {
    const form = voucherForms[i];
    if (
      !form.date ||
      !form.vt ||
      !form.accountId ||
      !selectedType ||
      (selectedType === "Market" ? !form.mvn?.trim() : !form.description?.trim())
    ) {
      return alert(`Missing required fields in voucher ${i + 1}`);
    }
  }

  try {
    const payload = voucherForms.map(form => {
      // Ensure date is in correct format for MongoDB
      const date = new Date(form.date);
      
      return {
        date: date.toISOString(), // Convert to ISO string for consistent formatting
        vt: form.vt,
        accountId: form.accountId,
        gold: parseFloat(form.gold.toString()) || 0,
        kwd: parseFloat(form.kwd.toString()) || 0,
        mvn: selectedType === "Market" ? (form.mvn || null) : null,
        description: selectedType !== "Market" ? (form.description || null) : null,
      };
    });

    console.log('Sending payload:', payload);

    const res = await fetch("/api/vouchers/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      console.error('API Error:', responseData);
      return alert(responseData?.message || "Error saving vouchers");
    }

    // Make sure responseData is an array
    const newVouchers = Array.isArray(responseData) ? responseData : [responseData];
    
    setVouchers(prev => [...newVouchers, ...prev]);

    // Reset forms
    setVoucherForms([{ 
      date: new Date().toISOString().split('T')[0], 
      vt: "", 
      accountId: "", 
      gold: 0, 
      kwd: 0 
    }]);
    setSelectedType("");
    setSelectedAccountId("");
    
    alert(`Successfully created ${newVouchers.length} vouchers!`);
  } catch (err) {
    console.error('Network error:', err);
    alert("Network error saving vouchers");
  }
};

  const handleSingleSubmit = async () => {
    if (
      !singleForm.date ||
      !singleForm.vt ||
      !singleForm.accountId ||
      (selectedType === "Market" ? !singleForm.mvn?.trim() : !singleForm.description?.trim())
    ) {
      return alert("Missing required fields");
    }

    const payload = {
      date: singleForm.date,
      vt: singleForm.vt,
      accountId: singleForm.accountId,
      gold: singleForm.gold ?? 0,
      kwd: singleForm.kwd ?? 0,
      mvn: selectedType === "Market" ? singleForm.mvn ?? null : null,
      description: selectedType !== "Market" ? singleForm.description ?? null : null,
    };

    try {
      const res = await fetch(editingId ? `/api/vouchers/${editingId}` : "/api/vouchers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        return alert(errorData?.message || "Error saving voucher");
      }

      const updated = await res.json();

      if (editingId) {
        setVouchers((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        setEditingId(null);
      } else {
        setVouchers((prev) => [updated, ...prev]);
      }

      setSingleForm({});
      setSelectedType("");
      setSelectedAccountId("");
    } catch (err) {
      console.error(err);
      alert("Error saving voucher");
    }
  };

  const handleEdit = (v: Voucher) => {
    setEditingId(v.id);
    const acc = accounts.find((a) => a.id === v.accountId);
    setSelectedType(acc?.type ?? "");
    setSelectedAccountId(v.accountId);
    setSingleForm(v);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this voucher?")) return;
    const res = await fetch(`/api/vouchers/${id}`, { method: "DELETE" });
    if (res.ok) setVouchers((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <main className="min-h-screen p-8 bg-[#fef3c7]">
      <h1 className="text-2xl font-bold mb-6">Vouchers</h1>

      {/* Batch Voucher Creation */}
      <div className="mb-8 p-4 border rounded-lg bg-white">
        <h2 className="text-lg font-semibold mb-4">Create Multiple Vouchers</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Select Account Type</option>
            {[...new Set(accounts.map((a) => a.type))].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="border p-2 rounded"
            disabled={!selectedType}
          >
            <option value="">Select Account</option>
            {filteredAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountNo} - {a.name}
              </option>
            ))}
          </select>
        </div>

        {voucherForms.map((form, index) => (
          <div key={index} className="border p-4 rounded-lg mb-4 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Voucher {index + 1}</h3>
              {voucherForms.length > 1 && (
                <button
                  onClick={() => removeVoucherForm(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateVoucherForm(index, 'date', e.target.value)}
                className="border p-2 rounded"
              />

              {selectedType === "Market" ? (
                <input
                  type="text"
                  placeholder="Manual Voucher No"
                  value={form.mvn || ""}
                  onChange={(e) => updateVoucherForm(index, 'mvn', e.target.value)}
                  className="border p-2 rounded"
                />
              ) : (
                <input
                  type="text"
                  placeholder="Description"
                  value={form.description || ""}
                  onChange={(e) => updateVoucherForm(index, 'description', e.target.value)}
                  className="border p-2 rounded"
                />
              )}

              <select
                value={form.vt}
                onChange={(e) => updateVoucherForm(index, 'vt', e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Select Type</option>
                <option value="REC">REC (Receipt)</option>
                <option value="INV">INV (Invoice)</option>
              </select>

              <input
                type="number"
                placeholder="Gold"
                value={form.gold}
                onChange={(e) => updateVoucherForm(index, 'gold', parseFloat(e.target.value) || 0)}
                className="border p-2 rounded"
              />

              <input
                type="number"
                placeholder="KWD"
                value={form.kwd}
                onChange={(e) => updateVoucherForm(index, 'kwd', parseFloat(e.target.value) || 0)}
                className="border p-2 rounded"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <button
            onClick={addVoucherForm}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Add Another Voucher
          </button>
          
          <button
            onClick={handleBatchSubmit}
            className="bg-green-600 text-white px-4 py-2 rounded"
            disabled={!selectedType || !selectedAccountId}
          >
            Create {voucherForms.length} Voucher{voucherForms.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Single Voucher Creation (for editing) */}
      {editingId && (
        <div className="mb-8 p-4 border rounded-lg bg-yellow-50">
          <h2 className="text-lg font-semibold mb-4">Edit Voucher</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg">
            <input
              type="date"
              value={singleForm.date?.split("T")[0] ?? ""}
              onChange={(e) => setSingleForm({ ...singleForm, date: e.target.value })}
              className="border p-2 rounded"
            />

            {selectedType === "Market" ? (
              <input
                type="text"
                placeholder="Manual Voucher No"
                value={singleForm.mvn ?? ""}
                onChange={(e) => setSingleForm({ ...singleForm, mvn: e.target.value })}
                className="border p-2 rounded"
              />
            ) : (
              <input
                type="text"
                placeholder="Description"
                value={singleForm.description ?? ""}
                onChange={(e) => setSingleForm({ ...singleForm, description: e.target.value })}
                className="border p-2 rounded"
              />
            )}

            <select
              value={singleForm.vt ?? ""}
              onChange={(e) => setSingleForm({ ...singleForm, vt: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">Select Type</option>
              <option value="REC">REC (Receipt)</option>
              <option value="INV">INV (Invoice)</option>
            </select>

            <input
              type="number"
              placeholder="Gold"
              value={singleForm.gold ?? ""}
              onChange={(e) => setSingleForm({ ...singleForm, gold: parseFloat(e.target.value) })}
              className="border p-2 rounded"
            />

            <input
              type="number"
              placeholder="KWD"
              value={singleForm.kwd ?? ""}
              onChange={(e) => setSingleForm({ ...singleForm, kwd: parseFloat(e.target.value) })}
              className="border p-2 rounded"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSingleSubmit}
                className="bg-green-600 text-white px-4 py-2 rounded flex-1"
              >
                Update Voucher
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setSingleForm({});
                  setSelectedType("");
                  setSelectedAccountId("");
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <table className="min-w-full border border-gray-400 bg-white">
        <thead>
          <tr className="bg-yellow-200">
            <th className="p-2 border">Date</th>
            <th className="p-2 border">MVN / Description</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Account</th>
            <th className="p-2 border">Gold</th>
            <th className="p-2 border">KWD</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => {
            const acc = accounts.find((a) => a.id === v.accountId);
            return (
              <tr key={v.id}>
                <td className="p-2 border">{v.date.split("T")[0]}</td>
                <td className="p-2 border">{v.mvn || v.description}</td>
                <td className="p-2 border">{v.vt}</td>
                <td className="p-2 border">{acc ? `${acc.accountNo} - ${acc.name}` : v.accountId}</td>
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
            );
          })}
        </tbody>
      </table>
    </main>
  );
}