import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";

type Voucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "REC" | "INV" | "GFV" | "Alloy"; // Added "Alloy" to voucher types
  accountId: string;
  gold: number;
  kwd: number;
  goldBalance?: number;
  kwdBalance?: number;
};

type Props = {
  account: { id: string; name: string; type: string };
  vouchers: Voucher[];
  startDate?: string;
  endDate?: string;
  openingGold: number;
  openingKwd: number;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const id = context.params?.id as string;
  const accountType = context.query.accountType as string;
  const startDateParam = context.query.startDate as string | undefined;
  const endDateParam = context.query.endDate as string | undefined;

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  // Fetch account and validate type
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return { notFound: true };
  if (!accountType || account.type !== accountType) {
    return { notFound: true };
  }

  // Step 1: Opening Balance (vouchers before startDate)
  let openingGold = 0;
  let openingKwd = 0;

  if (startDate) {
    const previousVouchers = await prisma.voucher.findMany({
      where: {
        accountId: account.id,
        date: { lt: startDate },
      },
      orderBy: { date: "asc" },
    });

    previousVouchers.forEach((v) => {
      if (v.vt === "INV" || v.vt === "Alloy") {
        // Treat Alloy same as INV (positive)
        openingGold += v.gold;
        openingKwd += v.kwd;
      } else if (v.vt === "REC") {
        openingGold -= v.gold;
        openingKwd -= v.kwd;
      } else if (v.vt === "GFV") {
        // GFV: Gold positive, KWD negative
        openingGold += v.gold;
        openingKwd -= v.kwd;
      }
    });
  }

  // Step 2: Fetch vouchers within date range
  const whereClause: any = { accountId: account.id };
  if (startDate && endDate) whereClause.date = { gte: startDate, lte: endDate };
  else if (startDate) whereClause.date = { gte: startDate };
  else if (endDate) whereClause.date = { lte: endDate };

  const vouchers = await prisma.voucher.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });

  // Step 3: Compute running balances
  let goldBalance = openingGold;
  let kwdBalance = openingKwd;
  const processed = vouchers.map((v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      // Treat Alloy same as INV (positive)
      goldBalance += v.gold;
      kwdBalance += v.kwd;
    } else if (v.vt === "REC") {
      goldBalance -= v.gold;
      kwdBalance -= v.kwd;
    } else if (v.vt === "GFV") {
      // GFV: Gold positive, KWD negative
      goldBalance += v.gold;
      kwdBalance -= v.kwd;
    }
    return { ...v, goldBalance, kwdBalance };
  });

  return {
    props: {
      account: {
        id: account.id,
        name: account.name,
        type: accountType,
      },
      vouchers: JSON.parse(JSON.stringify(processed)),
      startDate: startDateParam || null,
      endDate: endDateParam || null,
      openingGold,
      openingKwd,
    },
  };
};

export default function BalanceSheetPage({
  account,
  vouchers,
  startDate,
  endDate,
  openingGold,
  openingKwd,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(startDate || "");
  const [end, setEnd] = useState(endDate || "");
  const [isFiltering, setIsFiltering] = useState(false);



// Add this state variable
const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

// Add this function to handle PDF generation
const handleDownloadPDF = async () => {
  try {
    setIsGeneratingPDF(true);
    
    const params = new URLSearchParams();
    params.append('id', account.id);
    params.append('accountType', account.type);
    if (start) params.append('startDate', start);
    if (end) params.append('endDate', end);

    // Add timestamp to prevent caching
    params.append('_t', Date.now().toString());

    // Call the PDF API
    const response = await fetch(`/api/ledger/pdf?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
      cache: 'no-store',
    });
    
    // First, check if it's an error
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to generate PDF');
      } else {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
    }
    
    // Check if it's actually a PDF
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/pdf')) {
      const text = await response.text();
      console.warn('Expected PDF but got:', contentType, text.substring(0, 200));
      throw new Error('Server did not return a PDF file');
    }
    
    // Get the blob
    const blob = await response.blob();
    
    // Check blob type
    if (blob.type !== 'application/pdf') {
      console.warn('Blob is not PDF:', blob.type, blob.size);
      throw new Error('Downloaded file is not a PDF');
    }
    
    // Create filename
    const filename = `ledger-${account.name.replace(/\s+/g, '-')}-${start || 'all'}-to-${end || 'all'}.pdf`;
    
    // Check if we're on iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS || isSafari) {
      // iOS Safari workaround - open in new window
      const url = window.URL.createObjectURL(blob);
      
      // Create an iframe to download the file
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      // Also create a link as fallback
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // For Safari, we can't use download attribute, so open in new tab
        if (isSafari) {
          window.open(url, '_blank');
        } else {
          link.click();
        }
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(url);
        }, 100);
      }, 100);
    } else {
      // Standard download for other browsers
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
    
  } catch (error) {
    console.error('Error downloading PDF:', error);
    
    // Show user-friendly error
    if (error instanceof Error) {
      alert(`Failed to download PDF: ${error.message}`);
    } else {
      alert('Failed to download PDF. Please try again.');
    }
  } finally {
    setIsGeneratingPDF(false);
  }
};





  const handleFilter = async () => {
    setIsFiltering(true);
    const params = new URLSearchParams();
    if (start) params.append("startDate", start);
    if (end) params.append("endDate", end);
    if (account.type) params.append("accountType", account.type);
    
    await router.push(`/balance-sheet/${account.id}?${params.toString()}`);
    setIsFiltering(false);
  };

  const handleReset = async () => {
    setIsFiltering(true);
    await router.push(`/balance-sheet/${account.id}?accountType=${account.type}`);
    setIsFiltering(false);
  };

  const totalGold = vouchers.length > 0 ? vouchers[vouchers.length - 1].goldBalance ?? openingGold : openingGold;
  const totalKwd = vouchers.length > 0 ? vouchers[vouchers.length - 1].kwdBalance ?? openingKwd : openingKwd;

  // Calculate totals for the period
  const periodGold = vouchers.reduce((sum, v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      return sum + v.gold;
    }
    if (v.vt === "REC") {
      return sum - v.gold;
    }
    if (v.vt === "GFV") {
      return sum + v.gold; // GFV: Gold positive
    }
    return sum;
  }, 0);

  const periodKwd = vouchers.reduce((sum, v) => {
    if (v.vt === "INV" || v.vt === "Alloy") {
      return sum + v.kwd;
    }
    if (v.vt === "REC") {
      return sum - v.kwd;
    }
    if (v.vt === "GFV") {
      return sum - v.kwd; // GFV: KWD negative
    }
    return sum;
  }, 0);

  const formatCurrency = (value: number) => {
    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to get voucher type styling
  const getVoucherTypeStyle = (vt: string) => {
    if (vt === 'REC') return 'bg-green-100 text-green-800';
    if (vt === 'INV') return 'bg-blue-100 text-blue-800';
    if (vt === 'GFV') return 'bg-yellow-100 text-yellow-800';
    if (vt === 'Alloy') return 'bg-purple-100 text-purple-800'; // Added style for Alloy
    return 'bg-gray-100 text-gray-800';
  };

  // Helper function to display transaction amounts with proper signs
  const getDisplayAmount = (voucher: Voucher, field: 'gold' | 'kwd') => {
    const value = voucher[field];
    if (voucher.vt === 'GFV') {
      // For GFV: Gold shows positive, KWD shows negative
      if (field === 'gold') return value;
      if (field === 'kwd') return -value;
    } else if (voucher.vt === 'Alloy') {
      // For Alloy: Both gold and KWD show positive (like INV)
      return value;
    } else {
      // For INV and REC: Normal display
      return value;
    }
    return value;
  };

  // Get display sign for amount (for showing + or -)
  const getDisplaySign = (voucher: Voucher, field: 'gold' | 'kwd') => {
    const amount = getDisplayAmount(voucher, field);
    return amount >= 0 ? '+' : '';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Ledger</h1>
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                  {account.type}
                </span>
                <span className="text-lg font-semibold">{account.name}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
              <Link 
                href="/vouchers/list" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Vouchers
              </Link>
              <Link 
                href="/accounts" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Accounts
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Opening Gold</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(openingGold)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Opening KWD</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(openingKwd)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Period Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{vouchers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Net Change</p>
                <p className="text-lg font-bold text-gray-900">
                  Gold: {formatCurrency(periodGold)}<br />
                  KWD: {formatCurrency(periodKwd)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Transactions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                disabled={isFiltering}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center"
              >
                {isFiltering ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Filtering...
                  </>
                ) : (
                  "Apply Filter"
                )}
              </button>
              
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600">
                Showing {vouchers.length} transaction{vouchers.length !== 1 ? 's' : ''}
                {startDate && ` from ${formatDate(startDate)}`}
                {endDate && ` to ${formatDate(endDate)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Transaction Ledger</h2>
          </div>

          {vouchers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {startDate || endDate ? "Try adjusting your date filters" : "No transactions recorded for this account"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KWD</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gold Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">KWD Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Opening Balance Row */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={3}>
                      Opening Balance
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingGold)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingKwd)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingGold)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(openingKwd)}
                    </td>
                  </tr>

                  {vouchers.map((v, index) => (
                    <tr key={v.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(v.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="font-medium">{v.mvn || v.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVoucherTypeStyle(v.vt)}`}>
                          {v.vt}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <span className={v.vt === 'REC' ? 'text-red-600' : 'text-green-600'}>
                          {getDisplaySign(v, 'gold')}{formatCurrency(getDisplayAmount(v, 'gold'))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <span className={
                          v.vt === 'GFV' || v.vt === 'REC' ? 'text-red-600' : 'text-green-600'
                        }>
                          {getDisplaySign(v, 'kwd')}{formatCurrency(getDisplayAmount(v, 'kwd'))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(v.goldBalance || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(v.kwdBalance || 0)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance Row */}
                  <tr className="bg-green-50 font-bold">
                    <td className="px-6 py-4 text-sm text-gray-900" colSpan={3}>
                      Closing Balance
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(periodGold)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(periodKwd)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(totalGold)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(totalKwd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Account Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-90">Opening Balance</p>
                <p className="text-xl font-bold">Gold: {formatCurrency(openingGold)}</p>
                <p className="text-xl font-bold">KWD: {formatCurrency(openingKwd)}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">Closing Balance</p>
                <p className="text-xl font-bold">Gold: {formatCurrency(totalGold)}</p>
                <p className="text-xl font-bold">KWD: {formatCurrency(totalKwd)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Period Activity</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Transactions:</span>
                <span className="font-semibold">{vouchers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date Range:</span>
                <span className="font-semibold">
                  {startDate ? formatDate(startDate) : 'Start'} - {endDate ? formatDate(endDate) : 'Present'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Change Gold:</span>
                <span className={`font-semibold ${periodGold >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodGold >= 0 ? '+' : ''}{formatCurrency(periodGold)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Change KWD:</span>
                <span className={`font-semibold ${periodKwd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodKwd >= 0 ? '+' : ''}{formatCurrency(periodKwd)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
<button
  onClick={handleDownloadPDF}
  disabled={isGeneratingPDF}
  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 transition-colors"
>
  {isGeneratingPDF ? (
    <>
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Generating PDF...
    </>
  ) : (
    <>
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Download PDF
    </>
  )}
</button>
    </main>
  );
}