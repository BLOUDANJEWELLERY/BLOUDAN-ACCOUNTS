// pages/balance-sheet/[id].tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import { useRouter } from "next/router";
import { useState } from "react";

type Voucher = {
  id: string;
  date: string;
  mvn: string;
  vt: "REC" | "INV";
  accountNo: number;
  gold: number;
  kwd: number;
  goldBalance?: number;
  kwdBalance?: number;
};

type Props = {
  account: { id: string; name: string; accountNo: number };
  vouchers: Voucher[];
  startDate?: string;
  endDate?: string;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const id = context.params?.id as string;
  const startDate = context.query.startDate
    ? new Date(context.query.startDate as string)
    : undefined;
  const endDate = context.query.endDate
    ? new Date(context.query.endDate as string)
    : undefined;

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return { notFound: true };

  const whereClause: any = { accountNo: account.accountNo };
  if (startDate && endDate) {
    whereClause.date = { gte: startDate, lte: endDate };
  } else if (startDate) {
    whereClause.date = { gte: startDate };
  } else if (endDate) {
    whereClause.date = { lte: endDate };
  }

  const vouchers = await prisma.voucher.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });

  let goldBalance = 0;
  let kwdBalance = 0;

  const processed = vouchers.map((v) => {
    if (v.vt === "INV") {
      goldBalance += v.gold;
      kwdBalance += v.kwd;
    } else if (v.vt === "REC") {
      goldBalance -= v.gold;
      kwdBalance -= v.kwd;
    }
    return {
      ...v,
      goldBalance,
      kwdBalance,
    };
  });

  return {
    props: {
      account: {
        id: account.id,
        name: account.name,
        accountNo: account.accountNo,
      },
      vouchers: JSON.parse(JSON.stringify(processed)),
      startDate: context.query.startDate || null,
      endDate: context.query.endDate || null,
    },
  };
};

export default function BalanceSheetPage({
  account,
  vouchers,
  startDate,
  endDate,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(startDate || "");
  const [end, setEnd] = useState(endDate || "");

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (start) params.append("startDate", start);
    if (end) params.append("endDate", end);
    router.push(`/balance-sheet/${account.id}?${params.toString()}`);
  };

  const totalGold =
    vouchers.length > 0 ? vouchers[vouchers.length - 1].goldBalance : 0;
  const totalKwd =
    vouchers.length > 0 ? vouchers[vouchers.length - 1].kwdBalance : 0;

  return (
    <main className="min-h-screen p-8 bg-[#fef3c7]">
      <h1 className="text-2xl font-bold mb-6">
        Balance Sheet — {account.name} (#{account.accountNo})
      </h1>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From:
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To:
          </label>
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
          onClick={() => router.push(`/balance-sheet/${account.id}`)}
          className="bg-gray-500 text-white px-4 py-2 rounded self-end mt-5"
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
              <th className="p-2 border">MVN</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Gold</th>
              <th className="p-2 border">KWD</th>
              <th className="p-2 border">Gold Balance</th>
              <th className="p-2 border">KWD Balance</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td className="p-2 border">
                  {new Date(v.date).toLocaleDateString()}
                </td>
                <td className="p-2 border">{v.mvn}</td>
                <td className="p-2 border">{v.vt}</td>
                <td className="p-2 border text-right">{v.gold.toFixed(3)}</td>
                <td className="p-2 border text-right">{v.kwd.toFixed(3)}</td>
                <td className="p-2 border text-right font-semibold">
                  {v.goldBalance?.toFixed(3)}
                </td>
                <td className="p-2 border text-right font-semibold">
                  {v.kwdBalance?.toFixed(3)}
                </td>
              </tr>
            ))}
            {/* Total Row */}
            <tr className="bg-yellow-100 font-bold">
              <td className="p-2 border text-center" colSpan={5}>
                Final Balance
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