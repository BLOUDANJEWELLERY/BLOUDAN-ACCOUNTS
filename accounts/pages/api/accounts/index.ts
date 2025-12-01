// pages/api/accounts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type Account = {
  id: string;
  accountNo: number;
  name: string;
  type: string;
  phone?: string;
  crOrCivilIdNo?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Account[] | Account | { message: string }>
) {
  try {
    if (req.method === "GET") {
      const accounts = await prisma.account.findMany({
        orderBy: { accountNo: "asc" },
      });

      // Sanitize null -> undefined
      const sanitized = accounts.map((acc) => ({
        ...acc,
        phone: acc.phone ?? undefined,
        crOrCivilIdNo: acc.crOrCivilIdNo ?? undefined,
      }));

      return res.status(200).json(sanitized);
    }

    if (req.method === "POST") {
      const { name, type, phone, crOrCivilIdNo } = req.body as {
        name?: string;
        type?: string;
        phone?: string | null;
        crOrCivilIdNo?: string | null;
        isActive: true,
      };

      if (!name || !type) {
        return res.status(400).json({ message: "Name and Type are required" });
      }

      // Determine next accountNo for this type
      const sameTypeAccounts = await prisma.account.findMany({ where: { type } });
      const nextNo =
        sameTypeAccounts.length > 0
          ? Math.max(...sameTypeAccounts.map((a) => a.accountNo)) + 1
          : 1;

      const newAccount = await prisma.account.create({
        data: { accountNo: nextNo, name, type, phone, crOrCivilIdNo },
      });

      const sanitized: Account = {
        ...newAccount,
        phone: newAccount.phone ?? undefined,
        crOrCivilIdNo: newAccount.crOrCivilIdNo ?? undefined,
      };

      // ✅ Fix: now returning single Account type allowed by NextApiResponse
      return res.status(201).json(sanitized);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}