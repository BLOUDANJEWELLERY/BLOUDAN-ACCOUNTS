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
        phone?: string | null;
        crOrCivilIdNo?: string | null;
      };

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Update only editable fields
      const updated = await prisma.account.update({
        where: { id },
        data: { name, phone, crOrCivilIdNo },
      });

      // Sanitize null → undefined
      const sanitized: Account = {
        id: updated.id,
        accountNo: updated.accountNo,
        type: updated.type,
        name: updated.name,
        phone: updated.phone ?? undefined,
        crOrCivilIdNo: updated.crOrCivilIdNo ?? undefined,
      };

      return res.status(200).json(sanitized);
    }

    // DELETE removed
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}