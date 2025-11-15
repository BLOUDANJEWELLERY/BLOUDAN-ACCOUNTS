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
  const [showVoucherTypeDropdown, setShowVoucherTypeDropdown] = useState<number | null>(null);

  // Group accounts by type
  const accountsByType = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const accountTypes = Object.keys(accountsByType);

  // Predefined rates for faceting - including 0 as requested
  const predefinedRates = [0, 0.15, 0.20, 0.25, 0.3, 0.35, 0.4, 0.5];
  
  // Predefined descriptions for Project account type
  const projectInvDescriptions = ["Reni", "KDM", "Casting"];
  const projectRecDescriptions = ["Bangles", "Kids Bangles", "Tanka", "Parchoon", "Sawan", "Casting Return", "Gold", "Reni"];
  const projectAllDescriptions = [...new Set([...projectInvDescriptions, ...projectRecDescriptions])];

  // Predefined descriptions for Faceting
  const facetingDescriptions = ["Bangles", "Kids Bangles", "Gold Powder"];

  // Predefined descriptions for Casting
  const castingAllDescriptions = ["Gold", "Scrap", "Casting", "Casting Return", "Payment of"];
  const castingInvDescriptions = ["Gold", "Casting Return", "Payment of"];
  const castingRecDescriptions = ["Casting", "Scrap"];

  // Predefined descriptions for Gold Fixing
  const goldFixingGFVDescriptions = ["Gold Fixing @"];
  const goldFixingRecDescriptions = ["Gold"];
  const goldFixingInvDescriptions = ["Cash", "K-Net"];

  // Predefined rates for Casting
  const castingRates = [0, 0.08];

  // Predefined bank names
  const bankNames = ["Al-Ahli", "NBK", "CBK", "Gulf Bank"];

  // Predefined branch names
  const branchNames = ["Hawalli", "Farwaniya", "Jabriya"];

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

  // Get default voucher type based on description and account type
  const getDefaultVoucherType = (description: string, accountType: string): string => {
    if (accountType === "Project") {
      if (["Bangles", "Kids Bangles", "Casting Return"].includes(description)) {
        return "REC";
      } else if (["KDM", "Casting"].includes(description)) {
        return "INV";
      }
    } else if (accountType === "Casting") {
      if (["Gold", "Casting Return", "Payment of"].includes(description)) {
        return "INV";
      } else if (["Casting", "Scrap"].includes(description)) {
        return "REC";
      }
    } else if (accountType === "Faceting") {
      if (description === "Gold Powder") {
        return "REC";
      }
    } else if (accountType === "Gold Fixing") {
      if (description === "Gold Fixing @") {
        return "GFV";
      } else if (description === "Gold") {
        return "REC";
      } else if (["Cash", "K-Net"].includes(description)) {
        return "INV";
      }
    }
    return "";
  };

  // Check if should show gold fixing section
  const shouldShowGoldFixing = (form: VoucherForm) => {
    return selectedType === "Market" && form.vt === "REC";
  };

  // Check if should show faceting quantity and rate section
  const shouldShowFacetingFields = (form: VoucherForm) => {
    return selectedType === "Faceting" && form.vt === "REC";
  };

  // Check if should show casting calculation section
  const shouldShowCastingCalculation = (form: VoucherForm) => {
    return selectedType === "Casting" && (form.vt === "REC" || form.vt === "INV");
  };

  // Check if should show description quick select
  const shouldShowDescriptionQuickSelect = () => {
    return selectedType === "Project" || selectedType === "Faceting" || 
           selectedType === "Casting" || selectedType === "Gold Fixing";
  };

  // Get available descriptions based on account type and voucher type
  const getAvailableDescriptions = (vt: string) => {
    if (selectedType === "Project") {
      if (!vt) {
        return projectAllDescriptions;
      } else if (vt === "INV") {
        return projectInvDescriptions;
      } else if (vt === "REC") {
        return projectRecDescriptions;
      }
      return projectAllDescriptions;
    } else if (selectedType === "Faceting") {
      if (vt === "INV") {
        return ["Bangles", "Kids Bangles"];
      }
      return facetingDescriptions;
    } else if (selectedType === "Casting") {
      if (!vt) {
        return castingAllDescriptions;
      } else if (vt === "INV") {
        return castingInvDescriptions;
      }
      return castingRecDescriptions;
    } else if (selectedType === "Gold Fixing") {
      if (vt === "GFV") {
        return goldFixingGFVDescriptions;
      } else if (vt === "REC") {
        return goldFixingRecDescriptions;
      } else if (vt === "INV") {
        return goldFixingInvDescriptions;
      }
      return [...goldFixingGFVDescriptions, ...goldFixingRecDescriptions, ...goldFixingInvDescriptions];
    }
    return [];
  };

  // Get default rate based on description and account type
  const getDefaultRateForDescription = (description: string, vt: string): number => {
    if (selectedType === "Project") {
      return 0;
    } else if (selectedType === "Faceting") {
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
      if (vt === "INV") {
        switch (description) {
          case "Casting Return":
          case "Scrap":
            return 0.08;
          default:
            return 0;
        }
      }
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

  // Calculate KWD for Casting vouchers
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
            selectedType === "Casting" ? 0 : 
            selectedType === "Project" ? 0 : undefined
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

  // Set default rate when account type is selected and form is added
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
              selectedType === "Casting" ? 0 : 
              selectedType === "Project" ? 0 : undefined
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
        
        // Handle description change - set voucher type and rate based on description
        if (field === 'description' && value) {
          const defaultVoucherType = getDefaultVoucherType(value, selectedType);
          const defaultRate = getDefaultRateForDescription(value, defaultVoucherType);
          updatedForm.vt = defaultVoucherType || form.vt;
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

        // Handle Casting calculations for REC vouchers (auto-calculate KWD)
        if (shouldShowCastingCalculation(updatedForm) && updatedForm.vt === "REC") {
          if (field === 'gold' || field === 'rate') {
            const calculatedKwd = calculateKwdForCasting(
              field === 'gold' ? value : updatedForm.gold,
              field === 'rate' ? value : updatedForm.rate
            );
            updatedForm.kwd = calculatedKwd;
          }
        }

        // Handle Casting calculations for INV vouchers (auto-calculate KWD but allow manual override)
        if (shouldShowCastingCalculation(updatedForm) && updatedForm.vt === "INV") {
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

  // Handle description selection from quick select - APPEND text instead of replacing
  const handleDescriptionSelect = (index: number, value: string) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        const currentDescription = form.description || "";
        let newDescription = "";
        
        if (currentDescription.trim() === "") {
          newDescription = value;
        } else {
          newDescription = currentDescription.endsWith(' ') 
            ? currentDescription + value 
            : currentDescription + ' ' + value;
        }
        
        const defaultVoucherType = getDefaultVoucherType(value, selectedType);
        const defaultRate = getDefaultRateForDescription(value, defaultVoucherType);
        
        const updatedForm = { 
          ...form, 
          description: newDescription,
          vt: defaultVoucherType || form.vt,
          rate: defaultRate
        };
        
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
        
        if (selectedType === "Faceting" && updatedForm.quantity !== undefined) {
          updatedForm.kwd = calculateKwdForFaceting(updatedForm.quantity, value);
        } else if (selectedType === "Casting" && updatedForm.gold !== undefined) {
          if (updatedForm.vt === "REC") {
            updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, value);
          } else if (updatedForm.vt === "INV") {
            updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, value);
          }
        }
        
        return updatedForm;
      }
      return form;
    }));
  };

  // Handle bank name selection from quick select
  const handleBankNameSelect = (index: number, value: string) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        return { ...form, bankName: value };
      }
      return form;
    }));
  };

  // Handle branch selection from quick select
  const handleBranchSelect = (index: number, value: string) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        return { ...form, branch: value };
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
      
      if (form.vt === "GFV" && (!form.goldRate || form.goldRate <= 0)) {
        return alert(`Gold Rate is required and must be greater than 0 for GFV voucher ${i + 1}`);
      }

      if (shouldShowGoldFixing(form) && form.isGoldFixing && (!form.goldRate || form.goldRate <= 0)) {
        return alert(`Gold Rate is required when Gold Fixing is checked for voucher ${i + 1}`);
      }

      if (shouldShowFacetingFields(form)) {
        if (!form.quantity || form.quantity <= 0) {
          return alert(`Quantity is required and must be greater than 0 for Faceting REC voucher ${i + 1}`);
        }
        if (form.rate === undefined || form.rate < 0) {
          return alert(`Rate is required and must be non-negative for Faceting REC voucher ${i + 1}`);
        }
      }

      if (shouldShowCastingCalculation(form) && form.vt === "REC") {
        if (!form.gold || form.gold <= 0) {
          return alert(`Gold is required and must be greater than 0 for Casting REC voucher ${i + 1}`);
        }
        if (form.rate === undefined || form.rate < 0) {
          return alert(`Rate is required and must be non-negative for Casting REC voucher ${i + 1}`);
        }
      }

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
        
        const baseVoucher: any = {
          date: date.toISOString(),
          vt: form.vt,
          accountId: form.accountId,
          gold: parseFloat(form.gold.toString()) || 0,
          kwd: parseFloat(form.kwd.toString()) || 0,
          paymentMethod: form.paymentMethod,
        };

        if (selectedType === "Market" && form.mvn?.trim()) {
          baseVoucher.mvn = form.mvn;
        }

        if (selectedType !== "Market" && form.description?.trim()) {
          baseVoucher.description = form.description;
        }

        if ((form.vt === "GFV" || (shouldShowGoldFixing(form) && form.isGoldFixing)) && form.goldRate) {
          baseVoucher.goldRate = parseFloat(form.goldRate.toString()) || 0;
        }

        if (shouldShowGoldFixing(form) && form.isGoldFixing && form.fixingAmount) {
          baseVoucher.fixingAmount = parseFloat(form.fixingAmount.toString()) || 0;
        }

        if (shouldShowFacetingFields(form) && form.quantity) {
          baseVoucher.quantity = parseInt(form.quantity.toString()) || 0;
        }

        if (shouldShowFacetingFields(form) && form.rate !== undefined) {
          baseVoucher.rate = parseFloat(form.rate.toString()) || 0;
        }

        if (shouldShowCastingCalculation(form) && form.rate !== undefined) {
          baseVoucher.rate = parseFloat(form.rate.toString()) || 0;
        }

        if (selectedType === "Project" && form.rate !== undefined) {
          baseVoucher.rate = parseFloat(form.rate.toString()) || 0;
        }

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

  const getVoucherTypeBadgeColor = (vt: string) => {
    switch (vt) {
      case "INV": return "bg-red-100 text-red-800 border-red-200";
      case "REC": return "bg-green-100 text-green-800 border-green-200";
      case "GFV": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
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
          
          {/* Account Selection - NEW APPROACH */}
          <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Select Account *
            </label>
            
            {/* Account Type Selection - Dropdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                >
                  <option value="">Select Account Type</option>
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type} ({accountsByType[type].length} accounts)
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Selection - Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={!selectedType}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Account</option>
                  {filteredAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountNo} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Account Display */}
            {selectedAccountId && (
              <div className="mt-4 flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    ✓
                  </div>
                  <div>
                    <div className="font-semibold text-green-900 text-sm">
                      {accounts.find(a => a.id === selectedAccountId)?.accountNo} - {accounts.find(a => a.id === selectedAccountId)?.name}
                    </div>
                    <div className="text-xs text-green-600">
                      {selectedType}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedType("");
                    setSelectedAccountId("");
                  }}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Voucher Forms - Only show after account is selected */}
          {selectedAccountId && (
            <div className="space-y-6">
              {voucherForms.map((form, index) => (
                <div key={index} className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-white hover:border-blue-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                      <h3 className="font-semibold text-gray-700">Voucher #{index + 1}</h3>
                      {form.vt && (
                        <span className={`px-3 py-1 text-xs font-medium border rounded-full ${getVoucherTypeBadgeColor(form.vt)}`}>
                          {form.vt}
                        </span>
                      )}
                    </div>
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
                  
                  {/* Basic Voucher Fields - Grid Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Date Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => updateVoucherForm(index, 'date', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                      />
                    </div>

                    {/* Voucher Type - NEW DROPDOWN APPROACH */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Voucher Type *</label>
                      <button
                        type="button"
                        onClick={() => setShowVoucherTypeDropdown(showVoucherTypeDropdown === index ? null : index)}
                        className={`w-full border rounded-lg px-4 py-3 text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base ${
                          form.vt 
                            ? `${getVoucherTypeBadgeColor(form.vt)} border-current` 
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        {form.vt ? getVoucherTypes().find(vt => vt.value === form.vt)?.label : "Select Voucher Type"}
                        <span className="float-right">▼</span>
                      </button>
                      
                      {showVoucherTypeDropdown === index && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                          {getVoucherTypes().map((voucherType) => (
                            <button
                              key={voucherType.value}
                              type="button"
                              onClick={() => {
                                updateVoucherForm(index, 'vt', voucherType.value);
                                setShowVoucherTypeDropdown(null);
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                                form.vt === voucherType.value ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                            >
                              {voucherType.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Gold Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Gold</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={form.gold}
                        onChange={(e) => updateVoucherForm(index, 'gold', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                      />
                    </div>

                    {/* KWD Field */}
                    {form.vt !== "GFV" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">KWD</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={form.kwd}
                          readOnly={shouldShowFacetingFields(form) || (shouldShowCastingCalculation(form) && form.vt === "REC")}
                          onChange={(e) => updateVoucherForm(index, 'kwd', parseFloat(e.target.value) || 0)}
                          className={`w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base ${
                            (shouldShowFacetingFields(form) || (shouldShowCastingCalculation(form) && form.vt === "REC")) ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* MVN or Description Field - Full Width */}
                  <div className="mb-4">
                    {selectedType === "Market" ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Manual Voucher No *</label>
                        <input
                          type="text"
                          placeholder="Enter MVN"
                          value={form.mvn || ""}
                          onChange={(e) => updateVoucherForm(index, 'mvn', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                        <input
                          type="text"
                          placeholder="Enter description"
                          value={form.description || ""}
                          onChange={(e) => updateVoucherForm(index, 'description', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                        />
                        
                        {/* Description Quick Select */}
                        {shouldShowDescriptionQuickSelect() && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select:</label>
                            <div className="flex flex-wrap gap-2">
                              {getAvailableDescriptions(form.vt).map((desc) => (
                                <button
                                  key={desc}
                                  type="button"
                                  onClick={() => handleDescriptionSelect(index, desc)}
                                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors font-medium"
                                >
                                  {desc}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Conditional Sections (Gold Fixing, Faceting, Casting, GFV) - Same as before but simplified */}
                  {/* Gold Fixing Section */}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Gold Rate *</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              value={form.goldRate || ""}
                              onChange={(e) => updateVoucherForm(index, 'goldRate', parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fixing Amount</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              value={form.fixingAmount || 0}
                              readOnly
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-100 text-gray-600 cursor-not-allowed text-base"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* GFV Voucher Type */}
                  {form.vt === "GFV" && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Gold Rate *</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={form.goldRate || ""}
                            onChange={(e) => updateVoucherForm(index, 'goldRate', parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">KWD</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            value={form.kwd}
                            readOnly
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-100 text-gray-600 cursor-not-allowed text-base"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Method Section */}
                  {shouldShowGoldFixing(form) && form.isGoldFixing && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
                      
                      <div className="flex space-x-6 mb-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name={`payment-method-${index}`}
                            value="cash"
                            checked={form.paymentMethod === 'cash'}
                            onChange={(e) => updateVoucherForm(index, 'paymentMethod', e.target.value)}
                            className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-base text-gray-700 font-medium">Cash</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name={`payment-method-${index}`}
                            value="cheque"
                            checked={form.paymentMethod === 'cheque'}
                            onChange={(e) => updateVoucherForm(index, 'paymentMethod', e.target.value)}
                            className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-base text-gray-700 font-medium">Cheque</span>
                        </label>
                      </div>

                      {form.paymentMethod === 'cheque' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                            <input
                              type="text"
                              placeholder="Enter bank name"
                              value={form.bankName || ""}
                              onChange={(e) => updateVoucherForm(index, 'bankName', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                            <input
                              type="text"
                              placeholder="Enter branch"
                              value={form.branch || ""}
                              onChange={(e) => updateVoucherForm(index, 'branch', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cheque No *</label>
                            <input
                              type="text"
                              placeholder="Enter cheque number"
                              value={form.chequeNo || ""}
                              onChange={(e) => updateVoucherForm(index, 'chequeNo', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cheque Date *</label>
                            <input
                              type="date"
                              value={form.chequeDate || ""}
                              onChange={(e) => updateVoucherForm(index, 'chequeDate', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

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
          )}
        </div>

        {/* Quick Stats */}
        {selectedAccountId && (
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
        )}
      </div>
    </main>
  );
}