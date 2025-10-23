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
      const { date, mvn, description, vt, accountId, gold, kwd } = req.body;

      if (!date || !vt || !accountId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Fetch account to validate type
      const account = await prisma.account.findUnique({ where: { id: accountId } });
      if (!account) {
        return res.status(400).json({ message: "Invalid account" });
      }

      // Conditional validation based on account type
      if (account.type === "Market" && (!mvn || mvn.trim() === "")) {
        return res.status(400).json({ message: "MVN is required for Market accounts" });
      }

      if (account.type !== "Market" && (!description || description.trim() === "")) {
        return res.status(400).json({ message: "Description is required for non-Market accounts" });
      }

      const newVoucher = await prisma.voucher.create({
        data: {
          date: new Date(date),
          vt,
          accountId: account.id,
          gold: gold ? parseFloat(gold) : 0,
          kwd: kwd ? parseFloat(kwd) : 0,
          mvn: account.type === "Market" ? mvn : null,
          description: account.type !== "Market" ? description : null,
        },
      });

      return res.status(201).json(newVoucher);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}