// pages/api/accounts/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    if (req.method === "PUT") {
      const { accountNo, name, type, phone, crOrCivilIdNo } = req.body;

      const updated = await prisma.account.update({
        where: { id },
        data: { accountNo: Number(accountNo), name, type, phone, crOrCivilIdNo },
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      await prisma.account.delete({ where: { id } });
      return res.status(204).end();
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}