// pages/api/generate-ledger-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface LedgerEntry {
  date: string;
  voucherId: string;
  type: "INV" | "REC";
  description: string;
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
  pdfUrl?: string;
}

interface Account {
  id: string;
  accountNo: string;
  name: string;
  phone: string;
  cr: string;
}

interface PdfRequestData {
  account: Account;
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
    .replace(/^Receipt - /, '');
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 30;

// Colors
const COLORS = {
  emerald50: rgb(236 / 255, 253 / 255, 245 / 255),
  emerald100: rgb(209 / 255, 250 / 255, 229 / 255),
  emerald300: rgb(110 / 255, 231 / 255, 183 / 255),
  emerald700: rgb(4 / 255, 120 / 255, 87 / 255),
  emerald800: rgb(6 / 255, 95 / 255, 70 / 255),
  emerald900: rgb(6 / 255, 78 / 255, 59 / 255),
  white: rgb(1, 1, 1),
  gray: rgb(107 / 255, 114 / 255, 128 / 255)
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
    
    // Calculate available space for table (after header and before footer)
    const headerSectionHeight = 180; // Space for company header, account info, etc.
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
    
    // Create PDF document first
    this.pdfDoc = await PDFDocument.create();
    
    // Then embed fonts
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
      color: COLORS.emerald50,
    });

    // Main container
    page.drawRectangle({
      x: MARGIN,
      y: MARGIN,
      width: this.pageConfig.contentWidth,
      height: this.pageConfig.contentHeight,
      color: COLORS.white,
      borderColor: COLORS.emerald300,
      borderWidth: 2,
    });

    return page;
  }

  private drawPageHeader(page: PDFPage, data: PdfRequestData, pageNumber: number, totalPages: number): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 30;

    // Header
    page.drawText("ZAMZAM JEWELLERY", {
      x: MARGIN + 20,
      y: currentY,
      size: 20,
      font: boldFont,
      color: COLORS.emerald800,
    });

    page.drawText("Account Ledger Statement", {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.emerald700,
    });

    currentY -= 50;

    // Account Information
    const accountBoxHeight = 40;
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - accountBoxHeight,
      width: this.pageConfig.contentWidth - 40,
      height: accountBoxHeight,
      color: COLORS.emerald50,
      borderColor: COLORS.emerald300,
      borderWidth: 1,
    });

    const accountInfo = `Account: ${data.account.accountNo} | Name: ${data.account.name} | Phone: ${data.account.phone || 'N/A'} | CR No: ${data.account.cr || 'N/A'}`;
    page.drawText(accountInfo, {
      x: MARGIN + 35,
      y: currentY - 25,
      size: 10,
      font: font,
      color: COLORS.emerald700,
    });

    currentY -= 60;

    // Date Range
    const startDate = data.dateRange.start ? new Date(data.dateRange.start).toLocaleDateString() : 'All';
    const endDate = data.dateRange.end ? new Date(data.dateRange.end).toLocaleDateString() : 'All';
    
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 12,
      font: boldFont,
      color: COLORS.emerald800,
    });

    // Page number
    const pageInfo = `Page ${pageNumber} of ${totalPages}`;
    page.drawText(pageInfo, {
      x: this.pageConfig.width - MARGIN - 20 - boldFont.widthOfTextAtSize(pageInfo, 10),
      y: currentY,
      size: 10,
      font: boldFont,
      color: COLORS.emerald800,
    });

    currentY -= 30;

    // Ledger Table Header
    page.drawText("Transaction History", {
      x: MARGIN + 20,
      y: currentY,
      size: 14,
      font: boldFont,
      color: COLORS.emerald800,
    });

    return currentY - 25;
  }

  private drawTableHeader(page: PDFPage, tableTop: number): { tableTop: number; colWidths: number[] } {
    const { boldFont } = this.getFonts();
    const tableWidth = this.pageConfig.contentWidth - 40;
    
    // Column widths (9 columns total) - matching your original structure
    let colWidths = [50, 35, 200, 60, 60, 75, 60, 60, 75]; // Total: 675
    
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
      borderColor: COLORS.emerald300,
      borderWidth: 2,
    });

    // Table header background (full height for both header rows)
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: COLORS.emerald100,
    });

    // Calculate positions for grouped headers - matching your original structure
    let xPos = MARGIN + 20;
    
    // First three columns (Date, Type, Description) span full header height
    const firstThreeColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2];
    
    // Gold group header (spans G Debit, G Credit, G Balance)
    const goldGroupStartX = xPos + firstThreeColumnsWidth;
    const goldGroupWidth = colWidths[3] + colWidths[4] + colWidths[5];
    
    // Amount group header (spans KWD Debit, KWD Credit, KWD Balance)
    const amountGroupStartX = goldGroupStartX + goldGroupWidth;
    const amountGroupWidth = colWidths[6] + colWidths[7] + colWidths[8];

    // Draw grouped header backgrounds (only for Gold and Amount sections)
    page.drawRectangle({
      x: goldGroupStartX,
      y: tableTop - 20,
      width: goldGroupWidth,
      height: 20,
      color: COLORS.emerald800,
    });

    page.drawRectangle({
      x: amountGroupStartX,
      y: tableTop - 20,
      width: amountGroupWidth,
      height: 20,
      color: COLORS.emerald800,
    });

    // ========== SEGMENTED VERTICAL LINES ==========

    // Segment A: FULL-HEIGHT vertical lines for first three columns
    xPos = MARGIN + 20;
    for (let col = 0; col <= 3; col++) {
      page.drawLine({
        start: { x: xPos, y: tableTop },
        end: { x: xPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.emerald300,
        thickness: 0.5,
      });
      if (col < 3) {
        xPos += colWidths[col];
      }
    }

    // Segment B: Vertical lines INSIDE Gold group
    let groupXPos = goldGroupStartX;
    
    // Gold group left border
    page.drawLine({
      start: { x: groupXPos, y: tableTop },
      end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // Gold group internal vertical borders (only in bottom header row)
    page.drawLine({
      start: { x: groupXPos + colWidths[3], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[3], y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[3] + colWidths[4], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[3] + colWidths[4], y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // Gold group right border
    page.drawLine({
      start: { x: groupXPos + goldGroupWidth, y: tableTop },
      end: { x: groupXPos + goldGroupWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // Segment C: Vertical lines INSIDE Amount group
    groupXPos = amountGroupStartX;
    
    // Amount group left border
    page.drawLine({
      start: { x: groupXPos, y: tableTop },
      end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // Amount group internal vertical borders (only in bottom header row)
    page.drawLine({
      start: { x: groupXPos + colWidths[6], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[6], y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[6] + colWidths[7], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[6] + colWidths[7], y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // Amount group right border
    page.drawLine({
      start: { x: groupXPos + amountGroupWidth, y: tableTop },
      end: { x: groupXPos + amountGroupWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // RIGHTMOST TABLE BORDER
    const tableRightEdge = MARGIN + 20 + tableWidth;
    page.drawLine({
      start: { x: tableRightEdge, y: tableTop },
      end: { x: tableRightEdge, y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 0.5,
    });

    // Draw horizontal line between grouped header and column headers
    page.drawLine({
      start: { x: goldGroupStartX, y: tableTop - 20 },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - 20 },
      color: COLORS.emerald300,
      thickness: 1,
    });

    // Draw horizontal line at bottom of header
    page.drawLine({
      start: { x: MARGIN + 20, y: tableTop - HEADER_HEIGHT },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.emerald300,
      thickness: 1,
    });

    // First three column headers (Date, Type, Description) - centered in full header height
    xPos = MARGIN + 20;
    const firstThreeHeaders = ["Date", "Type", "Description"];
    
    firstThreeHeaders.forEach((header, index) => {
      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 24,
        size: 9,
        font: boldFont,
        color: COLORS.emerald800,
      });
      
      xPos += colWidths[index];
    });

    // Column header text for Gold and Amount sections (second row only) - All centered
    const goldHeaders = ["Debit", "Credit", "Balance"];
    const amountHeaders = ["Debit", "Credit", "Balance"];
    
    // Gold section headers - All centered horizontally
    xPos = goldGroupStartX;
    goldHeaders.forEach((header, index) => {
      const colIndex = 3 + index;
      const textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(header, 8)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 34,
        size: 8,
        font: boldFont,
        color: COLORS.emerald800,
      });
      
      xPos += colWidths[colIndex];
    });

    // Amount section headers - All centered horizontally
    xPos = amountGroupStartX;
    amountHeaders.forEach((header, index) => {
      const colIndex = 6 + index;
      const textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(header, 8)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 34,
        size: 8,
        font: boldFont,
        color: COLORS.emerald800,
      });
      
      xPos += colWidths[colIndex];
    });

    // Draw grouped header text - Centered both horizontally and vertically
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
        color: COLORS.emerald300,
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
        color: COLORS.emerald300,
        thickness: 1,
      });
    }
    
    page.drawLine({
      start: { x: MARGIN + 20, y: startY - height },
      end: { x: MARGIN + 20 + tableWidth, y: startY - height },
      color: COLORS.emerald300,
      thickness: 1,
    });
  }

  private drawTableRows(page: PDFPage, entries: LedgerEntry[], startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10; // Move rows down by 12px (adjust as you like)
let currentY = startY - ROW_OFFSET;

    // Draw rows
    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background
      const rowBgColor = entry.isOpeningBalance || entry.isClosingBalance 
        ? COLORS.emerald50 
        : (index % 2 === 0 ? COLORS.white : rgb(254 / 255, 243 / 255, 199 / 255));

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

      // Row data
      const displayDate = entry.isOpeningBalance || entry.isClosingBalance 
        ? new Date(entry.date).toLocaleDateString() 
        : (entry.date || '').split('/').slice(0, 2).join('/');

      const cleanedDescription = cleanDescription(
        entry.description || '',
        entry.isOpeningBalance,
        entry.isClosingBalance
      );

      const rowData = [
        displayDate,
        entry.isOpeningBalance || entry.isClosingBalance ? 'BAL' : (entry.type || ''),
        cleanedDescription.substring(0, 40) + (cleanedDescription.length > 40 ? '...' : ''),
        entry.goldDebit > 0 ? (entry.goldDebit || 0).toFixed(3) : '-',
        entry.goldCredit > 0 ? (entry.goldCredit || 0).toFixed(3) : '-',
        formatBalance(entry.goldBalance || 0),
        entry.kwdDebit > 0 ? (entry.kwdDebit || 0).toFixed(3) : '-',
        entry.kwdCredit > 0 ? (entry.kwdCredit || 0).toFixed(3) : '-',
        formatBalance(entry.kwdBalance || 0)
      ];

      // Draw cell text - All centered except description
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const isLeftAligned = colIndex === 2; // Only description is left-aligned
        const textColor = COLORS.emerald700;
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
        color: COLORS.emerald100,
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
      const textColor = COLORS.emerald900;
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
    const footerText = `Generated by ZamZam Jewellery - Account Ledger System - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    console.log("Starting PDF generation...");
    
    const data: PdfRequestData = req.body;

    // Validate required data
    if (!data.account) {
      return res.status(400).json({ success: false, error: "Account data is required" });
    }

    if (!data.ledgerEntries) {
      return res.status(400).json({ success: false, error: "Ledger entries are required" });
    }

    console.log(`Generating PDF for account: ${data.account.accountNo}, entries: ${data.ledgerEntries.length}`);

    // Generate PDF
    const generator = new PDFGenerator();
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("PDF generated successfully with pagination");

    return res.json({ 
      success: true, 
      pdfData: pdfBase64,
      message: "Ledger PDF generated successfully" 
    });

  } catch (err) {
    console.error("PDF generation failed:", err);
    
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: "PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}