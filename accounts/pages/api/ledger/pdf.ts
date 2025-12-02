import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { prisma } from '@/lib/prisma';

// Helper function to format balance - no units
const formatBalance = (balance: number): string => {
  if (balance === undefined || balance === null) {
    return `0.000 Cr`;
  }
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  return `${absoluteValue.toFixed(3)} ${suffix}`;
};

// Helper function to clean description
const cleanDescription = (description: string, isOpeningBalance?: boolean, isClosingBalance?: boolean): string => {
  if (isOpeningBalance) return "Opening Balance";
  if (isClosingBalance) return "Closing Balance";
  
  return description
    .replace(/^Invoice - /, '')
    .replace(/^Receipt - /, '')
    .substring(0, 50); // Limit description length
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 30;

// Colors - Bloudan Jewellery theme (Blue/Purple)
const COLORS = {
  primary: rgb(0.1, 0.1, 0.3),        // Dark Blue
  primaryLight: rgb(0.2, 0.2, 0.4),   // Medium Blue
  secondary: rgb(0.6, 0.2, 0.8),      // Purple
  accent: rgb(0.2, 0.4, 0.8),         // Blue
  success: rgb(0.2, 0.6, 0.3),        // Green
  warning: rgb(0.9, 0.6, 0.2),        // Orange
  danger: rgb(0.8, 0.2, 0.2),         // Red
  lightBg: rgb(0.95, 0.95, 0.98),     // Light background
  tableHeader: rgb(0.9, 0.92, 0.96),  // Table header
  tableRowEven: rgb(0.98, 0.98, 0.99), // Even row
  border: rgb(0.8, 0.8, 0.85),        // Border
  textDark: rgb(0.2, 0.2, 0.2),       // Dark text
  textLight: rgb(0.5, 0.5, 0.55),     // Light text
  white: rgb(1, 1, 1),                // White
};

interface PageConfig {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  tableStartY: number;
  tableEndY: number;
  maxRowsPerPage: number;
}

interface LedgerEntry {
  date: string;
  voucherId: string;
  type: "INV" | "REC" | "GFV" | "Alloy";
  description: string;
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
}

interface AccountInfo {
  id: string;
  name: string;
  type: string;
}

interface PdfRequestData {
  account: AccountInfo;
  dateRange: {
    start: string;
    end: string;
  };
  ledgerEntries: LedgerEntry[];
  openingBalance: { gold: number; kwd: number };
  closingBalance: { gold: number; kwd: number };
  totals: {
    goldDebit: number;
    goldCredit: number;
    kwdDebit: number;
    kwdCredit: number;
  };
}

class PDFGenerator {
  private pdfDoc: PDFDocument | null = null;
  private font: PDFFont | null = null;
  private boldFont: PDFFont | null = null;
  private pageConfig: PageConfig;
  private isInitialized: boolean = false;

  constructor() {
    this.pageConfig = this.calculatePageConfig();
  }

  private calculatePageConfig(): PageConfig {
    const width = A4_LANDSCAPE_WIDTH;
    const height = A4_LANDSCAPE_HEIGHT;
    const contentWidth = width - (MARGIN * 2);
    const contentHeight = height - (MARGIN * 2);
    
    const headerSectionHeight = 180;
    const footerSectionHeight = FOOTER_HEIGHT;
    const tableStartY = height - MARGIN - headerSectionHeight;
    const tableEndY = MARGIN + footerSectionHeight;
    const availableTableHeight = tableStartY - tableEndY;
    
    const maxRowsPerPage = Math.floor((availableTableHeight - HEADER_HEIGHT) / ROW_HEIGHT);

    return {
      width,
      height,
      contentWidth,
      contentHeight,
      tableStartY,
      tableEndY,
      maxRowsPerPage
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.pdfDoc = await PDFDocument.create();
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.boldFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.isInitialized = true;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.pdfDoc || !this.font || !this.boldFont) {
      throw new Error("PDFGenerator not initialized. Call initialize() first.");
    }
  }

  private getPDFDoc(): PDFDocument {
    this.ensureInitialized();
    return this.pdfDoc!;
  }

  private getFonts(): { font: PDFFont; boldFont: PDFFont } {
    this.ensureInitialized();
    return { font: this.font!, boldFont: this.boldFont! };
  }

  private createNewPage(): PDFPage {
    const pdfDoc = this.getPDFDoc();
    const page = pdfDoc.addPage([A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT]);
    
    // Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageConfig.width,
      height: this.pageConfig.height,
      color: COLORS.lightBg,
    });

    // Main container
    page.drawRectangle({
      x: MARGIN,
      y: MARGIN,
      width: this.pageConfig.contentWidth,
      height: this.pageConfig.contentHeight,
      color: COLORS.white,
      borderColor: COLORS.accent,
      borderWidth: 2,
    });

    return page;
  }

  private drawPageHeader(page: PDFPage, data: PdfRequestData, pageNumber: number, totalPages: number): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 30;

    // Header with gradient effect
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - 60,
      width: this.pageConfig.contentWidth - 40,
      height: 80,
      color: COLORS.primary,
    });

    // Company Name
    page.drawText("BLOUDAN JEWELLERY", {
      x: MARGIN + 20,
      y: currentY,
      size: 24,
      font: boldFont,
      color: COLORS.white,
    });

    page.drawText("Account Ledger Statement", {
      x: MARGIN + 20,
      y: currentY - 30,
      size: 16,
      font: boldFont,
      color: COLORS.white,
    });

    currentY -= 70;

    // Account Information Box
    const accountBoxHeight = 40;
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - accountBoxHeight,
      width: this.pageConfig.contentWidth - 40,
      height: accountBoxHeight,
      color: COLORS.tableHeader,
      borderColor: COLORS.accent,
      borderWidth: 1,
    });

    const accountInfo = `Account: ${data.account.name} | Type: ${data.account.type}`;
    page.drawText(accountInfo, {
      x: MARGIN + 35,
      y: currentY - 25,
      size: 11,
      font: boldFont,
      color: COLORS.primary,
    });

    currentY -= 60;

    // Date Range
    const startDate = data.dateRange.start ? new Date(data.dateRange.start).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'All Dates';
    
    const endDate = data.dateRange.end ? new Date(data.dateRange.end).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'Present';
    
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 12,
      font: boldFont,
      color: COLORS.primary,
    });

    // Page number
    const pageInfo = `Page ${pageNumber} of ${totalPages}`;
    page.drawText(pageInfo, {
      x: this.pageConfig.width - MARGIN - 20 - boldFont.widthOfTextAtSize(pageInfo, 10),
      y: currentY,
      size: 10,
      font: boldFont,
      color: COLORS.primary,
    });

    currentY -= 30;

    // Ledger Table Header
    page.drawText("Transaction Ledger", {
      x: MARGIN + 20,
      y: currentY,
      size: 14,
      font: boldFont,
      color: COLORS.primary,
    });

    return currentY - 25;
  }

  private drawTableHeader(page: PDFPage, tableTop: number): { tableTop: number; colWidths: number[] } {
    const { boldFont } = this.getFonts();
    const tableWidth = this.pageConfig.contentWidth - 40;
    
    // Column widths matching the example structure
    let colWidths = [50, 35, 200, 60, 60, 75, 60, 60, 75];
    
    // Calculate missing width and distribute proportionally
    const currentTotal = colWidths.reduce((a, b) => a + b, 0);
    const missing = tableWidth - currentTotal;
    
    if (missing > 0) {
      const extraPerColumn = missing / colWidths.length;
      colWidths = colWidths.map(w => w + extraPerColumn);
    }

    // Draw table container
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      borderColor: COLORS.accent,
      borderWidth: 2,
    });

    // Table header background (full height for both header rows)
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: COLORS.tableHeader,
    });

    // Calculate positions for grouped headers
    let xPos = MARGIN + 20;
    
    // First three columns (Date, Type, Description) span full header height
    const firstThreeColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2];
    
    // Gold group header (spans G Debit, G Credit, G Balance)
    const goldGroupStartX = xPos + firstThreeColumnsWidth;
    const goldGroupWidth = colWidths[3] + colWidths[4] + colWidths[5];
    
    // Amount group header (spans KWD Debit, KWD Credit, KWD Balance)
    const amountGroupStartX = goldGroupStartX + goldGroupWidth;
    const amountGroupWidth = colWidths[6] + colWidths[7] + colWidths[8];

    // Draw grouped header backgrounds
    page.drawRectangle({
      x: goldGroupStartX,
      y: tableTop - 20,
      width: goldGroupWidth,
      height: 20,
      color: COLORS.primary,
    });

    page.drawRectangle({
      x: amountGroupStartX,
      y: tableTop - 20,
      width: amountGroupWidth,
      height: 20,
      color: COLORS.primary,
    });

    // Vertical lines
    xPos = MARGIN + 20;
    for (let col = 0; col <= 3; col++) {
      page.drawLine({
        start: { x: xPos, y: tableTop },
        end: { x: xPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.accent,
        thickness: 0.5,
      });
      if (col < 3) {
        xPos += colWidths[col];
      }
    }

    // Gold group vertical lines
    let groupXPos = goldGroupStartX;
    page.drawLine({
      start: { x: groupXPos, y: tableTop },
      end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    page.drawLine({
      start: { x: groupXPos + colWidths[3], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[3], y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[3] + colWidths[4], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[3] + colWidths[4], y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    page.drawLine({
      start: { x: groupXPos + goldGroupWidth, y: tableTop },
      end: { x: groupXPos + goldGroupWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    // Amount group vertical lines
    groupXPos = amountGroupStartX;
    page.drawLine({
      start: { x: groupXPos, y: tableTop },
      end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    page.drawLine({
      start: { x: groupXPos + colWidths[6], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[6], y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[6] + colWidths[7], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[6] + colWidths[7], y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    page.drawLine({
      start: { x: groupXPos + amountGroupWidth, y: tableTop },
      end: { x: groupXPos + amountGroupWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    // Rightmost table border
    const tableRightEdge = MARGIN + 20 + tableWidth;
    page.drawLine({
      start: { x: tableRightEdge, y: tableTop },
      end: { x: tableRightEdge, y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 0.5,
    });

    // Horizontal lines
    page.drawLine({
      start: { x: goldGroupStartX, y: tableTop - 20 },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - 20 },
      color: COLORS.accent,
      thickness: 1,
    });

    page.drawLine({
      start: { x: MARGIN + 20, y: tableTop - HEADER_HEIGHT },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.accent,
      thickness: 1,
    });

    // Column headers for first three columns
    xPos = MARGIN + 20;
    const firstThreeHeaders = ["Date", "Type", "Description"];
    
    firstThreeHeaders.forEach((header, index) => {
      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 24,
        size: 9,
        font: boldFont,
        color: COLORS.primary,
      });
      
      xPos += colWidths[index];
    });

    // Column header text for Gold and Amount sections
    const goldHeaders = ["Debit", "Credit", "Balance"];
    const amountHeaders = ["Debit", "Credit", "Balance"];
    
    // Gold section headers
    xPos = goldGroupStartX;
    goldHeaders.forEach((header, index) => {
      const colIndex = 3 + index;
      const textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(header, 8)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 34,
        size: 8,
        font: boldFont,
        color: COLORS.primary,
      });
      
      xPos += colWidths[colIndex];
    });

    // Amount section headers
    xPos = amountGroupStartX;
    amountHeaders.forEach((header, index) => {
      const colIndex = 6 + index;
      const textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(header, 8)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 34,
        size: 8,
        font: boldFont,
        color: COLORS.primary,
      });
      
      xPos += colWidths[colIndex];
    });

    // Draw grouped header text
    page.drawText("GOLD", {
      x: goldGroupStartX + (goldGroupWidth - boldFont.widthOfTextAtSize("GOLD", 10)) / 2,
      y: tableTop - 12,
      size: 10,
      font: boldFont,
      color: COLORS.white,
    });

    page.drawText("AMOUNT", {
      x: amountGroupStartX + (amountGroupWidth - boldFont.widthOfTextAtSize("AMOUNT", 10)) / 2,
      y: tableTop - 12,
      size: 10,
      font: boldFont,
      color: COLORS.white,
    });

    return { tableTop: tableTop - HEADER_HEIGHT, colWidths };
  }

  private drawTableRows(page: PDFPage, entries: LedgerEntry[], startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10;
    let currentY = startY - ROW_OFFSET;

    // Draw rows
    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background
      const rowBgColor = entry.isOpeningBalance || entry.isClosingBalance 
        ? COLORS.tableHeader 
        : (index % 2 === 0 ? COLORS.white : COLORS.tableRowEven);

      let xPos = MARGIN + 20;
      colWidths.forEach(width => {
        page.drawRectangle({
          x: xPos,
          y: rowBottom,
          width: width,
          height: ROW_HEIGHT,
          color: rowBgColor,
        });
        xPos += width;
      });

      // Format data
      const displayDate = entry.isOpeningBalance || entry.isClosingBalance 
        ? new Date(entry.date).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
          })
        : (entry.date || '').split('-').slice(1).join('/'); // Format as MM/DD

      const cleanedDescription = cleanDescription(
        entry.description || '',
        entry.isOpeningBalance,
        entry.isClosingBalance
      );

      const rowData = [
        displayDate,
        entry.isOpeningBalance || entry.isClosingBalance ? 'BAL' : (entry.type || ''),
        cleanedDescription,
        entry.goldDebit > 0 ? (entry.goldDebit || 0).toFixed(3) : '-',
        entry.goldCredit > 0 ? (entry.goldCredit || 0).toFixed(3) : '-',
        formatBalance(entry.goldBalance || 0),
        entry.kwdDebit > 0 ? (entry.kwdDebit || 0).toFixed(3) : '-',
        entry.kwdCredit > 0 ? (entry.kwdCredit || 0).toFixed(3) : '-',
        formatBalance(entry.kwdBalance || 0)
      ];

      // Draw cell text
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const isLeftAligned = colIndex === 2; // Description left-aligned
        const textColor = entry.isOpeningBalance || entry.isClosingBalance 
          ? COLORS.primary 
          : COLORS.textDark;
        
        const textFont = (entry.isOpeningBalance || entry.isClosingBalance) ? boldFont : font;
        
        const textX = isLeftAligned ? 
          xPos + 5 : 
          xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, 7)) / 2;
        
        page.drawText(data, {
          x: textX,
          y: currentY - 3,
          size: 7,
          font: textFont,
          color: textColor,
        });
        
        xPos += colWidths[colIndex];
      });

      // Draw row grid
      this.drawTableGrid(page, rowTop, ROW_HEIGHT, colWidths);

      currentY -= ROW_HEIGHT;
    });

    return currentY;
  }

  private drawTableGrid(page: PDFPage, startY: number, height: number, colWidths: number[], isHeader: boolean = false): void {
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    let xPos = MARGIN + 20;

    // Vertical lines
    for (let col = 0; col <= colWidths.length; col++) {
      const lineStartY = isHeader ? startY : startY - height;
      const lineEndY = isHeader ? startY - height : startY;
      
      page.drawLine({
        start: { x: xPos, y: lineStartY },
        end: { x: xPos, y: lineEndY },
        color: COLORS.border,
        thickness: 0.5,
      });
      
      if (col < colWidths.length) {
        xPos += colWidths[col];
      }
    }

    // Horizontal lines
    if (isHeader) {
      page.drawLine({
        start: { x: MARGIN + 20, y: startY - 20 },
        end: { x: MARGIN + 20 + tableWidth, y: startY - 20 },
        color: COLORS.border,
        thickness: 1,
      });
    }
    
    page.drawLine({
      start: { x: MARGIN + 20, y: startY - height },
      end: { x: MARGIN + 20 + tableWidth, y: startY - height },
      color: COLORS.border,
      thickness: 1,
    });
  }

  private drawTotalsRow(page: PDFPage, data: PdfRequestData, startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowTop = startY + ROW_HEIGHT / 2;
    
    // Totals row background
    let xPos = MARGIN + 20;
    colWidths.forEach(width => {
      page.drawRectangle({
        x: xPos,
        y: startY - ROW_HEIGHT / 2,
        width: width,
        height: ROW_HEIGHT,
        color: COLORS.primaryLight,
      });
      xPos += width;
    });

    // Totals row data
    const totalsRowData = [
      "Totals", "", "",
      data.totals.goldDebit.toFixed(3),
      data.totals.goldCredit.toFixed(3),
      formatBalance(data.closingBalance.gold),
      data.totals.kwdDebit.toFixed(3),
      data.totals.kwdCredit.toFixed(3),
      formatBalance(data.closingBalance.kwd)
    ];

    // Draw totals text
    xPos = MARGIN + 20;
    totalsRowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 2;
      const textColor = COLORS.white;
      const textFont = colIndex >= 3 ? boldFont : font;
      
      const textX = isLeftAligned ? 
        xPos + 5 : 
        xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, 8)) / 2;
      
      page.drawText(data, {
        x: textX,
        y: startY - 3,
        size: 8,
        font: textFont,
        color: textColor,
      });
      
      xPos += colWidths[colIndex];
    });

    // Draw totals row grid
    this.drawTableGrid(page, rowTop, ROW_HEIGHT, colWidths);

    return startY - ROW_HEIGHT;
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number): void {
    const { font } = this.getFonts();
    const footerY = MARGIN + 10;
    const footerText = `Generated by Bloudan Jewellery - Account Ledger System - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.textLight,
    });
  }

  async generatePDF(data: PdfRequestData): Promise<Uint8Array> {
    await this.initialize();
    const pdfDoc = this.getPDFDoc();
    
    const allEntries = data.ledgerEntries;
    const totalPages = Math.ceil(allEntries.length / this.pageConfig.maxRowsPerPage);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = this.createNewPage();
      const startIdx = (pageNum - 1) * this.pageConfig.maxRowsPerPage;
      const endIdx = Math.min(startIdx + this.pageConfig.maxRowsPerPage, allEntries.length);
      const pageEntries = allEntries.slice(startIdx, endIdx);
      const isLastPage = pageNum === totalPages;

      // Draw page header
      const tableTop = this.drawPageHeader(page, data, pageNum, totalPages);
      
      // Draw table header
      const { tableTop: rowsStartY, colWidths } = this.drawTableHeader(page, tableTop);
      
      // Draw table rows
      let currentY = this.drawTableRows(page, pageEntries, rowsStartY, colWidths);
      
      // Draw totals row only on last page
      if (isLastPage) {
        currentY = this.drawTotalsRow(page, data, currentY, colWidths);
      }
      
      // Draw footer
      this.drawFooter(page, pageNum, totalPages);
    }

    return await pdfDoc.save();
  }
}

// Helper function to transform voucher data to ledger entries
function transformVoucherData(
  vouchers: any[],
  openingGold: number,
  openingKwd: number
): { ledgerEntries: LedgerEntry[], totals: any } {
  let goldBalance = openingGold;
  let kwdBalance = openingKwd;
  
  let totalGoldDebit = 0;
  let totalGoldCredit = 0;
  let totalKwdDebit = 0;
  let totalKwdCredit = 0;

  const ledgerEntries: LedgerEntry[] = [];

  // Add opening balance entry
  ledgerEntries.push({
    date: new Date().toISOString().split('T')[0],
    voucherId: '',
    type: 'INV',
    description: 'Opening Balance',
    goldDebit: 0,
    goldCredit: 0,
    goldBalance: openingGold,
    kwdDebit: 0,
    kwdCredit: 0,
    kwdBalance: openingKwd,
    isOpeningBalance: true,
  });

  // Add voucher entries
  vouchers.forEach((voucher) => {
    let goldDebit = 0;
    let goldCredit = 0;
    let kwdDebit = 0;
    let kwdCredit = 0;

    if (voucher.vt === 'INV' || voucher.vt === 'Alloy') {
      goldDebit = voucher.gold;
      kwdDebit = voucher.kwd;
      totalGoldDebit += voucher.gold;
      totalKwdDebit += voucher.kwd;
    } else if (voucher.vt === 'REC') {
      goldCredit = voucher.gold;
      kwdCredit = voucher.kwd;
      totalGoldCredit += voucher.gold;
      totalKwdCredit += voucher.kwd;
    } else if (voucher.vt === 'GFV') {
      goldDebit = voucher.gold;
      kwdCredit = voucher.kwd;
      totalGoldDebit += voucher.gold;
      totalKwdCredit += voucher.kwd;
    }

    goldBalance = voucher.goldBalance;
    kwdBalance = voucher.kwdBalance;

    ledgerEntries.push({
      date: voucher.date,
      voucherId: voucher.mvn || voucher.id.substring(0, 8),
      type: voucher.vt,
      description: voucher.description || voucher.mvn || 'Transaction',
      goldDebit,
      goldCredit,
      goldBalance,
      kwdDebit,
      kwdCredit,
      kwdBalance,
    });
  });

  // Add closing balance entry
  const closingGold = vouchers.length > 0 ? vouchers[vouchers.length - 1].goldBalance : openingGold;
  const closingKwd = vouchers.length > 0 ? vouchers[vouchers.length - 1].kwdBalance : openingKwd;
  
  ledgerEntries.push({
    date: new Date().toISOString().split('T')[0],
    voucherId: '',
    type: 'INV',
    description: 'Closing Balance',
    goldDebit: 0,
    goldCredit: 0,
    goldBalance: closingGold,
    kwdDebit: 0,
    kwdCredit: 0,
    kwdBalance: closingKwd,
    isClosingBalance: true,
  });

  return {
    ledgerEntries,
    totals: {
      goldDebit: totalGoldDebit,
      goldCredit: totalGoldCredit,
      kwdDebit: totalKwdDebit,
      kwdCredit: totalKwdCredit,
    }
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
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

    // Validate dates
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

    // Transform data for PDF
    const { ledgerEntries, totals } = transformVoucherData(
      processedVouchers,
      openingGold,
      openingKwd
    );

    const closingGold = processedVouchers.length > 0 
      ? processedVouchers[processedVouchers.length - 1].goldBalance 
      : openingGold;
    const closingKwd = processedVouchers.length > 0 
      ? processedVouchers[processedVouchers.length - 1].kwdBalance 
      : openingKwd;

    const pdfData: PdfRequestData = {
      account: {
        id: account.id,
        name: account.name,
        type: accountType as string,
      },
      dateRange: {
        start: startDate as string || '',
        end: endDate as string || '',
      },
      ledgerEntries,
      openingBalance: { gold: openingGold, kwd: openingKwd },
      closingBalance: { gold: closingGold, kwd: closingKwd },
      totals,
    };

    // Generate PDF
    const generator = new PDFGenerator();
    const pdfBytes = await generator.generatePDF(pdfData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBytes.length.toString());
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bloudan-ledger-${account.name.replace(/\s+/g, '-')}-${startDate || 'all'}-to-${endDate || 'all'}.pdf"`
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