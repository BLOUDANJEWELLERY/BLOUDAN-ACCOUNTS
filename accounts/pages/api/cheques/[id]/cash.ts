// pages/api/cheques/[id]/cash.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") return res.status(400).json({ message: "Invalid ID" });

  try {
    if (req.method === "PUT") {
      const { cashedDate } = req.body;

      const updated = await prisma.voucher.update({
        where: { id },
        data: {
          paymentMethod: "cash",
          cashedDate: cashedDate ? new Date(cashedDate) : new Date(),
        },
        include: {
          account: {
            select: {
              accountNo: true,
              name: true,
              type: true
            }
          }
        }
      });

      return res.status(200).json(updated);
    }

    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}