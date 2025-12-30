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

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, accountNo: true, name: true, type: true },
    orderBy: { accountNo: "asc" },
  });

  return {
    props: {
      accounts: JSON.parse(JSON.stringify(accounts)),
    },
  };
}

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

  // Prevent zooming on keyboard interactions and pinch-to-zoom without affecting scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=')) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

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
        { value: "INV", label: "Invoice", color: "red" },
        { value: "REC", label: "Receipt", color: "green" },
        { value: "GFV", label: "Gold Fixing", color: "yellow" }
      ];
    } else if (selectedType === "Project") {
      return [
        { value: "INV", label: "Invoice", color: "red" },
        { value: "REC", label: "Receipt", color: "green" },
        { value: "Alloy", label: "Alloy", color: "blue" }
      ];
    } else {
      return [
        { value: "INV", label: "Invoice", color: "red" },
        { value: "REC", label: "Receipt", color: "green" }
      ];
    }
  };

  // Get default voucher type based on description and account type
  const getDefaultVoucherType = (description: string, accountType: string): string => {
    if (accountType === "Project") {
      if (["Bangles", "Kids Bangles", "Casting Return"].includes(description)) {
        return "REC";
      } else if (description === "KDM") {
        return "Alloy";
      } else if (description === "Casting") {
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
      } else if (vt === "Alloy") {
        return ["KDM"];
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

  // Get account type color
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
            selectedType === "Project" ? 0 : undefined,
      kwd: 0
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
        
        // For Project accounts, set KWD to 0 and don't perform any KWD calculations
        if (selectedType === "Project") {
          updatedForm.kwd = 0;
          
          // Return early to avoid all KWD calculations for Project
          return updatedForm;
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

  // Handle description selection from quick select - APPEND text and SET voucher type
  const handleDescriptionSelect = (index: number, value: string) => {
    setVoucherForms(forms => forms.map((form, i) => {
      if (i === index) {
        // Get current description and append new value with proper spacing
        const currentDescription = form.description || "";
        let newDescription = "";
        
        if (currentDescription.trim() === "") {
          // If current description is empty, just use the value
          newDescription = value;
        } else {
          // If current description ends with space, append value directly
          // Otherwise, add space before appending value
          newDescription = currentDescription.endsWith(' ') 
            ? currentDescription + value 
            : currentDescription + ' ' + value;
        }
        
        // Get default voucher type and rate based on the selected description
        const defaultVoucherType = getDefaultVoucherType(value, selectedType);
        const defaultRate = getDefaultRateForDescription(value, defaultVoucherType);
        
        const updatedForm = { 
          ...form, 
          description: newDescription,
          vt: defaultVoucherType,
          rate: defaultRate
        };
        
        // For Project accounts, set KWD to 0
        if (selectedType === "Project") {
          updatedForm.kwd = 0;
        } else {
          // Recalculate KWD based on account type for non-Project accounts
          if (selectedType === "Faceting" && updatedForm.quantity) {
            updatedForm.kwd = calculateKwdForFaceting(updatedForm.quantity, defaultRate);
          } else if (selectedType === "Casting" && updatedForm.gold) {
            updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, defaultRate);
          }
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
        
        // For Project accounts, set KWD to 0 and don't recalculate
        if (selectedType === "Project") {
          updatedForm.kwd = 0;
        } else {
          // Recalculate KWD based on account type and voucher type for non-Project
          if (selectedType === "Faceting" && updatedForm.quantity !== undefined) {
            updatedForm.kwd = calculateKwdForFaceting(updatedForm.quantity, value);
          } else if (selectedType === "Casting" && updatedForm.gold !== undefined) {
            if (updatedForm.vt === "REC") {
              updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, value);
            } else if (updatedForm.vt === "INV") {
              updatedForm.kwd = calculateKwdForCasting(updatedForm.gold, value);
            }
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
      if (shouldShowCastingCalculation(form) && form.vt === "REC") {
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

        // Include rate for Casting vouchers (can be 0)
        if (shouldShowCastingCalculation(form) && form.rate !== undefined) {
          baseVoucher.rate = parseFloat(form.rate.toString()) || 0;
        }

        // Include rate for Project vouchers (can be 0)
        if (selectedType === "Project" && form.rate !== undefined) {
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

  // Smart voucher type indicator component
  const VoucherTypeIndicator = ({ form, index }: { form: VoucherForm; index: number }) => {
    const [showOptions, setShowOptions] = useState(false);
    
    const getVoucherTypeColor = (vt: string) => {
      switch (vt) {
        case 'INV': return 'bg-red-100 text-red-800 border-red-300';
        case 'REC': return 'bg-green-100 text-green-800 border-green-300';
        case 'GFV': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'Alloy': return 'bg-blue-100 text-blue-800 border-blue-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    };

    const getVoucherTypeLabel = (vt: string) => {
      switch (vt) {
        case 'INV': return 'Invoice';
        case 'REC': return 'Receipt';
        case 'GFV': return 'Gold Fixing';
        case 'Alloy': return 'Alloy';
        default: return 'Select Type';
      }
    };

    return (
      <div className="relative">
        <label className="block text-sm font-medium text-blue-700 mb-2">Voucher Type *</label>
        
        {/* Main compact indicator */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium transition-all ${getVoucherTypeColor(form.vt)} hover:shadow-sm min-w-[140px] justify-between`}
          >
            <span>{getVoucherTypeLabel(form.vt)}</span>
            <svg 
              className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Quick select hint */}
          {!form.vt && (
            <span className="text-sm text-blue-500">
              Select type or choose from quick descriptions
            </span>
          )}
        </div>

        {/* Dropdown options - appears only when clicked */}
        {showOptions && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white border-2 border-blue-300 rounded-xl shadow-2xl z-10">
            {getVoucherTypes().map((voucherType) => (
              <button
                key={voucherType.value}
                type="button"
                onClick={() => {
                  updateVoucherForm(index, 'vt', voucherType.value);
                  setShowOptions(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center justify-between ${
                  form.vt === voucherType.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-blue-900'
                }`}
              >
                <span>{voucherType.label}</span>
                {form.vt === voucherType.value && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent mb-4">
            Create Vouchers
          </h1>
          <p className="text-xl text-blue-700 mb-6">Create multiple vouchers under one account</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border-2 border-blue-300 text-lg font-medium rounded-2xl text-blue-700 bg-white/80 backdrop-blur-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View All Vouchers
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

        {/* Batch Voucher Creation Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border-2 border-blue-300">
          <div className="px-4 py-3 border-b-2 border-blue-300 bg-blue-100 rounded-t-2xl -mx-6 -mt-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-blue-800">Create Multiple Vouchers</h2>
                <p className="text-sm text-blue-700 mt-1">Batch creation under selected account</p>
              </div>
              <span className="bg-blue-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                {voucherForms.length} voucher{voucherForms.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {/* Account Selection - Step by Step */}
          <div className="mb-8 p-6 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-blue-300">
            <label className="block text-lg font-semibold text-blue-800 mb-6">
              Select Account *
            </label>
            
            {/* Step 1: Account Type Selection */}
            {!selectedType && (
              <div>
                <div className="mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    1
                  </div>
                  <span className="font-semibold text-blue-800 text-lg">Choose Account Type</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...new Set(accounts.map((a) => a.type))].map((type) => {
                    const typeColor = getTypeColor(type);
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className="group p-6 bg-white/80 backdrop-blur-sm border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-xl transition-all duration-200 text-left"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-3 ${typeColor.lightBg} rounded-xl group-hover:${typeColor.bg.replace('500', '200')} transition-colors`}>
                            <div className={`w-6 h-6 ${typeColor.bg} rounded-lg`}></div>
                          </div>
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                            {accounts.filter(a => a.type === type).length}
                          </span>
                        </div>
                        <h3 className={`font-semibold text-lg mb-1 group-hover:${typeColor.text} transition-colors ${typeColor.text}`}>
                          {type}
                        </h3>
                        <p className="text-sm text-blue-600">
                          {accounts.filter(a => a.type === type).length} active account{accounts.filter(a => a.type === type).length !== 1 ? 's' : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Account Selection */}
            {selectedType && !selectedAccountId && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      2
                    </div>
                    <span className="font-semibold text-blue-800 text-lg">Select {selectedType} Account</span>
                  </div>
                  <button
                    onClick={() => setSelectedType("")}
                    className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto p-2">
                  {filteredAccounts.map((account) => {
                    const typeColor = getTypeColor(selectedType);
                    return (
                      <button
                        key={account.id}
                        onClick={() => setSelectedAccountId(account.id)}
                        className="group p-5 bg-white/80 backdrop-blur-sm border-2 border-blue-300 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all duration-200 text-left"
                      >
                        <div className="flex items-center mb-3">
                          <div className={`p-2 ${typeColor.lightBg} rounded-lg group-hover:${typeColor.bg.replace('500', '200')} transition-colors`}>
                            <div className={`w-4 h-4 ${typeColor.bg} rounded-md`}></div>
                          </div>
                        </div>
                        <div className={`font-semibold text-base mb-1 group-hover:${typeColor.text} transition-colors ${typeColor.text}`}>
                          {account.accountNo}
                        </div>
                        <div className="text-sm text-blue-600 truncate">
                          {account.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Selected Account Confirmation */}
            {selectedAccountId && (
              <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">
                      ✓
                    </div>
                    <div>
                      <div className="font-semibold text-blue-900 text-base">
                        {accounts.find(a => a.id === selectedAccountId)?.accountNo} - {accounts.find(a => a.id === selectedAccountId)?.name}
                      </div>
                      <div className="text-sm text-blue-600">
                        {selectedType}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedType("");
                      setSelectedAccountId("");
                    }}
                    className="px-4 py-2 border-2 border-blue-300 text-blue-700 rounded-xl bg-white hover:bg-blue-50 transition-colors text-sm font-medium"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Voucher Forms - Only show after account is selected */}
          {selectedAccountId && (
            <div className="space-y-8">
              {voucherForms.map((form, index) => {
                const typeColor = getTypeColor(selectedType);
                return (
                  <div key={index} className="border-2 border-blue-300 rounded-2xl p-6 bg-white/80 backdrop-blur-sm hover:border-blue-500 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                      <h3 className="font-semibold text-blue-800 text-lg mb-2 sm:mb-0">Voucher #{index + 1}</h3>
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
                    
                    {/* Basic Voucher Fields - One field per row */}
                    <div className="space-y-6 mb-6">
                      {/* Date Field */}
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Date *</label>
                        <input
                          type="date"
                          value={form.date}
                          onChange={(e) => updateVoucherForm(index, 'date', e.target.value)}
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      {/* MVN or Description Field */}
                      {selectedType === "Market" ? (
                        <div>
                          <label className="block text-sm font-medium text-blue-700 mb-2">Manual Voucher No *</label>
                          <input
                            type="text"
                            placeholder="Enter MVN"
                            value={form.mvn || ""}
                            onChange={(e) => updateVoucherForm(index, 'mvn', e.target.value)}
                            className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-blue-700 mb-2">Description *</label>
                          <input
                            type="text"
                            placeholder="Enter description"
                            value={form.description || ""}
                            onChange={(e) => updateVoucherForm(index, 'description', e.target.value)}
                            className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                          />
                          
                          {/* Description Quick Select for Project, Faceting, Casting, and Gold Fixing */}
                          {shouldShowDescriptionQuickSelect() && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                Quick Select Descriptions 
                                <span className="text-blue-500 text-xs ml-2">(Click to auto-set voucher type)</span>
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {getAvailableDescriptions(form.vt).map((desc) => (
                                  <button
                                    key={desc}
                                    type="button"
                                    onClick={() => handleDescriptionSelect(index, desc)}
                                    className="px-4 py-2 text-sm bg-blue-100 text-blue-800 rounded-xl border border-blue-300 hover:bg-blue-200 transition-colors font-medium"
                                  >
                                    {desc}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Compact Voucher Type Indicator */}
                      <VoucherTypeIndicator form={form} index={index} />

                      {/* Gold Field */}
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Gold</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={form.gold}
                          onChange={(e) => updateVoucherForm(index, 'gold', parseFloat(e.target.value) || 0)}
                          className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                        />
                      </div>

                      {/* KWD Field - Show for all non-GFV vouchers EXCEPT Project */}
                      {form.vt !== "GFV" && selectedType !== "Project" && (
                        <div>
                          <label className="block text-sm font-medium text-blue-700 mb-2">KWD</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            value={form.kwd}
                            readOnly={shouldShowFacetingFields(form) || (shouldShowCastingCalculation(form) && form.vt === "REC")}
                            onChange={(e) => updateVoucherForm(index, 'kwd', parseFloat(e.target.value) || 0)}
                            className={`w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base ${
                              (shouldShowFacetingFields(form) || (shouldShowCastingCalculation(form) && form.vt === "REC")) ? 'bg-blue-100 text-blue-600 cursor-not-allowed' : 'bg-white/80'
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Gold Fixing Section - Only for Market REC */}
                    {shouldShowGoldFixing(form) && (
                      <div className="mb-6 p-5 bg-yellow-50 border-2 border-yellow-300 rounded-2xl">
                        <div className="flex items-center mb-4">
                          <input
                            type="checkbox"
                            id={`gold-fixing-${index}`}
                            checked={form.isGoldFixing || false}
                            onChange={(e) => updateVoucherForm(index, 'isGoldFixing', e.target.checked)}
                            className="h-5 w-5 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`gold-fixing-${index}`} className="ml-3 block text-sm font-medium text-blue-800">
                            Gold Fixing
                          </label>
                        </div>

                        {form.isGoldFixing && (
                          <div className="space-y-4 mt-4">
                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Gold Rate *</label>
                              <input
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                value={form.goldRate || ""}
                                onChange={(e) => updateVoucherForm(index, 'goldRate', parseFloat(e.target.value) || 0)}
                                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Fixing Amount</label>
                              <input
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                value={form.fixingAmount || 0}
                                readOnly
                                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 bg-blue-100 text-blue-600 cursor-not-allowed text-base"
                              />
                              <p className="text-sm text-blue-500 mt-2">Calculated automatically from Gold × Gold Rate</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Faceting Section - Only for Faceting REC */}
                    {shouldShowFacetingFields(form) && (
                      <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl">
                        <h4 className="text-sm font-medium text-amber-800 mb-4">Faceting Calculation</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-blue-700 mb-2">Quantity *</label>
                            <input
                              type="number"
                              placeholder="0"
                              min="1"
                              value={form.quantity || ""}
                              onChange={(e) => updateVoucherForm(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full border-2 border-amber-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-base bg-white/80"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-blue-700 mb-2">Rate *</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.001"
                              min="0"
                              value={form.rate !== undefined ? form.rate : 0.25}
                              onChange={(e) => updateVoucherForm(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full border-2 border-amber-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-base bg-white/80"
                            />
                          </div>
                        </div>
                        
                        {/* Common Rates Quick Select */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-blue-700 mb-2">Quick Select Rates:</label>
                          <div className="flex flex-wrap gap-2">
                            {predefinedRates.map((rate) => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => handleRateSelect(index, rate)}
                                className="px-4 py-2 text-sm bg-white text-amber-700 rounded-xl border border-amber-300 hover:bg-amber-100 transition-colors font-medium"
                              >
                                {rate}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Casting Section - For Casting INV and REC */}
                    {shouldShowCastingCalculation(form) && (
                      <div className="mb-6 p-5 bg-purple-50 border-2 border-purple-300 rounded-2xl">
                        <h4 className="text-sm font-medium text-purple-800 mb-4">
                          {form.vt === "INV" ? "Casting Invoice Calculation" : "Casting Calculation"}
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-blue-700 mb-2">Rate *</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.001"
                              min="0"
                              value={form.rate !== undefined ? form.rate : 0}
                              onChange={(e) => updateVoucherForm(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full border-2 border-purple-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-base bg-white/80"
                            />
                          </div>
                        </div>
                        
                        {/* Casting Rates Quick Select */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-blue-700 mb-2">Quick Select Rates:</label>
                          <div className="flex flex-wrap gap-2">
                            {castingRates.map((rate) => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => handleRateSelect(index, rate)}
                                className="px-4 py-2 text-sm bg-white text-purple-700 rounded-xl border border-purple-300 hover:bg-purple-100 transition-colors font-medium"
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
                      <div className="mb-6 p-5 bg-yellow-50 border-2 border-yellow-300 rounded-2xl">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-blue-700 mb-2">
                              Gold Rate *
                            </label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              value={form.goldRate || ""}
                              onChange={(e) => updateVoucherForm(index, 'goldRate', parseFloat(e.target.value) || 0)}
                              className="w-full border-2 border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors text-base bg-white/80"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-blue-700 mb-2">
                              KWD
                              {form.goldRate && form.gold > 0 && (
                                <span className="text-green-600 ml-2">
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
                              className="w-full border-2 border-yellow-300 rounded-xl px-4 py-3 bg-blue-100 text-blue-600 cursor-not-allowed text-base"
                            />
                            <p className="text-sm text-blue-500 mt-2">Calculated automatically from Gold × Gold Rate</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Method Section - Only for Market REC with Gold Fixing */}
                    {shouldShowGoldFixing(form) && form.isGoldFixing && (
                      <div className="mt-6 p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl">
                        <label className="block text-sm font-medium text-blue-700 mb-4">Payment Method</label>
                        
                        <div className="flex space-x-8 mb-6">
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name={`payment-method-${index}`}
                              value="cash"
                              checked={form.paymentMethod === 'cash'}
                              onChange={(e) => updateVoucherForm(index, 'paymentMethod', e.target.value)}
                              className="h-5 w-5 text-blue-600 border-2 border-blue-300 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-base text-blue-700 font-medium">Cash</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name={`payment-method-${index}`}
                              value="cheque"
                              checked={form.paymentMethod === 'cheque'}
                              onChange={(e) => updateVoucherForm(index, 'paymentMethod', e.target.value)}
                              className="h-5 w-5 text-blue-600 border-2 border-blue-300 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-base text-blue-700 font-medium">Cheque</span>
                          </label>
                        </div>

                        {form.paymentMethod === 'cheque' && (
                          <div className="space-y-6 mt-4">
                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Bank Name *</label>
                              <input
                                type="text"
                                placeholder="Enter bank name"
                                value={form.bankName || ""}
                                onChange={(e) => updateVoucherForm(index, 'bankName', e.target.value)}
                                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                              />
                              
                              {/* Bank Name Quick Select */}
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-blue-700 mb-2">Quick Select Banks:</label>
                                <div className="flex flex-wrap gap-2">
                                  {bankNames.map((bank) => (
                                    <button
                                      key={bank}
                                      type="button"
                                      onClick={() => handleBankNameSelect(index, bank)}
                                      className="px-4 py-2 text-sm bg-white text-blue-700 rounded-xl border border-blue-300 hover:bg-blue-100 transition-colors font-medium"
                                    >
                                      {bank}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Branch *</label>
                              <input
                                type="text"
                                placeholder="Enter branch"
                                value={form.branch || ""}
                                onChange={(e) => updateVoucherForm(index, 'branch', e.target.value)}
                                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                              />
                              
                              {/* Branch Quick Select */}
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-blue-700 mb-2">Quick Select Branches:</label>
                                <div className="flex flex-wrap gap-2">
                                  {branchNames.map((branch) => (
                                    <button
                                      key={branch}
                                      type="button"
                                      onClick={() => handleBranchSelect(index, branch)}
                                      className="px-4 py-2 text-sm bg-white text-blue-700 rounded-xl border border-blue-300 hover:bg-blue-100 transition-colors font-medium"
                                    >
                                      {branch}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Cheque No *</label>
                              <input
                                type="text"
                                placeholder="Enter cheque number"
                                value={form.chequeNo || ""}
                                onChange={(e) => updateVoucherForm(index, 'chequeNo', e.target.value)}
                                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Cheque Date *</label>
                              <input
                                type="date"
                                value={form.chequeDate || ""}
                                onChange={(e) => updateVoucherForm(index, 'chequeDate', e.target.value)}
                                className="w-full border-2 border-blue-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base bg-white/80"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-2">Cheque Amount</label>
                              <input
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                value={form.chequeAmount || 0}
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
                );
              })}

              {/* Action Buttons - Only show after account is selected */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-8 border-t-2 border-blue-300">
                <button
                  onClick={addVoucherForm}
                  className="flex items-center justify-center px-6 py-3 border-2 border-dashed border-blue-300 rounded-2xl text-blue-700 hover:border-blue-500 hover:text-blue-800 transition-colors font-medium bg-white/80 backdrop-blur-sm"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Another Voucher
                </button>
                
                <button
                  onClick={handleBatchSubmit}
                  disabled={!selectedType || !selectedAccountId || isSubmitting}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-900 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
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

        {/* Quick Stats - Only show after account is selected */}
        {selectedAccountId && (
          <div className={`grid ${selectedType === "Project" ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-6 text-center`}>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
              <div className="text-3xl font-bold text-blue-800">{voucherForms.length}</div>
              <div className="text-sm text-blue-700">Vouchers Ready</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
              <div className="text-3xl font-bold text-blue-800">
                {voucherForms.reduce((sum, form) => sum + form.gold, 0).toFixed(3)}
              </div>
              <div className="text-sm text-blue-700">Total Gold</div>
            </div>
            {/* Hide KWD stat for Project accounts */}
            {selectedType !== "Project" && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border-2 border-blue-300">
                <div className="text-3xl font-bold text-blue-800">
                  {voucherForms.reduce((sum, form) => sum + form.kwd, 0).toFixed(3)}
                </div>
                <div className="text-sm text-blue-700">Total KWD</div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}