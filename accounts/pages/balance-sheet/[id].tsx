// pages/balance-sheet/[id].tsx
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";

type Voucher = {
  id: string;
  date: string;
  mvn: string;
  vt: "REC" | "INV";
  accountNo: number;
  gold: number;
  kwd: number;
};

type Props = {
  account: { name: string; accountNo: number };
  vouchers: (Voucher & { goldBalance: number; kwdBalance: number })[];
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const id = context.params?.id as string;
  const account = await prisma.account.findUnique({ where: { id } });

  if (!account) return { notFound: true };

  const vouchers = await prisma.voucher.findMany({
    where: { accountNo: account.accountNo },
    orderBy: { date: "asc" },
  });

  let goldBalance = 0;
  let kwdBalance = 0;

  const processed = vouchers.map((v) => {
    // Invoices credit (increase balance), Receipts debit (decrease)
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
        name: account.name,
        accountNo: account.accountNo,
      },
      vouchers: JSON.parse(JSON.stringify(processed)),
    },
  };
};

export default function BalanceSheetPage({ account, vouchers }: Props) {
  return (
    <main className="min-h-screen p-8 bg-[#fef3c7]">
      <h1 className="text-2xl font-bold mb-4">
        Balance Sheet — {account.name} (#{account.accountNo})
      </h1>

      {vouchers.length === 0 ? (
        <p className="text-gray-700">No vouchers found for this account.</p>
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
                <td className="p-2 border">{new Date(v.date).toLocaleDateString()}</td>
                <td className="p-2 border">{v.mvn}</td>
                <td className="p-2 border">{v.vt}</td>
                <td className="p-2 border text-right">{v.gold.toFixed(3)}</td>
                <td className="p-2 border text-right">{v.kwd.toFixed(3)}</td>
                <td className="p-2 border text-right font-semibold">
                  {v.goldBalance.toFixed(3)}
                </td>
                <td className="p-2 border text-right font-semibold">
                  {v.kwdBalance.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}