// pages/api/accounts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const accounts = await prisma.account.findMany({
        orderBy: { accountNo: "asc" },
      });
      return res.status(200).json(accounts);
    }

    if (req.method === "POST") {
      const { accountNo, name, type, phone, crOrCivilIdNo } = req.body;
      if (!accountNo || !name || !type) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const newAccount = await prisma.account.create({
        data: { accountNo: Number(accountNo), name, type, phone, crOrCivilIdNo },
      });

      return res.status(201).json(newAccount);
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}