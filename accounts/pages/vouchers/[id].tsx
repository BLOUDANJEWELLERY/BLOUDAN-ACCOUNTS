// pages/vouchers/[id].tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useState } from "react";
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
  const [formData, setFormData] = useState({
    date: voucher.date.split('T')[0],
    vt: voucher.vt,
    accountId: voucher.accountId,
    gold: voucher.gold,
    kwd: voucher.kwd,
    mvn: voucher.mvn || "",
    description: voucher.description || "",
    goldRate: voucher.goldRate || "",
    paymentMethod: voucher.paymentMethod || "",
    fixingAmount: voucher.fixingAmount || "",
    bankName: voucher.bankName || "",
    branch: voucher.branch || "",
    chequeNo: voucher.chequeNo || "",
    chequeDate: voucher.chequeDate ? voucher.chequeDate.split('T')[0] : "",
    chequeAmount: voucher.chequeAmount || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === "" ? "" : parseFloat(value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        date: formData.date,
        vt: formData.vt,
        accountId: formData.accountId,
        gold: formData.gold,
        kwd: formData.kwd,
        mvn: formData.mvn || null,
        description: formData.description || null,
        goldRate: formData.goldRate ? parseFloat(formData.goldRate as string) : null,
        paymentMethod: formData.paymentMethod || null,
        fixingAmount: formData.fixingAmount ? parseFloat(formData.fixingAmount as string) : null,
        bankName: formData.bankName || null,
        branch: formData.branch || null,
        chequeNo: formData.chequeNo || null,
        chequeDate: formData.chequeDate || null,
        chequeAmount: formData.chequeAmount ? parseFloat(formData.chequeAmount as string) : null,
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

  const hasAdditionalFields = 
    voucher.goldRate !== null || 
    voucher.paymentMethod !== null ||
    voucher.fixingAmount !== null ||
    voucher.bankName !== null ||
    voucher.branch !== null ||
    voucher.chequeNo !== null ||
    voucher.chequeDate !== null ||
    voucher.chequeAmount !== null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Voucher</h1>
          <p className="text-gray-600 mb-4">Update voucher details</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link 
              href="/vouchers/list" 
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Vouchers
            </Link>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {hasAdditionalFields && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-yellow-800 font-medium">This voucher contains additional fields</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voucher Type *</label>
                <select
                  name="vt"
                  value={formData.vt}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="REC">REC (Receipt)</option>
                  <option value="INV">INV (Invoice)</option>
                  <option value="GFV">GFV (Gold Fixing)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account *</label>
                <select
                  name="accountId"
                  value={formData.accountId}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.accountNo} - {account.name} ({account.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manual Voucher No</label>
                <input
                  type="text"
                  name="mvn"
                  value={formData.mvn}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="MVN"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Voucher description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gold *</label>
                <input
                  type="number"
                  step="0.001"
                  name="gold"
                  value={formData.gold}
                  onChange={handleNumberChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">KWD *</label>
                <input
                  type="number"
                  step="0.001"
                  name="kwd"
                  value={formData.kwd}
                  onChange={handleNumberChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Additional Fields Toggle */}
            <div className="border-t pt-6">
              <button
                type="button"
                onClick={() => setShowAdditionalFields(!showAdditionalFields)}
                className="flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                {showAdditionalFields ? (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Hide Additional Fields
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show Additional Fields
                  </>
                )}
              </button>

              {showAdditionalFields && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gold Rate</label>
                    <input
                      type="number"
                      step="0.001"
                      name="goldRate"
                      value={formData.goldRate}
                      onChange={handleNumberChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Gold rate"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="">Select Payment Method</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="transfer">Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fixing Amount</label>
                    <input
                      type="number"
                      step="0.001"
                      name="fixingAmount"
                      value={formData.fixingAmount}
                      onChange={handleNumberChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Fixing amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Bank name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                    <input
                      type="text"
                      name="branch"
                      value={formData.branch}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Branch"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cheque No</label>
                    <input
                      type="text"
                      name="chequeNo"
                      value={formData.chequeNo}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Cheque number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cheque Date</label>
                    <input
                      type="date"
                      name="chequeDate"
                      value={formData.chequeDate}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cheque Amount</label>
                    <input
                      type="number"
                      step="0.001"
                      name="chequeAmount"
                      value={formData.chequeAmount}
                      onChange={handleNumberChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Cheque amount"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
              >
                {isSubmitting ? 'Updating Voucher...' : 'Update Voucher'}
              </button>
              <Link
                href="/vouchers/list"
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400 transition-colors text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}