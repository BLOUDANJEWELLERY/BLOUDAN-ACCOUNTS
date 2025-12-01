// pages/vouchers/[id].tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState, useEffect } from "react";
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

type VoucherForm = {
  date: string;
  mvn?: string;
  description?: string;
  vt: string;
  accountId: string;
  gold: number;
  kwd: number;
  goldRate?: number;
  isGoldFixing?: boolean;
  fixingAmount?: number;
  paymentMethod: 'cash' | 'cheque';
  bankName?: string;
  branch?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeAmount?: number;
};

type Props = {
  voucher: Voucher;
  accounts: Account[];
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;

  try {
    const voucher = await prisma.voucher.findUnique({
      where: { id: id as string },
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

    if (!voucher) {
      return {
        notFound: true,
      };
    }

    const accounts = await prisma.account.findMany({
      select: { id: true, accountNo: true, name: true, type: true },
      orderBy: { accountNo: "asc" },
    });

    return {
      props: {
        voucher: JSON.parse(JSON.stringify(voucher)),
        accounts: JSON.parse(JSON.stringify(accounts)),
      },
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
};

export default function EditVoucherPage({ voucher, accounts }: Props) {
  const [selectedType, setSelectedType] = useState<string>(voucher.account.type);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(voucher.accountId);
  const [formData, setFormData] = useState<VoucherForm>({
    date: voucher.date.split('T')[0],
    vt: voucher.vt,
    accountId: voucher.accountId,
    gold: voucher.gold,
    kwd: voucher.kwd,
    mvn: voucher.mvn || "",
    description: voucher.description || "",
    goldRate: voucher.goldRate || undefined,
    isGoldFixing: !!(voucher.fixingAmount && voucher.fixingAmount > 0),
    fixingAmount: voucher.fixingAmount || 0,
    paymentMethod: (voucher.paymentMethod as 'cash' | 'cheque') || 'cash',
    bankName: voucher.bankName || "",
    branch: voucher.branch || "",
    chequeNo: voucher.chequeNo || "",
    chequeDate: voucher.chequeDate ? voucher.chequeDate.split('T')[0] : "",
    chequeAmount: voucher.chequeAmount || 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const filteredAccounts = accounts.filter((a) => a.type === selectedType);

  // Get available voucher types based on account type
  const getVoucherTypes = () => {
    if (selectedType === "Gold Fixing") {
      return [
        { value: "INV", label: "INV (Invoice)" },
        { value: "REC", label: "REC (Receipt)" },
        { value: "GFV", label: "GFV (Gold Fixing)" }
      ];
    } else if (selectedType === "Project") {
      return [
        { value: "INV", label: "INV (Invoice)" },
        { value: "REC", label: "REC (Receipt)" },
        { value: "Alloy", label: "Alloy" } // Added Alloy for Project accounts only
      ];
    } else {
      return [
        { value: "INV", label: "INV (Invoice)" },
        { value: "REC", label: "REC (Receipt)" }
      ];
    }
  };

  // Check if should show gold fixing section
  const shouldShowGoldFixing = () => {
    return selectedType === "Market" && formData.vt === "REC";
  };

  // Calculate fixing amount
  const calculateFixingAmount = (gold: number, goldRate: number | undefined): number => {
    if (!goldRate || goldRate <= 0) return 0;
    return gold * goldRate;
  };

  // Calculate KWD for GFV vouchers
  const calculateKwdForGFV = (gold: number, goldRate: number | undefined): number => {
    if (!goldRate || goldRate <= 0) return 0;
    return gold * goldRate;
  };

  // Reset account when type changes
  useEffect(() => {
    if (selectedType !== voucher.account.type) {
      setSelectedAccountId("");
      setFormData(prev => ({
        ...prev,
        accountId: "",
        mvn: "",
        description: "",
        vt: "",
        goldRate: undefined,
        isGoldFixing: false,
        fixingAmount: 0,
        paymentMethod: 'cash',
        bankName: "",
        branch: "",
        chequeNo: "",
        chequeDate: "",
        chequeAmount: 0
      }));
    }
  }, [selectedType, voucher.account.type]);

  // Update form when account is selected
  useEffect(() => {
    if (selectedAccountId && selectedAccountId !== voucher.accountId) {
      setFormData(prev => ({
        ...prev,
        accountId: selectedAccountId
      }));
    }
  }, [selectedAccountId, voucher.accountId]);

  const handleChange = (field: keyof VoucherForm, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Handle GFV voucher calculations
      if (updated.vt === "GFV") {
        if (field === 'gold' || field === 'goldRate') {
          const calculatedKwd = calculateKwdForGFV(
            field === 'gold' ? value : updated.gold,
            field === 'goldRate' ? value : updated.goldRate
          );
          updated.kwd = calculatedKwd;
        }
      }
      
      // Handle Gold Fixing calculations
      if (shouldShowGoldFixing() && updated.isGoldFixing) {
        if (field === 'gold' || field === 'goldRate') {
          const calculatedFixingAmount = calculateFixingAmount(
            field === 'gold' ? value : updated.gold,
            field === 'goldRate' ? value : updated.goldRate
          );
          updated.fixingAmount = calculatedFixingAmount;
          
          // Update cheque amount if payment method is cheque
          if (updated.paymentMethod === 'cheque') {
            updated.chequeAmount = calculatedFixingAmount;
          }
        }
      }

      // Reset cheque-related fields when switching to cash
      if (field === 'paymentMethod' && value === 'cash') {
        updated.bankName = "";
        updated.branch = "";
        updated.chequeNo = "";
        updated.chequeDate = "";
        updated.chequeAmount = 0;
      }

      // When switching to cheque, set cheque amount to fixing amount
      if (field === 'paymentMethod' && value === 'cheque' && updated.isGoldFixing) {
        updated.chequeAmount = updated.fixingAmount || 0;
      }

      // Update cheque amount when fixing amount changes and payment method is cheque
      if (field === 'fixingAmount' && updated.paymentMethod === 'cheque') {
        updated.chequeAmount = value;
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate form
    if (
      !formData.date ||
      !formData.vt ||
      !formData.accountId ||
      !selectedType ||
      (selectedType === "Market" ? !formData.mvn?.trim() : !formData.description?.trim())
    ) {
      setIsSubmitting(false);
      return alert("Missing required fields");
    }
    
    // Additional validation for GFV vouchers
    if (formData.vt === "GFV" && (!formData.goldRate || formData.goldRate <= 0)) {
      setIsSubmitting(false);
      return alert("Gold Rate is required and must be greater than 0 for GFV vouchers");
    }

    // Additional validation for Gold Fixing in Market REC
    if (shouldShowGoldFixing() && formData.isGoldFixing && (!formData.goldRate || formData.goldRate <= 0)) {
      setIsSubmitting(false);
      return alert("Gold Rate is required when Gold Fixing is checked");
    }

    // Validation for cheque payments
    if (formData.paymentMethod === 'cheque' && formData.isGoldFixing) {
      if (!formData.bankName?.trim() || !formData.branch?.trim() || !formData.chequeNo?.trim() || !formData.chequeDate) {
        setIsSubmitting(false);
        return alert("All cheque details are required when payment method is cheque");
      }
    }

    try {
      const payload = {
        date: formData.date,
        vt: formData.vt,
        accountId: formData.accountId,
        gold: parseFloat(formData.gold.toString()) || 0,
        kwd: parseFloat(formData.kwd.toString()) || 0,
        paymentMethod: formData.paymentMethod,
        mvn: selectedType === "Market" && formData.mvn?.trim() ? formData.mvn : null,
        description: selectedType !== "Market" && formData.description?.trim() ? formData.description : null,
        goldRate: (formData.vt === "GFV" || (shouldShowGoldFixing() && formData.isGoldFixing)) && formData.goldRate 
          ? parseFloat(formData.goldRate.toString()) || 0 
          : null,
        fixingAmount: shouldShowGoldFixing() && formData.isGoldFixing && formData.fixingAmount
          ? parseFloat(formData.fixingAmount.toString()) || 0
          : null,
        bankName: formData.paymentMethod === 'cheque' ? formData.bankName : null,
        branch: formData.paymentMethod === 'cheque' ? formData.branch : null,
        chequeNo: formData.paymentMethod === 'cheque' ? formData.chequeNo : null,
        chequeDate: formData.paymentMethod === 'cheque' && formData.chequeDate ? formData.chequeDate : null,
        chequeAmount: formData.paymentMethod === 'cheque' && formData.chequeAmount
          ? parseFloat(formData.chequeAmount.toString()) || 0
          : null,
      };

      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.message || "Error updating voucher");
      }

      // Redirect back to vouchers list
      router.push("/vouchers/list");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error updating voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Voucher</h1>
          <p className="text-gray-600">Update voucher details</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Vouchers
            </Link>
            <Link 
              href="/" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl bg-white hover:bg-gray-50 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Edit Voucher Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Edit Voucher</h2>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              Voucher #{voucher.account.accountNo}
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

          {/* Voucher Form */}
          <form onSubmit={handleSubmit}>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-white hover:border-blue-300 transition-colors">
              {/* Basic Voucher Fields */}
              <div className={`grid grid-cols-1 ${
                shouldShowGoldFixing() && formData.isGoldFixing 
                  ? "sm:grid-cols-2 lg:grid-cols-4" 
                  : formData.vt === "GFV"
                  ? "sm:grid-cols-2 lg:grid-cols-3"
                  : "sm:grid-cols-2 lg:grid-cols-4"
              } gap-4 mb-4`}>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {selectedType === "Market" ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manual Voucher No *</label>
                    <input
                      type="text"
                      placeholder="Enter MVN"
                      value={formData.mvn || ""}
                      onChange={(e) => handleChange('mvn', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description *</label>
                    <input
                      type="text"
                      placeholder="Enter description"
                      value={formData.description || ""}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type *</label>
                  <select
                    value={formData.vt}
                    onChange={(e) => handleChange('vt', e.target.value)}
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
                    value={formData.gold}
                    onChange={(e) => handleChange('gold', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* KWD Field - Show only for non-GFV and non-Alloy vouchers */}
                {formData.vt !== "GFV" && formData.vt !== "Alloy" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">KWD</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={formData.kwd}
                      onChange={(e) => handleChange('kwd', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Gold Fixing Section - Only for Market REC */}
              {shouldShowGoldFixing() && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="gold-fixing"
                      checked={formData.isGoldFixing || false}
                      onChange={(e) => handleChange('isGoldFixing', e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="gold-fixing" className="ml-2 block text-sm font-medium text-gray-700">
                      Gold Fixing
                    </label>
                  </div>

                  {formData.isGoldFixing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Gold Rate *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={formData.goldRate || ""}
                          onChange={(e) => handleChange('goldRate', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Fixing Amount</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={formData.fixingAmount || 0}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Calculated automatically from Gold × Gold Rate</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GFV Voucher Type - Show only one KWD field inside container */}
              {formData.vt === "GFV" && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Gold Rate *
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        value={formData.goldRate || ""}
                        onChange={(e) => handleChange('goldRate', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        KWD
                        {formData.goldRate && formData.gold > 0 && (
                          <span className="text-green-600 ml-1">
                            (Gold {formData.gold} × Rate {formData.goldRate})
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={formData.kwd}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Calculated automatically from Gold × Gold Rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Alloy Voucher Type - Show KWD field for Alloy */}
              {formData.vt === "Alloy" && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Gold</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={formData.gold}
                        onChange={(e) => handleChange('gold', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">KWD</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={formData.kwd}
                        onChange={(e) => handleChange('kwd', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter KWD amount for Alloy</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Section - Only for Market REC with Gold Fixing */}
              {shouldShowGoldFixing() && formData.isGoldFixing && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
                  
                  <div className="flex space-x-4 mb-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="payment-method"
                        value="cash"
                        checked={formData.paymentMethod === 'cash'}
                        onChange={(e) => handleChange('paymentMethod', e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Cash</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="payment-method"
                        value="cheque"
                        checked={formData.paymentMethod === 'cheque'}
                        onChange={(e) => handleChange('paymentMethod', e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Cheque</span>
                    </label>
                  </div>

                  {formData.paymentMethod === 'cheque' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name *</label>
                        <input
                          type="text"
                          placeholder="Enter bank name"
                          value={formData.bankName || ""}
                          onChange={(e) => handleChange('bankName', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Branch *</label>
                        <input
                          type="text"
                          placeholder="Enter branch"
                          value={formData.branch || ""}
                          onChange={(e) => handleChange('branch', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cheque No *</label>
                        <input
                          type="text"
                          placeholder="Enter cheque number"
                          value={formData.chequeNo || ""}
                          onChange={(e) => handleChange('chequeNo', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cheque Date *</label>
                        <input
                          type="date"
                          value={formData.chequeDate || ""}
                          onChange={(e) => handleChange('chequeDate', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cheque Amount</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={formData.chequeAmount || 0}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Same as Fixing Amount</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting || !selectedType || !selectedAccountId}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  "Update Voucher"
                )}
              </button>
              
              <Link
                href="/vouchers/list"
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-400 transition-colors text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">1</div>
            <div className="text-sm text-gray-600">Voucher</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {formData.gold.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Gold</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {formData.kwd.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">KWD</div>
          </div>
        </div>
      </div>
    </main>
  );
}