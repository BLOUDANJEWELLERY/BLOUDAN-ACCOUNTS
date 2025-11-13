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
  goldRate?: number;
  isGoldFixing?: boolean;
  fixingAmount?: number;
  paymentMethod: 'cash' | 'cheque';
  bankName?: string;
  branch?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeAmount?: number;
  quantity?: number;
  rate?: number;
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
    { 
      date: new Date().toISOString().split('T')[0], 
      vt: "", 
      accountId: "", 
      gold: 0, 
      kwd: 0,
      paymentMethod: 'cash'
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined rates for faceting - including 0 as requested
  const predefinedRates = [0, 0.15, 0.20, 0.25, 0.3, 0.35, 0.4, 0.5];
  
  // Predefined descriptions for faceting
  const facetingDescriptions = ["Bangles", "Kids Bangles", "Gold Powder"];

  // Predefined descriptions for Casting
  const castingInvDescriptions = ["Gold", "Scrap", "Casting Return", "Payment of"];
  const castingRecDescriptions = ["Casting", "Scrap"];

  // Predefined rates for Casting
  const castingRates = [0, 0.08];

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

  // Check if should show gold fixing section
  const shouldShowGoldFixing = (form: VoucherForm) => {
    return selectedType === "Market" && form.vt === "REC";
  };

  // Check if should show faceting quantity and rate section
  const shouldShowFacetingFields = (form: VoucherForm) => {
    return selectedType === "Faceting" && form.vt === "REC";
  };

  // Check if should show casting gold and rate section
  const shouldShowCastingFields = (form: VoucherForm) => {
    return selectedType === "Casting" && form.vt === "REC";
  };

  // Check if should show faceting description quick select
  const shouldShowFacetingDescription = () => {
    return selectedType === "Faceting";
  };

  // Check if should show casting description quick select
  const shouldShowCastingDescription = () => {
    return selectedType === "Casting";
  };

  // Get available descriptions based on account type and voucher type
  const getAvailableDescriptions = (vt: string) => {
    if (selectedType === "Faceting") {
      if (vt === "INV") {
        return ["Bangles", "Kids Bangles"];
      }
      return facetingDescriptions; // For REC and other types, show all
    } else if (selectedType === "Casting") {
      if (vt === "INV") {
        return castingInvDescriptions;
      }
      return castingRecDescriptions; // For REC, show Casting and Scrap only
    }
    return [];
  };

  // Get default rate based on description and account type
  const getDefaultRateForDescription = (description: string): number => {
    if (selectedType === "Faceting") {
      switch (description) {
        case "Bangles":
          return 0.25;
        case "Kids Bangles":
          return 0.2;
        case "Gold Powder":
          return 0;
        default:
          return 0.25;
      }
    } else if (selectedType === "Casting") {
      switch (description) {
        case "Casting":
          return 0.08;
        case "Scrap":
          return 0;
        default:
          return 0;
      }
    }
    return 0;
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

  // Calculate KWD for Faceting REC vouchers
  const calculateKwdForFaceting = (quantity: number | undefined, rate: number | undefined): number => {
    if (!quantity || quantity <= 0 || !rate || rate < 0) return 0;
    return quantity * rate;
  };

  // Calculate KWD for Casting REC vouchers
  const calculateKwdForCasting = (gold: number | undefined, rate: number | undefined): number => {
    if (!gold || gold <= 0 || !rate || rate < 0) return 0;
    return gold * rate;
  };

  // Reset account when type changes
  useEffect(() => {
    setSelectedAccountId("");
    setVoucherForms(forms => forms.map(form => ({
      ...form,
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
      chequeAmount: 0,
      quantity: undefined,
      rate: selectedType === "Faceting" ? 0.25 : 
            selectedType === "Casting" ? 0 : undefined // Set default rate based on type
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

  // Set default rate when faceting is selected and form is added
  const addVoucherForm = () => {
    setVoucherForms(forms => [
      ...forms,
      { 
        date: new Date().toISOString().split('T')[0], 
        vt: "", 
        accountId: selectedAccountId, 
        gold: 0, 
        kwd: 0,
        paymentMethod: 'cash',
        isGoldFixing: false,
        goldRate: undefined,
        fixingAmount: 0,
        quantity: undefined,
        rate: selectedType === "Faceting" ? 0.25 : 
              selectedType === "Casting" ? 0 : undefined // Set default rate for new forms
      }
    ]);
  };

  const removeVoucherForm = (index: number) => {
    if (voucherForms.length > 1) {
      setVoucherForms(forms => forms.filter((_, i) => i !== index));
    }
  };

  const updateVoucherForm = (index: number, field: keyof VoucherForm, value: any) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        const updatedForm = { ...form, [field]: value };
        
        // Handle description change - set rate based on description
        if (field === 'description' && value) {
          const defaultRate = getDefaultRateForDescription(value);
          updatedForm.rate = defaultRate;
          
          // Recalculate KWD based on account type
          if (selectedType === "Faceting" && updatedForm.quantity) {
            updatedForm.kwd = calculateKwdForFaceting(updatedForm.quantity, defaultRate);
          } else if (selectedType === "Casting" && updatedForm.gold) {
            updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, defaultRate);
          }
        }
        
        // Handle GFV voucher calculations
        if (updatedForm.vt === "GFV") {
          if (field === 'gold' || field === 'goldRate') {
            const calculatedKwd = calculateKwdForGFV(
              field === 'gold' ? value : updatedForm.gold,
              field === 'goldRate' ? value : updatedForm.goldRate
            );
            updatedForm.kwd = calculatedKwd;
          }
        }
        
        // Handle Gold Fixing calculations
        if (shouldShowGoldFixing(updatedForm) && updatedForm.isGoldFixing) {
          if (field === 'gold' || field === 'goldRate') {
            const calculatedFixingAmount = calculateFixingAmount(
              field === 'gold' ? value : updatedForm.gold,
              field === 'goldRate' ? value : updatedForm.goldRate
            );
            updatedForm.fixingAmount = calculatedFixingAmount;
            
            // Update cheque amount if payment method is cheque
            if (updatedForm.paymentMethod === 'cheque') {
              updatedForm.chequeAmount = calculatedFixingAmount;
            }
          }
        }

        // Handle Faceting calculations
        if (shouldShowFacetingFields(updatedForm)) {
          if (field === 'quantity' || field === 'rate') {
            const calculatedKwd = calculateKwdForFaceting(
              field === 'quantity' ? value : updatedForm.quantity,
              field === 'rate' ? value : updatedForm.rate
            );
            updatedForm.kwd = calculatedKwd;
          }
        }

        // Handle Casting calculations
        if (shouldShowCastingFields(updatedForm)) {
          if (field === 'gold' || field === 'rate') {
            const calculatedKwd = calculateKwdForCasting(
              field === 'gold' ? value : updatedForm.gold,
              field === 'rate' ? value : updatedForm.rate
            );
            updatedForm.kwd = calculatedKwd;
          }
        }

        // Reset cheque-related fields when switching to cash
        if (field === 'paymentMethod' && value === 'cash') {
          updatedForm.bankName = "";
          updatedForm.branch = "";
          updatedForm.chequeNo = "";
          updatedForm.chequeDate = "";
          updatedForm.chequeAmount = 0;
        }

        // When switching to cheque, set cheque amount to fixing amount
        if (field === 'paymentMethod' && value === 'cheque' && updatedForm.isGoldFixing) {
          updatedForm.chequeAmount = updatedForm.fixingAmount || 0;
        }

        // Update cheque amount when fixing amount changes and payment method is cheque
        if (field === 'fixingAmount' && updatedForm.paymentMethod === 'cheque') {
          updatedForm.chequeAmount = value;
        }

        return updatedForm;
      }
      return form;
    }));
  };

  // Handle description selection from quick select
  const handleDescriptionSelect = (index: number, value: string) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        const defaultRate = getDefaultRateForDescription(value);
        const updatedForm = { 
          ...form, 
          description: value,
          rate: defaultRate
        };
        
        // Recalculate KWD based on account type
        if (selectedType === "Faceting" && updatedForm.quantity) {
          updatedForm.kwd = calculateKwdForFaceting(updatedForm.quantity, defaultRate);
        } else if (selectedType === "Casting" && updatedForm.gold) {
          updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, defaultRate);
        }
        
        return updatedForm;
      }
      return form;
    }));
  };

  // Handle rate selection from quick select
  const handleRateSelect = (index: number, value: number) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        const updatedForm = { ...form, rate: value };
        
        // Recalculate KWD based on account type
        if (selectedType === "Faceting" && updatedForm.quantity !== undefined) {
          updatedForm.kwd = calculateKwdForFaceting(updatedForm.quantity, value);
        } else if (selectedType === "Casting" && updatedForm.gold !== undefined) {
          updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, value);
        }
        
        return updatedForm;
      }
      return form;
    }));
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
      
      // Additional validation for GFV vouchers
      if (form.vt === "GFV" && (!form.goldRate || form.goldRate <= 0)) {
        return alert(`Gold Rate is required and must be greater than 0 for GFV voucher ${i + 1}`);
      }

      // Additional validation for Gold Fixing in Market REC
      if (shouldShowGoldFixing(form) && form.isGoldFixing && (!form.goldRate || form.goldRate <= 0)) {
        return alert(`Gold Rate is required when Gold Fixing is checked for voucher ${i + 1}`);
      }

      // Additional validation for Faceting REC vouchers
      if (shouldShowFacetingFields(form)) {
        if (!form.quantity || form.quantity <= 0) {
          return alert(`Quantity is required and must be greater than 0 for Faceting REC voucher ${i + 1}`);
        }
        if (form.rate === undefined || form.rate < 0) {
          return alert(`Rate is required and must be non-negative for Faceting REC voucher ${i + 1}`);
        }
      }

      // Additional validation for Casting REC vouchers
      if (shouldShowCastingFields(form)) {
        if (!form.gold || form.gold <= 0) {
          return alert(`Gold is required and must be greater than 0 for Casting REC voucher ${i + 1}`);
        }
        if (form.rate === undefined || form.rate < 0) {
          return alert(`Rate is required and must be non-negative for Casting REC voucher ${i + 1}`);
        }
      }

      // Validation for cheque payments
      if (form.paymentMethod === 'cheque') {
        if (!form.bankName?.trim() || !form.branch?.trim() || !form.chequeNo?.trim() || !form.chequeDate) {
          return alert(`All cheque details are required for voucher ${i + 1}`);
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload = voucherForms.map(form => {
        const date = new Date(form.date);
        
        // Create base voucher object with required fields
        const baseVoucher: any = {
          date: date.toISOString(),
          vt: form.vt,
          accountId: form.accountId,
          gold: parseFloat(form.gold.toString()) || 0,
          kwd: parseFloat(form.kwd.toString()) || 0,
          paymentMethod: form.paymentMethod,
        };

        // Only include mvn for Market accounts
        if (selectedType === "Market" && form.mvn?.trim()) {
          baseVoucher.mvn = form.mvn;
        }

        // Only include description for non-Market accounts
        if (selectedType !== "Market" && form.description?.trim()) {
          baseVoucher.description = form.description;
        }

        // Include goldRate for GFV vouchers or when Gold Fixing is checked
        if ((form.vt === "GFV" || (shouldShowGoldFixing(form) && form.isGoldFixing)) && form.goldRate) {
          baseVoucher.goldRate = parseFloat(form.goldRate.toString()) || 0;
        }

        // Include fixing amount when Gold Fixing is checked
        if (shouldShowGoldFixing(form) && form.isGoldFixing && form.fixingAmount) {
          baseVoucher.fixingAmount = parseFloat(form.fixingAmount.toString()) || 0;
        }

        // Include quantity for Faceting REC vouchers
        if (shouldShowFacetingFields(form) && form.quantity) {
          baseVoucher.quantity = parseInt(form.quantity.toString()) || 0;
        }

        // Include rate for Faceting REC vouchers (can be 0)
        if (shouldShowFacetingFields(form) && form.rate !== undefined) {
          baseVoucher.rate = parseFloat(form.rate.toString()) || 0;
        }

        // Include rate for Casting REC vouchers (can be 0)
        if (shouldShowCastingFields(form) && form.rate !== undefined) {
          baseVoucher.rate = parseFloat(form.rate.toString()) || 0;
        }

        // Include cheque details if payment method is cheque
        if (form.paymentMethod === 'cheque') {
          baseVoucher.bankName = form.bankName;
          baseVoucher.branch = form.branch;
          baseVoucher.chequeNo = form.chequeNo;
          if (form.chequeDate) {
            baseVoucher.chequeDate = new Date(form.chequeDate).toISOString();
          }
          baseVoucher.chequeAmount = parseFloat(form.chequeAmount?.toString() || "0") || 0;
        }

        return baseVoucher;
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
        kwd: 0,
        paymentMethod: 'cash'
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
      <div className="max-w-6xl mx-auto">
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
          <div className="space-y-6">
            {voucherForms.map((form, index) => (
              <div key={index} className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-white hover:border-blue-300 transition-colors">
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
                
                {/* Basic Voucher Fields */}
                <div className={`grid grid-cols-1 ${
                  shouldShowGoldFixing(form) && form.isGoldFixing 
                    ? "sm:grid-cols-2 lg:grid-cols-4" 
                    : form.vt === "GFV"
                    ? "sm:grid-cols-2 lg:grid-cols-3"
                    : shouldShowFacetingFields(form) || shouldShowCastingFields(form)
                    ? "sm:grid-cols-2 lg:grid-cols-4"
                    : "sm:grid-cols-2 lg:grid-cols-4"
                } gap-4 mb-4`}>
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
                      
                      {/* Description Quick Select for Faceting and Casting */}
                      {(shouldShowFacetingDescription() || shouldShowCastingDescription()) && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-500 mb-2">Quick Select Descriptions:</label>
                          <div className="flex flex-wrap gap-2">
                            {getAvailableDescriptions(form.vt).map((desc) => (
                              <button
                                key={desc}
                                type="button"
                                onClick={() => handleDescriptionSelect(index, desc)}
                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                  form.description === desc
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                {desc}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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

                  {/* KWD Field - Show only for non-GFV vouchers */}
                  {form.vt !== "GFV" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">KWD</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={form.kwd}
                        readOnly={shouldShowFacetingFields(form) || shouldShowCastingFields(form)}
                        onChange={(e) => updateVoucherForm(index, 'kwd', parseFloat(e.target.value) || 0)}
                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                          (shouldShowFacetingFields(form) || shouldShowCastingFields(form)) ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Gold Fixing Section - Only for Market REC */}
                {shouldShowGoldFixing(form) && (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id={`gold-fixing-${index}`}
                        checked={form.isGoldFixing || false}
                        onChange={(e) => updateVoucherForm(index, 'isGoldFixing', e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`gold-fixing-${index}`} className="ml-2 block text-sm font-medium text-gray-700">
                        Gold Fixing
                      </label>
                    </div>

                    {form.isGoldFixing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Gold Rate *</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={form.goldRate || ""}
                            onChange={(e) => updateVoucherForm(index, 'goldRate', parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Fixing Amount</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            value={form.fixingAmount || 0}
                            readOnly
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                          <p className="text-xs text-gray-500 mt-1">Calculated automatically from Gold × Gold Rate</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Faceting Section - Only for Faceting REC */}
                {shouldShowFacetingFields(form) && (
                  <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-800 mb-3">Faceting Calculation</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantity *</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="1"
                          value={form.quantity || ""}
                          onChange={(e) => updateVoucherForm(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                        />
                        <p className="text-xs text-gray-500 mt-1">Number of pieces</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rate *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.001"
                          min="0"
                          value={form.rate !== undefined ? form.rate : 0.25}
                          onChange={(e) => updateVoucherForm(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>
                    
                    {/* Common Rates Quick Select */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Quick Select Rates:</label>
                      <div className="flex flex-wrap gap-2">
                        {predefinedRates.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleRateSelect(index, rate)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              form.rate === rate
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
                            }`}
                          >
                            {rate}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Casting Section - Only for Casting REC */}
                {shouldShowCastingFields(form) && (
                  <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="text-sm font-medium text-orange-800 mb-3">Casting Calculation</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Gold *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={form.gold}
                          onChange={(e) => updateVoucherForm(index, 'gold', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rate *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.001"
                          min="0"
                          value={form.rate !== undefined ? form.rate : 0}
                          onChange={(e) => updateVoucherForm(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        />
                      </div>
                    </div>
                    
                    {/* Casting Rates Quick Select */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Quick Select Rates:</label>
                      <div className="flex flex-wrap gap-2">
                        {castingRates.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleRateSelect(index, rate)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              form.rate === rate
                                ? 'bg-orange-600 text-white border-orange-600'
                                : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                            }`}
                          >
                            {rate}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* GFV Voucher Type - Show only one KWD field inside container */}
                {form.vt === "GFV" && (
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
                          value={form.goldRate || ""}
                          onChange={(e) => updateVoucherForm(index, 'goldRate', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          KWD
                          {form.goldRate && form.gold > 0 && (
                            <span className="text-green-600 ml-1">
                              (Gold {form.gold} × Rate {form.goldRate})
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={form.kwd}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Calculated automatically from Gold × Gold Rate</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Method Section - Only for Market REC with Gold Fixing */}
                {shouldShowGoldFixing(form) && form.isGoldFixing && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
                    
                    <div className="flex space-x-4 mb-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`payment-method-${index}`}
                          value="cash"
                          checked={form.paymentMethod === 'cash'}
                          onChange={(e) => updateVoucherForm(index, 'paymentMethod', e.target.value)}
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Cash</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`payment-method-${index}`}
                          value="cheque"
                          checked={form.paymentMethod === 'cheque'}
                          onChange={(e) => updateVoucherForm(index, 'paymentMethod', e.target.value)}
                          className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Cheque</span>
                      </label>
                    </div>

                    {form.paymentMethod === 'cheque' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name *</label>
                          <input
                            type="text"
                            placeholder="Enter bank name"
                            value={form.bankName || ""}
                            onChange={(e) => updateVoucherForm(index, 'bankName', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Branch *</label>
                          <input
                            type="text"
                            placeholder="Enter branch"
                            value={form.branch || ""}
                            onChange={(e) => updateVoucherForm(index, 'branch', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Cheque No *</label>
                          <input
                            type="text"
                            placeholder="Enter cheque number"
                            value={form.chequeNo || ""}
                            onChange={(e) => updateVoucherForm(index, 'chequeNo', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Cheque Date *</label>
                          <input
                            type="date"
                            value={form.chequeDate || ""}
                            onChange={(e) => updateVoucherForm(index, 'chequeDate', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Cheque Amount</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            value={form.chequeAmount || 0}
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