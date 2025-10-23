// /pages/api/accounts/index.ts
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { name, type, phone, crOrCivilIdNo } = req.body;

    const sameTypeAccounts = await prisma.account.findMany({
      where: { type },
    });

    const nextNo =
      sameTypeAccounts.length > 0
        ? Math.max(...sameTypeAccounts.map((a) => a.accountNo)) + 1
        : 1;

    const newAccount = await prisma.account.create({
      data: {
        accountNo: nextNo,
        name,
        type,
        phone,
        crOrCivilIdNo,
      },
    });

    return res.json(newAccount);
  }

  if (req.method === "GET") {
    const accounts = await prisma.account.findMany({ orderBy: { accountNo: "asc" } });
    return res.json(accounts);
  }

  res.status(405).end();
}