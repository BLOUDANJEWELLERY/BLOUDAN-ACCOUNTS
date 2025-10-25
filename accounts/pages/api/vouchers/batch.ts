import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const vouchersData = req.body;
      
      if (!Array.isArray(vouchersData)) {
        return res.status(400).json({ message: 'Expected an array of vouchers' });
      }

      // Create multiple vouchers using transaction
      const createdVouchers = await prisma.$transaction(
        vouchersData.map(voucher => 
          prisma.voucher.create({
            data: voucher
          })
        )
      );

      res.status(201).json(createdVouchers);
    } catch (error) {
      console.error('Error creating vouchers:', error);
      res.status(500).json({ message: 'Error creating vouchers' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}