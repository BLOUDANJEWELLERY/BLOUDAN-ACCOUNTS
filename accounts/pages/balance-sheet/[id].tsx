import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState } from "react";

type Voucher = {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "REC" | "INV";
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
  const id = context.params?.id as string; // accountId from URL
  const accountType = context.query.accountType as string; // from frontend
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
      if (v.vt === "INV") {
        openingGold += v.gold;
        openingKwd += v.kwd;
      } else if (v.vt === "REC") {
        openingGold -= v.gold;
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
    if (v.vt === "INV") {
      goldBalance += v.gold;
      kwdBalance += v.kwd;
    } else if (v.vt === "REC") {
      goldBalance -= v.gold;
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

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (start) params.append("startDate", start);
    if (end) params.append("endDate", end);
    if (account.type) params.append("accountType", account.type);
    router.push(`/balance-sheet/${account.id}?${params.toString()}`);
  };

  const handleReset = () => {
    router.push(`/balance-sheet/${account.id}?accountType=${account.type}`);
  };

  const totalGold =
    vouchers.length > 0 ? vouchers[vouchers.length - 1].goldBalance ?? openingGold : openingGold;
  const totalKwd =
    vouchers.length > 0 ? vouchers[vouchers.length - 1].kwdBalance ?? openingKwd : openingKwd;

  return (
    <main className="min-h-screen p-8 bg-[#fef3c7]">
      <h1 className="text-2xl font-bold mb-6">
        Balance Sheet — {account.name} [{account.type}]
      </h1>

      {/* Filter Section */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From:</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>
        <button
          onClick={handleFilter}
          className="bg-blue-600 text-white px-4 py-2 rounded self-end mt-5"
        >
          Filter
        </button>
        <button
          onClick={handleReset}
          className="bg-gray-600 text-white px-4 py-2 rounded self-end mt-5"
        >
          Reset
        </button>
      </div>

      {vouchers.length === 0 ? (
        <p className="text-gray-700">No vouchers found for this period.</p>
      ) : (
        <table className="min-w-full border border-gray-400 bg-white">
          <thead>
            <tr className="bg-yellow-200">
              <th className="p-2 border">Date</th>
              <th className="p-2 border">MVN / Description</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Gold</th>
              <th className="p-2 border">KWD</th>
              <th className="p-2 border">Gold Balance</th>
              <th className="p-2 border">KWD Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            <tr className="bg-yellow-100 font-semibold">
              <td className="p-2 border text-center" colSpan={5}>
                Opening Balance
              </td>
              <td className="p-2 border text-right">{openingGold.toFixed(3)}</td>
              <td className="p-2 border text-right">{openingKwd.toFixed(3)}</td>
            </tr>

            {vouchers.map((v) => (
              <tr key={v.id}>
                <td className="p-2 border">{new Date(v.date).toLocaleDateString()}</td>
                <td className="p-2 border">{v.mvn || v.description}</td>
                <td className="p-2 border">{v.vt}</td>
                <td className="p-2 border text-right">{v.gold.toFixed(3)}</td>
                <td className="p-2 border text-right">{v.kwd.toFixed(3)}</td>
                <td className="p-2 border text-right font-semibold">{v.goldBalance?.toFixed(3)}</td>
                <td className="p-2 border text-right font-semibold">{v.kwdBalance?.toFixed(3)}</td>
              </tr>
            ))}

            {/* Closing Balance */}
            <tr className="bg-yellow-200 font-bold">
              <td className="p-2 border text-center" colSpan={5}>
                Closing Balance
              </td>
              <td className="p-2 border text-right">{totalGold.toFixed(3)}</td>
              <td className="p-2 border text-right">{totalKwd.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </main>
  );
}