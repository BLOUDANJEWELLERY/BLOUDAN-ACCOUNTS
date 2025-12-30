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

// Get account type color function
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
  const typeColor = getTypeColor(selectedType);
  const voucherTypeColor = getVoucherTypeColor(formData.vt);

  // Get available voucher types based on account type
  const getVoucherTypes = () => {
    if (selectedType === "Gold Fixing") {
      return [
        { value: "INV", label: "Invoice" },
        { value: "REC", label: "Receipt" },
        { value: "GFV", label: "Gold Fixing" }
      ];
    } else if (selectedType === "Project") {
      return [
        { value: "INV", label: "Invoice" },
        { value: "REC", label: "Receipt" },
        { value: "Alloy", label: "Alloy" }
      ];
    } else {
      return [
        { value: "INV", label: "Invoice" },
        { value: "REC", label: "Receipt" }
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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            Edit Voucher
          </h1>
          <p className="text-xl text-blue-700 mb-6">Update voucher details</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Vouchers
            </Link>
            <Link 
              href="/" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>

        {/* Edit Voucher Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300">
          <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-800">Edit Voucher</h2>
                <p className="text-sm text-blue-700 mt-1">Update voucher information</p>
              </div>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${voucherTypeColor.bg} ${voucherTypeColor.text}`}>
                {formData.vt || 'No Type'}
              </span>
            </div>
          </div>
          
          {/* Current Voucher Info */}
          <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div className="flex items-center mb-4 sm:mb-0">
                <div className="p-3 bg-blue-100 rounded-xl mr-4">
                  <div className={`w-6 h-6 ${typeColor.bg} rounded-lg`}></div>
                </div>
                <div>
                  <div className="font-semibold text-blue-900 text-lg">
                    Account #{voucher.account.accountNo} - {voucher.account.name}
                  </div>
                  <div className="text-sm text-blue-600">
                    {selectedType} • Original Voucher Type: {voucher.vt}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="font-bold text-blue-800">
                    {formData.gold.toFixed(3)} Gold
                  </div>
                  {formData.vt !== "Alloy" && (
                    <div className="font-medium text-blue-600">
                      {formData.kwd.toFixed(3)} KWD
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Account Selection */}
          <div className="mb-8 p-6 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-blue-300">
            <h3 className="text-lg font-semibold text-blue-800 mb-6">Account Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-3">
                  Account Type *
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                >
                  <option value="">Select Account Type</option>
                  {[...new Set(accounts.map((a) => a.type))].map((t) => {
                    const typeColor = getTypeColor(t);
                    return (
                      <option key={t} value={t} className={typeColor.text}>
                        {t}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-3">
                  Account *
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80 disabled:bg-blue-100 disabled:cursor-not-allowed"
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
          </div>

          {/* Voucher Form */}
          <form onSubmit={handleSubmit}>
            <div className="border-2 border-blue-300 rounded-2xl p-6 bg-white/80 backdrop-blur-sm hover:border-blue-500 transition-colors">
              {/* Basic Voucher Fields */}
              <div className={`grid grid-cols-1 ${
                shouldShowGoldFixing() && formData.isGoldFixing 
                  ? "sm:grid-cols-2 lg:grid-cols-4" 
                  : formData.vt === "GFV"
                  ? "sm:grid-cols-2 lg:grid-cols-3"
                  : "sm:grid-cols-2 lg:grid-cols-4"
              } gap-6 mb-6`}>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                  />
                </div>

                {selectedType === "Market" ? (
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Manual Voucher No *</label>
                    <input
                      type="text"
                      placeholder="Enter MVN"
                      value={formData.mvn || ""}
                      onChange={(e) => handleChange('mvn', e.target.value)}
                      className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Description *</label>
                    <input
                      type="text"
                      placeholder="Enter description"
                      value={formData.description || ""}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">Type *</label>
                  <select
                    value={formData.vt}
                    onChange={(e) => handleChange('vt', e.target.value)}
                    className={`w-full border-2 ${voucherTypeColor.border} rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80`}
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
                  <label className="block text-sm font-medium text-blue-700 mb-2">Gold</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={formData.gold}
                    onChange={(e) => handleChange('gold', parseFloat(e.target.value) || 0)}
                    className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                  />
                </div>

                {/* KWD Field - Show only for non-GFV and non-Alloy vouchers */}
                {formData.vt !== "GFV" && formData.vt !== "Alloy" && (
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">KWD</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={formData.kwd}
                      onChange={(e) => handleChange('kwd', parseFloat(e.target.value) || 0)}
                      className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                    />
                  </div>
                )}
              </div>

              {/* Gold Fixing Section - Only for Market REC */}
              {shouldShowGoldFixing() && (
                <div className="mb-6 p-5 bg-yellow-50 border-2 border-yellow-300 rounded-2xl">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="gold-fixing"
                      checked={formData.isGoldFixing || false}
                      onChange={(e) => handleChange('isGoldFixing', e.target.checked)}
                      className="h-5 w-5 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="gold-fixing" className="ml-3 block text-sm font-medium text-blue-800">
                      Gold Fixing
                    </label>
                  </div>

                  {formData.isGoldFixing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Gold Rate *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={formData.goldRate || ""}
                          onChange={(e) => handleChange('goldRate', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Fixing Amount</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={formData.fixingAmount || 0}
                          readOnly
                          className="w-full border-2 border-yellow-300 rounded-xl px-4 py-3 bg-blue-100 text-blue-600 cursor-not-allowed text-base"
                        />
                        <p className="text-sm text-blue-500 mt-2">Calculated automatically from Gold × Gold Rate</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GFV Voucher Type - Show only one KWD field inside container */}
              {formData.vt === "GFV" && (
                <div className="mb-6 p-5 bg-yellow-50 border-2 border-yellow-300 rounded-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-2">
                        Gold Rate *
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        value={formData.goldRate || ""}
                        onChange={(e) => handleChange('goldRate', parseFloat(e.target.value) || 0)}
                        className="w-full border-2 border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors text-base bg-white/80"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-2">
                        KWD
                        {formData.goldRate && formData.gold > 0 && (
                          <span className="text-green-600 ml-2">
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
                        className="w-full border-2 border-yellow-300 rounded-xl px-4 py-3 bg-blue-100 text-blue-600 cursor-not-allowed text-base"
                      />
                      <p className="text-sm text-blue-500 mt-2">Calculated automatically from Gold × Gold Rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Alloy Voucher Type - Show KWD field for Alloy */}
              {formData.vt === "Alloy" && (
                <div className="mb-6 p-5 bg-blue-50 border-2 border-blue-300 rounded-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-2">Gold</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={formData.gold}
                        onChange={(e) => handleChange('gold', parseFloat(e.target.value) || 0)}
                        className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-2">KWD</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={formData.kwd}
                        onChange={(e) => handleChange('kwd', parseFloat(e.target.value) || 0)}
                        className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                      />
                      <p className="text-sm text-blue-500 mt-2">Enter KWD amount for Alloy</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Section - Only for Market REC with Gold Fixing */}
              {shouldShowGoldFixing() && formData.isGoldFixing && (
                <div className="mt-6 p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl">
                  <label className="block text-sm font-medium text-blue-700 mb-4">Payment Method</label>
                  
                  <div className="flex space-x-8 mb-6">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="payment-method"
                        value="cash"
                        checked={formData.paymentMethod === 'cash'}
                        onChange={(e) => handleChange('paymentMethod', e.target.value)}
                        className="h-5 w-5 text-blue-600 border-2 border-blue-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-base text-blue-700 font-medium">Cash</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="payment-method"
                        value="cheque"
                        checked={formData.paymentMethod === 'cheque'}
                        onChange={(e) => handleChange('paymentMethod', e.target.value)}
                        className="h-5 w-5 text-blue-600 border-2 border-blue-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-base text-blue-700 font-medium">Cheque</span>
                    </label>
                  </div>

                  {formData.paymentMethod === 'cheque' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Bank Name *</label>
                        <input
                          type="text"
                          placeholder="Enter bank name"
                          value={formData.bankName || ""}
                          onChange={(e) => handleChange('bankName', e.target.value)}
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Branch *</label>
                        <input
                          type="text"
                          placeholder="Enter branch"
                          value={formData.branch || ""}
                          onChange={(e) => handleChange('branch', e.target.value)}
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Cheque No *</label>
                        <input
                          type="text"
                          placeholder="Enter cheque number"
                          value={formData.chequeNo || ""}
                          onChange={(e) => handleChange('chequeNo', e.target.value)}
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Cheque Date *</label>
                        <input
                          type="date"
                          value={formData.chequeDate || ""}
                          onChange={(e) => handleChange('chequeDate', e.target.value)}
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Cheque Amount</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={formData.chequeAmount || 0}
                          readOnly
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 bg-blue-100 text-blue-600 cursor-not-allowed text-base"
                        />
                        <p className="text-sm text-blue-500 mt-2">Same as Fixing Amount</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-8 border-t-2 border-blue-300">
              <button
                type="submit"
                disabled={isSubmitting || !selectedType || !selectedAccountId}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  "Update Voucher"
                )}
              </button>
              
              <Link
                href="/vouchers/list"
                className="flex-1 px-6 py-3 border-2 border-blue-300 text-blue-700 rounded-2xl bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors font-medium text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="text-3xl font-bold text-blue-800">1</div>
            <div className="text-sm text-blue-700">Voucher</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="text-3xl font-bold text-blue-800">
              {formData.gold.toFixed(3)}
            </div>
            <div className="text-sm text-blue-700">Gold</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
            <div className="text-3xl font-bold text-blue-800">
              {formData.kwd.toFixed(3)}
            </div>
            <div className="text-sm text-blue-700">KWD</div>
          </div>
        </div>
      </div>
    </main>
  );
}