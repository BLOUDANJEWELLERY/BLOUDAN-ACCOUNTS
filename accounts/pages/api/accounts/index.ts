// /pages/api/accounts/index.ts
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
  res: NextApiResponse<Account | Account[] | { error: string }>
) {
  try {
    if (req.method === "POST") {
      const { name, type, phone, crOrCivilIdNo } = req.body as {
        name: string;
        type: string;
        phone?: string;
        crOrCivilIdNo?: string;
      };

      if (!name || !type) {
        return res.status(400).json({ error: "Name and type are required" });
      }

      // Fetch all accounts of the same type to compute next accountNo
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

      return res.status(201).json(newAccount);
    }

    if (req.method === "GET") {
      const accounts = await prisma.account.findMany({
        orderBy: { accountNo: "asc" },
      });
      return res.status(200).json(accounts);
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: unknown) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}