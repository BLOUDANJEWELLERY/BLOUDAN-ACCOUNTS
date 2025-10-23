import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") return res.status(400).json({ message: "Invalid ID" });

  try {
    // ===== UPDATE VOUCHER =====
    if (req.method === "PUT") {
      const { date, mvn, description, vt, accountNo, gold, kwd } = req.body;

      if (!date || !vt || !accountNo) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Fetch account to check type
      const account = await prisma.account.findUnique({
        where: { accountNo: Number(accountNo) },
      });

      if (!account) return res.status(400).json({ message: "Account not found" });

      // Conditional validation
      if (account.type === "Market" && (!mvn || mvn.trim() === "")) {
        return res.status(400).json({ message: "MVN is required for Market accounts" });
      }

      if (account.type !== "Market" && (!description || description.trim() === "")) {
        return res.status(400).json({ message: "Description is required for non-Market accounts" });
      }

      const updated = await prisma.voucher.update({
        where: { id },
        data: {
          date: new Date(date),
          vt,
          accountNo: Number(accountNo),
          gold: gold ? parseFloat(gold) : 0,
          kwd: kwd ? parseFloat(kwd) : 0,
          mvn: account.type === "Market" ? mvn : null,
          description: account.type !== "Market" ? description : null,
        },
      });

      return res.status(200).json(updated);
    }

    // ===== DELETE VOUCHER =====
    if (req.method === "DELETE") {
      await prisma.voucher.delete({ where: { id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}