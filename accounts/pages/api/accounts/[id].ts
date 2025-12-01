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
  isActive: boolean;
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
    // ===== PATCH: Change isActive only =====
    if (req.method === "PATCH") {
      const { isActive } = req.body as { isActive?: boolean };

      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be boolean" });
      }

      const updated = await prisma.account.update({
        where: { id },
        data: { isActive },
      });

      return res.status(200).json(updated);
    }

    // ===== PUT: Update editable fields =====
    if (req.method === "PUT") {
      const { name, phone, crOrCivilIdNo } = req.body as {
        name?: string;
        phone?: string | null;
        crOrCivilIdNo?: string | null;
      };

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const updated = await prisma.account.update({
        where: { id },
        data: { name, phone, crOrCivilIdNo },
      });

      return res.status(200).json(updated);
    }

    res.setHeader("Allow", ["PUT", "PATCH"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}