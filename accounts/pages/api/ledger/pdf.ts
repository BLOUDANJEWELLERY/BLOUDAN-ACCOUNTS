import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers for cross-origin requests (helpful for debugging)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, startDate, endDate, accountType } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ 
        error: 'Account ID is required',
        details: 'Please provide a valid account ID'
      });
    }

    // Fetch account
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found',
        details: `No account found with ID: ${id}`
      });
    }

    // Validate dates if provided
    let start: Date | undefined;
    let end: Date | undefined;
    
    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        return res.status(400).json({ 
          error: 'Invalid start date',
          details: 'Please provide a valid start date'
        });
      }
    }
    
    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        return res.status(400).json({ 
          error: 'Invalid end date',
          details: 'Please provide a valid end date'
        });
      }
    }

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
    
    // Initialize with first page
    let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const pageHeight = currentPage.getSize().height;
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

    let yPosition = pageHeight - 50;

    // Company Header
    currentPage.drawText('BLOUDAN JEWELLERY', {
      x: 50,
      y: yPosition,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 25;
    currentPage.drawText('ACCOUNT LEDGER', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 20;

    // Account Information
    currentPage.drawText(`Account: ${account.name}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    currentPage.drawText(`Account Type: ${accountType}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    currentPage.drawText(`Period: ${formatDate(startDate as string)} to ${formatDate(endDate as string)}`, {
      x: 50,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 20;

    // Opening Balance
    currentPage.drawText('Opening Balance:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    currentPage.drawText(`Gold: ${formatCurrency(openingGold)}`, {
      x: 60,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentPage.drawText(`KWD: ${formatCurrency(openingKwd)}`, {
      x: 200,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 30;

    // Table Headers
    const headers = ['Date', 'Details', 'Type', 'Gold', 'KWD', 'Gold Balance', 'KWD Balance'];
    const colWidths = [60, 150, 40, 80, 80, 100, 100];
    const colX = [50, 110, 260, 300, 380, 460, 560];

    // Draw header background
    currentPage.drawRectangle({
      x: 45,
      y: yPosition + 5,
      width: 505,
      height: 20,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Draw header text
    headers.forEach((header, i) => {
      currentPage.drawText(header, {
        x: colX[i],
        y: yPosition + 10,
        size: 9,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
    });

    yPosition -= 25;

    // Draw voucher rows
    processedVouchers.forEach((voucher, index) => {
      // Check if we need a new page
      if (yPosition < 100) {
        // Add new page
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        yPosition = pageHeight - 50;
        
        // Draw headers on new page
        currentPage.drawRectangle({
          x: 45,
          y: yPosition + 5,
          width: 505,
          height: 20,
          color: rgb(0.9, 0.9, 0.9),
        });
        
        headers.forEach((header, i) => {
          currentPage.drawText(header, {
            x: colX[i],
            y: yPosition + 10,
            size: 9,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        });
        yPosition -= 25;
      }

      // Alternate row background
      if (index % 2 === 0) {
        currentPage.drawRectangle({
          x: 45,
          y: yPosition - 15,
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
        // Truncate long text
        const displayText = data.length > 30 ? data.substring(0, 27) + '...' : data;
        currentPage.drawText(displayText, {
          x: colX[i],
          y: yPosition,
          size: 8,
          font,
          color: rgb(0, 0, 0),
        });
      });

      yPosition -= 20;
    });

    // Add closing balance on the last page
    yPosition -= 20;

    // Closing Balance
    const closingGold = processedVouchers.length > 0 
      ? processedVouchers[processedVouchers.length - 1].goldBalance 
      : openingGold;
    const closingKwd = processedVouchers.length > 0 
      ? processedVouchers[processedVouchers.length - 1].kwdBalance 
      : openingKwd;

    currentPage.drawText('Closing Balance:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 15;
    currentPage.drawText(`Gold: ${formatCurrency(closingGold || 0)}`, {
      x: 60,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentPage.drawText(`KWD: ${formatCurrency(closingKwd || 0)}`, {
      x: 200,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 30;

    // Summary
    currentPage.drawText(`Total Transactions: ${processedVouchers.length}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    yPosition -= 15;
    currentPage.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Set response headers - VERY IMPORTANT for iOS
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBytes.length.toString());
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledger-${account.name.replace(/\s+/g, '-')}-${startDate || 'all'}-to-${endDate || 'all'}.pdf"`
    );
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send PDF
    res.status(200).send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('PDF generation error:', error);
    
    // Return JSON error
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}