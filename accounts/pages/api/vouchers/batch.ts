import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const vouchers = req.body;
      
      if (!Array.isArray(vouchers)) {
        return res.status(400).json({ message: 'Expected an array of vouchers' });
      }

      // Create multiple vouchers
      const createdVouchers = await prisma.voucher.createMany({
        data: vouchers,
      });

      // Fetch the created vouchers with full data
      const voucherIds = vouchers.map((_, index) => {
        // This is a simplified approach - you might need to adjust based on your DB
        return index; // Replace with actual ID retrieval logic
      });

      const fullVouchers = await prisma.voucher.findMany({
        where: {
          id: { in: voucherIds }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(201).json(fullVouchers);
    } catch (error) {
      console.error('Error creating vouchers:', error);
      res.status(500).json({ message: 'Error creating vouchers' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}