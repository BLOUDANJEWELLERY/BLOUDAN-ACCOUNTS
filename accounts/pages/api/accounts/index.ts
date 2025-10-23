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
  res: NextApiResponse<Account | Account[] | { message: string }>
) {
  try {
    if (req.method === "GET") {
      const accounts = await prisma.account.findMany({
        orderBy: { accountNo: "asc" },
      });
      return res.status(200).json(accounts);
    }

    if (req.method === "POST") {
      const { name, type, phone, crOrCivilIdNo } = req.body as {
        name: string;
        type: string;
        phone?: string;
        crOrCivilIdNo?: string;
      };

      if (!name || !type) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Compute accountNo based on type
      const sameTypeAccounts = await prisma.account.findMany({
        where: { type },
      });
      const nextNo =
        sameTypeAccounts.length > 0
          ? Math.max(...sameTypeAccounts.map((a) => a.accountNo)) + 1
          : 1;

      const newAccount = await prisma.account.create({
        data: { accountNo: nextNo, name, type, phone, crOrCivilIdNo },
      });

      return res.status(201).json(newAccount);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}