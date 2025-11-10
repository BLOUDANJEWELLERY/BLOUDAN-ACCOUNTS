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
        };

        // Only include mvn if it exists and is not empty
        if (voucher.mvn && voucher.mvn.trim()) {
          data.mvn = voucher.mvn;
        }

        // Only include description if it exists and is not empty
        if (voucher.description && voucher.description.trim()) {
          data.description = voucher.description;
        }

        // Only include goldRate for GFV vouchers and if it exists
        if (voucher.vt === "GFV" && voucher.goldRate !== undefined) {
          data.goldRate = parseFloat(voucher.goldRate) || 0;
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