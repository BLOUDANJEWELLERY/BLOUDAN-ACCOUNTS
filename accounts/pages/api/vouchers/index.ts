// pages/api/vouchers/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const vouchers = await prisma.voucher.findMany({
        orderBy: { date: "desc" },
      });
      return res.status(200).json(vouchers);
    }

    if (req.method === "POST") {
      const { date, mvn, description, vt, accountNo, gold, kwd } = req.body;

      if (!date || !vt || !accountNo) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Determine account type
      const account = await prisma.account.findUnique({
        where: { accountNo: Number(accountNo) },
      });

      if (!account) {
        return res.status(400).json({ message: "Account not found" });
      }

      // Conditional validation
      if (account.type === "Market" && !mvn) {
        return res.status(400).json({ message: "MVN is required for Market accounts" });
      }

      if (account.type !== "Market" && !description) {
        return res.status(400).json({ message: "Description is required for non-Market accounts" });
      }

      const newVoucher = await prisma.voucher.create({
        data: {
          date: new Date(date),
          mvn: mvn || null,
          description: description || null,
          vt,
          accountNo: Number(accountNo),
          gold: gold ? parseFloat(gold) : 0,
          kwd: kwd ? parseFloat(kwd) : 0,
        },
      });

      return res.status(201).json(newVoucher);
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}