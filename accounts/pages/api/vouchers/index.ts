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
      const { date, mvn, vt, accountNo, gold, kwd } = req.body;
      if (!date || !mvn || !vt || !accountNo) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const newVoucher = await prisma.voucher.create({
        data: {
          date: new Date(date),
          mvn,
          vt,
          accountNo: Number(accountNo),
          gold: parseFloat(gold),
          kwd: parseFloat(kwd),
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