import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, startDate, endDate, accountType } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Fetch account
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    // Calculate opening balances
    let openingGold = 0;
    let openingKwd = 0;

    if (start) {
      const previousVouchers = await prisma.voucher.findMany({
        where: {
          accountId: account.id,
          date: { lt: start },
        },
        orderBy: { date: 'asc' },
      });

      previousVouchers.forEach((v) => {
        if (v.vt === 'INV' || v.vt === 'Alloy') {
          openingGold += v.gold;
          openingKwd += v.kwd;
        } else if (v.vt === 'REC') {
          openingGold -= v.gold;
          openingKwd -= v.kwd;
        } else if (v.vt === 'GFV') {
          openingGold += v.gold;
          openingKwd -= v.kwd;
        }
      });
    }

    // Fetch vouchers within date range
    const whereClause: any = { accountId: account.id };
    if (start && end) whereClause.date = { gte: start, lte: end };
    else if (start) whereClause.date = { gte: start };
    else if (end) whereClause.date = { lte: end };

    const vouchers = await prisma.voucher.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      include: {
        account: true,
      },
    });

    // Calculate running balances
    let goldBalance = openingGold;
    let kwdBalance = openingKwd;
    const processedVouchers = vouchers.map((v) => {
      if (v.vt === 'INV' || v.vt === 'Alloy') {
        goldBalance += v.gold;
        kwdBalance += v.kwd;
      } else if (v.vt === 'REC') {
        goldBalance -= v.gold;
        kwdBalance -= v.kwd;
      } else if (v.vt === 'GFV') {
        goldBalance += v.gold;
        kwdBalance -= v.kwd;
      }
      return {
        ...v,
        goldBalance,
        kwdBalance,
        date: v.date.toISOString().split('T')[0],
      };
    });

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helper functions
    const formatCurrency = (value: number) => {
      return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const formatDate = (dateString?: string) => {
      if (!dateString) return 'All';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    let y = height - 50;

    // Company Header
    page.drawText('BLOUDAN JEWELLERY', {
      x: 50,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 25;
    page.drawText('ACCOUNT LEDGER', {
      x: 50,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 20;

    // Account Information
    page.drawText(`Account: ${account.name}`, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 15;
    page.drawText(`Account Type: ${accountType}`, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 15;
    page.drawText(`Period: ${formatDate(startDate as string)} to ${formatDate(endDate as string)}`, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 20;

    // Opening Balance
    page.drawText('Opening Balance:', {
      x: 50,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 15;
    page.drawText(`Gold: ${formatCurrency(openingGold)}`, {
      x: 60,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`KWD: ${formatCurrency(openingKwd)}`, {
      x: 200,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 30;

    // Table Headers
    const headers = ['Date', 'Details', 'Type', 'Gold', 'KWD', 'Gold Balance', 'KWD Balance'];
    const colWidths = [60, 150, 40, 80, 80, 100, 100];
    const colX = [50, 110, 260, 300, 380, 460, 560];

    // Draw header background
    page.drawRectangle({
      x: 45,
      y: y + 5,
      width: 505,
      height: 20,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Draw header text
    headers.forEach((header, i) => {
      page.drawText(header, {
        x: colX[i],
        y: y + 10,
        size: 9,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
    });

    y -= 25;

    // Draw voucher rows
    processedVouchers.forEach((voucher, index) => {
      if (y < 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
        
        // Draw headers on new page
        page.drawRectangle({
          x: 45,
          y: y + 5,
          width: 505,
          height: 20,
          color: rgb(0.9, 0.9, 0.9),
        });
        
        headers.forEach((header, i) => {
          page.drawText(header, {
            x: colX[i],
            y: y + 10,
            size: 9,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        });
        y -= 25;
      }

      // Alternate row background
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 45,
          y: y - 15,
          width: 505,
          height: 20,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      // Voucher data
      const rowData = [
        voucher.date,
        voucher.mvn || voucher.description || '',
        voucher.vt,
        formatCurrency(voucher.gold),
        formatCurrency(voucher.kwd),
        formatCurrency(voucher.goldBalance || 0),
        formatCurrency(voucher.kwdBalance || 0),
      ];

      rowData.forEach((data, i) => {
        page.drawText(data.substring(0, 30), { // Truncate long text
          x: colX[i],
          y: y,
          size: 8,
          font,
          color: rgb(0, 0, 0),
        });
      });

      y -= 20;
    });

    y -= 20;

    // Closing Balance
    const closingGold = processedVouchers.length > 0 
      ? processedVouchers[processedVouchers.length - 1].goldBalance 
      : openingGold;
    const closingKwd = processedVouchers.length > 0 
      ? processedVouchers[processedVouchers.length - 1].kwdBalance 
      : openingKwd;

    page.drawText('Closing Balance:', {
      x: 50,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 15;
    page.drawText(`Gold: ${formatCurrency(closingGold || 0)}`, {
      x: 60,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`KWD: ${formatCurrency(closingKwd || 0)}`, {
      x: 200,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 30;

    // Summary
    page.drawText(`Total Transactions: ${processedVouchers.length}`, {
      x: 50,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    y -= 15;
    page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledger-${account.name}-${startDate || 'all'}-to-${endDate || 'all'}.pdf"`
    );

    // Send PDF
    res.status(200).send(pdfBytes);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}