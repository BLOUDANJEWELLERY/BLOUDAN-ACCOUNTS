import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const vouchersData = req.body;
      
      if (!Array.isArray(vouchersData)) {
        return res.status(400).json({ message: 'Expected an array of vouchers' });
      }

      // Validate and transform the data
      const validatedVouchers = vouchersData.map(voucher => {
        // Convert date string to Date object
        const date = new Date(voucher.date);
        
        // Create base data object with required fields
        const data: any = {
          date: date,
          vt: voucher.vt,
          accountId: voucher.accountId,
          gold: parseFloat(voucher.gold) || 0,
          kwd: parseFloat(voucher.kwd) || 0,
          paymentMethod: voucher.paymentMethod || 'cash',
        };

        // Only include mvn if it exists and is not empty
        if (voucher.mvn && voucher.mvn.trim()) {
          data.mvn = voucher.mvn;
        }

        // Only include description if it exists and is not empty
        if (voucher.description && voucher.description.trim()) {
          data.description = voucher.description;
        }

        // Include goldRate for GFV vouchers or when Gold Fixing is applicable
        if (voucher.goldRate !== undefined) {
          data.goldRate = parseFloat(voucher.goldRate) || 0;
        }

        // Include fixing amount if it exists
        if (voucher.fixingAmount !== undefined) {
          data.fixingAmount = parseFloat(voucher.fixingAmount) || 0;
        }

        // Include cheque details if payment method is cheque
        if (voucher.paymentMethod === 'cheque') {
          if (voucher.bankName && voucher.bankName.trim()) {
            data.bankName = voucher.bankName;
          }
          if (voucher.branch && voucher.branch.trim()) {
            data.branch = voucher.branch;
          }
          if (voucher.chequeNo && voucher.chequeNo.trim()) {
            data.chequeNo = voucher.chequeNo;
          }
          if (voucher.chequeDate) {
            data.chequeDate = new Date(voucher.chequeDate);
          }
          if (voucher.chequeAmount !== undefined) {
            data.chequeAmount = parseFloat(voucher.chequeAmount) || 0;
          }
        }

        return data;
      });

      // Create multiple vouchers using transaction
      const createdVouchers = await prisma.$transaction(
        validatedVouchers.map(voucher => 
          prisma.voucher.create({
            data: voucher
          })
        )
      );

      res.status(201).json(createdVouchers);
    } catch (error: any) {
      console.error('Error creating vouchers:', error);
      res.status(500).json({ 
        message: `Error creating vouchers: ${error.message}`,
        details: error
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}