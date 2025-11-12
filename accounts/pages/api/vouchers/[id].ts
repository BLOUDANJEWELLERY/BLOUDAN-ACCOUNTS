import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") return res.status(400).json({ message: "Invalid ID" });

  try {
    // ===== UPDATE VOUCHER =====
    if (req.method === "PUT") {
      const { 
        date, 
        mvn, 
        description, 
        vt, 
        accountId, 
        gold, 
        kwd,
        goldRate,
        paymentMethod,
        fixingAmount,
        bankName,
        branch,
        chequeNo,
        chequeDate,
        chequeAmount
      } = req.body;

      if (!date || !vt || !accountId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Fetch account to check type
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account) return res.status(400).json({ message: "Account not found" });

      // Conditional validation based on account type
      if (account.type === "Market" && (!mvn || mvn.trim() === "")) {
        return res.status(400).json({ message: "MVN is required for Market accounts" });
      }

      if (account.type !== "Market" && (!description || description.trim() === "")) {
        return res.status(400).json({ message: "Description is required for non-Market accounts" });
      }

      // Additional validation for GFV vouchers
      if (vt === "GFV" && (!goldRate || goldRate <= 0)) {
        return res.status(400).json({ message: "Gold Rate is required and must be greater than 0 for GFV vouchers" });
      }

      // Additional validation for Gold Fixing in Market REC
      const isGoldFixing = fixingAmount && fixingAmount > 0;
      if (account.type === "Market" && vt === "REC" && isGoldFixing && (!goldRate || goldRate <= 0)) {
        return res.status(400).json({ message: "Gold Rate is required when Gold Fixing is enabled" });
      }

      // Validation for cheque payments when Gold Fixing is enabled
      if (paymentMethod === 'cheque' && isGoldFixing) {
        if (!bankName?.trim() || !branch?.trim() || !chequeNo?.trim() || !chequeDate) {
          return res.status(400).json({ message: "All cheque details are required when payment method is cheque" });
        }
      }

      // Prepare update data
      const updateData: any = {
        date: new Date(date),
        vt,
        accountId: account.id,
        gold: gold ? parseFloat(gold) : 0,
        kwd: kwd ? parseFloat(kwd) : 0,
        // Conditionally set mvn and description based on account type
        mvn: account.type === "Market" && mvn?.trim() ? mvn : null,
        description: account.type !== "Market" && description?.trim() ? description : null,
        // Additional fields
        goldRate: (vt === "GFV" || isGoldFixing) && goldRate ? parseFloat(goldRate) : null,
        fixingAmount: isGoldFixing && fixingAmount ? parseFloat(fixingAmount) : null,
        paymentMethod: paymentMethod || null,
        // Cheque fields - only set if payment method is cheque and Gold Fixing is enabled
        bankName: paymentMethod === 'cheque' && isGoldFixing ? bankName : null,
        branch: paymentMethod === 'cheque' && isGoldFixing ? branch : null,
        chequeNo: paymentMethod === 'cheque' && isGoldFixing ? chequeNo : null,
        chequeDate: paymentMethod === 'cheque' && isGoldFixing && chequeDate ? new Date(chequeDate) : null,
        chequeAmount: paymentMethod === 'cheque' && isGoldFixing && chequeAmount ? parseFloat(chequeAmount) : null,
      };

      // For non-cheque payments or non-Gold Fixing, clear cheque fields
      if (paymentMethod !== 'cheque' || !isGoldFixing) {
        updateData.bankName = null;
        updateData.branch = null;
        updateData.chequeNo = null;
        updateData.chequeDate = null;
        updateData.chequeAmount = null;
      }

      // For non-GFV and non-Gold Fixing vouchers, clear goldRate and fixingAmount
      if (vt !== "GFV" && !isGoldFixing) {
        updateData.goldRate = null;
        updateData.fixingAmount = null;
      }

      const updated = await prisma.voucher.update({
        where: { id },
        data: updateData,
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

    // ===== DELETE VOUCHER =====
    if (req.method === "DELETE") {
      await prisma.voucher.delete({ where: { id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}