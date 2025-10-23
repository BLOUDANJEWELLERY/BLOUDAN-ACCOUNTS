// pages/api/accounts/[id].ts
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
  res: NextApiResponse<Account | { message: string }>
) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    if (req.method === "PUT") {
      const { name, phone, crOrCivilIdNo } = req.body as {
        name?: string;
        phone?: string;
        crOrCivilIdNo?: string;
      };

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Only allow updating name, phone, and CR/Civil ID
      const updated = await prisma.account.update({
        where: { id },
        data: { name, phone, crOrCivilIdNo },
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      await prisma.account.delete({ where: { id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}