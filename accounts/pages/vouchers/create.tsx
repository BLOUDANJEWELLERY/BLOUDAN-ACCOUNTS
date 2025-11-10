import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useEffect } from "react";
import Link from "next/link";

type Account = {
  id: string;
  accountNo: number;
  name: string;
  type: string;
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

type Props = {
  accounts: Account[];
};

export const getServerSideProps: GetServerSideProps = async () => {
  const accounts = await prisma.account.findMany({
    select: { id: true, accountNo: true, name: true, type: true },
    orderBy: { accountNo: "asc" },
  });

  return {
    props: {
      accounts: JSON.parse(JSON.stringify(accounts)),
    },
  };
};

export default function CreateVouchersPage({ accounts }: Props) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [voucherForms, setVoucherForms] = useState<VoucherForm[]>([
    { date: new Date().toISOString().split('T')[0], vt: "", accountId: "", gold: 0, kwd: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredAccounts = accounts.filter((a) => a.type === selectedType);

  // Get available voucher types based on account type
  const getVoucherTypes = () => {
    if (selectedType === "Gold Fixing") {
      return [
        { value: "INV", label: "INV (Invoice)" },
        { value: "REC", label: "REC (Receipt)" },
        { value: "GFV", label: "GFV (Gold Fixing)" }
      ];
    } else {
      return [
        { value: "INV", label: "INV (Invoice)" },
        { value: "REC", label: "REC (Receipt)" }
      ];
    }
  };

  // Reset account when type changes
  useEffect(() => {
    setSelectedAccountId("");
    setVoucherForms(forms => forms.map(form => ({
      ...form,
      accountId: "",
      mvn: "",
      description: "",
      vt: "" // Reset voucher type when account type changes
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

    setIsSubmitting(true);
    try {
      const payload = voucherForms.map(form => {
        const date = new Date(form.date);
        
        return {
          date: date.toISOString(),
          vt: form.vt,
          accountId: form.accountId,
          gold: parseFloat(form.gold.toString()) || 0,
          kwd: parseFloat(form.kwd.toString()) || 0,
          mvn: selectedType === "Market" ? (form.mvn || null) : null,
          description: selectedType !== "Market" ? (form.description || null) : null,
        };
      });

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

      // Reset forms on success
      setVoucherForms([{ 
        date: new Date().toISOString().split('T')[0], 
        vt: "", 
        accountId: "", 
        gold: 0, 
        kwd: 0 
      }]);
      setSelectedType("");
      setSelectedAccountId("");
      
      alert(`Successfully created ${voucherForms.length} vouchers!`);
    } catch (err) {
      console.error('Network error:', err);
      alert("Network error saving vouchers");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Vouchers</h1>
          <p className="text-gray-600">Create multiple vouchers under one account</p>
          <div className="flex justify-center gap-4 mt-4">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
            >
              View All Vouchers
            </Link>
            <Link 
              href="/" 
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Batch Voucher Creation Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create Multiple Vouchers</h2>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              {voucherForms.length} voucher{voucherForms.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {/* Account Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type *
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Select Account Type</option>
                {[...new Set(accounts.map((a) => a.type))].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account *
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
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
          </div>

          {/* Voucher Forms */}
          <div className="space-y-4">
            {voucherForms.map((form, index) => (
              <div key={index} className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gradient-to-r from-gray-50 to-white hover:border-blue-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h3 className="font-semibold text-gray-700 mb-2 sm:mb-0">Voucher #{index + 1}</h3>
                  {voucherForms.length > 1 && (
                    <button
                      onClick={() => removeVoucherForm(index)}
                      className="flex items-center text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => updateVoucherForm(index, 'date', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {selectedType === "Market" ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Manual Voucher No *</label>
                      <input
                        type="text"
                        placeholder="Enter MVN"
                        value={form.mvn || ""}
                        onChange={(e) => updateVoucherForm(index, 'mvn', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Description *</label>
                      <input
                        type="text"
                        placeholder="Enter description"
                        value={form.description || ""}
                        onChange={(e) => updateVoucherForm(index, 'description', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type *</label>
                    <select
                      value={form.vt}
                      onChange={(e) => updateVoucherForm(index, 'vt', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="">Select Type</option>
                      {getVoucherTypes().map((voucherType) => (
                        <option key={voucherType.value} value={voucherType.value}>
                          {voucherType.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gold</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={form.gold}
                      onChange={(e) => updateVoucherForm(index, 'gold', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">KWD</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={form.kwd}
                      onChange={(e) => updateVoucherForm(index, 'kwd', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={addVoucherForm}
              className="flex items-center justify-center px-6 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Another Voucher
            </button>
            
            <button
              onClick={handleBatchSubmit}
              disabled={!selectedType || !selectedAccountId || isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                `Create ${voucherForms.length} Voucher${voucherForms.length > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{voucherForms.length}</div>
            <div className="text-sm text-gray-600">Vouchers Ready</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {voucherForms.reduce((sum, form) => sum + form.gold, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Gold</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {voucherForms.reduce((sum, form) => sum + form.kwd, 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total KWD</div>
          </div>
        </div>
      </div>
    </main>
  );
}