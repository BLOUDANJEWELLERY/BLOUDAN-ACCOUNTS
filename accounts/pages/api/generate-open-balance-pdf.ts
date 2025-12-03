// pages/api/generate-open-balance-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface LedgerEntry {
  date: string;
  voucherId: string;
  accountName: string;
  accountNo: number;
  accountType: string;
  type: "REC" | "GFV" | "BAL";
  description: string;
  goldRate?: number;
  gold: number;
  amount: number;
  goldBalance: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
  originalDate?: string;
  goldDebit?: number;
  goldCredit?: number;
  kwdDebit?: number;
  kwdCredit?: number;
}

interface OpenBalancePdfRequestData {
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  ledgerEntries: LedgerEntry[];
  openingBalance: { gold: number; kwd: number };
  closingBalance: { gold: number; kwd: number };
  totals: {
    periodGold: number;
    periodKwd: number;
    goldDebit: number;
    goldCredit: number;
    kwdDebit: number;
    kwdCredit: number;
  };
  voucherSummary: {
    marketRec: number;
    gfv: number;
    total: number;
  };
}

// Helper function to format balance with Cr/Db
const formatBalance = (balance: number, type: 'gold' | 'kwd'): string => {
  if (balance === undefined || balance === null) {
    return `0.000 Cr`;
  }
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  const unit = type === 'gold' ? 'g' : 'KWD';
  return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
};

// Helper function to format balance without unit (for table cells)
const formatBalanceNoUnit = (balance: number): string => {
  if (balance === undefined || balance === null) {
    return `0.000 Cr`;
  }
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  return `${absoluteValue.toFixed(3)} ${suffix}`;
};

// Helper function to format date
const formatDate = (dateString: string): string => {
  if (!dateString || dateString === "Beginning" || dateString === "Present") {
    return dateString;
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 30;

// Colors - Blue theme to match page
const COLORS = {
  blue50: rgb(239 / 255, 246 / 255, 255 / 255),
  blue100: rgb(219 / 255, 234 / 255, 254 / 255),
  blue200: rgb(191 / 255, 219 / 255, 254 / 255),
  blue300: rgb(147 / 255, 197 / 255, 253 / 255),
  blue400: rgb(96 / 255, 165 / 255, 250 / 255),
  blue500: rgb(59 / 255, 130 / 255, 246 / 255),
  blue600: rgb(37 / 255, 99 / 255, 235 / 255),
  blue700: rgb(29 / 255, 78 / 255, 216 / 255),
  blue800: rgb(30 / 255, 64 / 255, 175 / 255),
  blue900: rgb(30 / 255, 58 / 255, 138 / 255),
  white: rgb(1, 1, 1),
  gray: rgb(107 / 255, 114 / 255, 128 / 255),
  red: rgb(220 / 255, 38 / 255, 38 / 255),
  green: rgb(22 / 255, 163 / 255, 74 / 255),
  yellow: rgb(234 / 255, 179 / 255, 8 / 255),
  purple: rgb(147 / 255, 51 / 255, 234 / 255)
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

class OpenBalancePDFGenerator {
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
    
    const headerSectionHeight = 120;
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
      throw new Error("OpenBalancePDFGenerator not initialized. Call initialize() first.");
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
    
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageConfig.width,
      height: this.pageConfig.height,
      color: COLORS.blue50,
    });

    page.drawRectangle({
      x: MARGIN,
      y: MARGIN,
      width: this.pageConfig.contentWidth,
      height: this.pageConfig.contentHeight,
      color: COLORS.white,
      borderColor: COLORS.blue300,
      borderWidth: 2,
    });

    return page;
  }

  private drawPageHeader(
    page: PDFPage, 
    data: OpenBalancePdfRequestData, 
    pageNumber: number, 
    totalPages: number
  ): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 30;

    // Header
    page.drawText("Bloudan Jewellery", {
      x: MARGIN + 20,
      y: currentY,
      size: 20,
      font: boldFont,
      color: COLORS.blue800,
    });

    page.drawText("Open Balance Ledger", {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.blue700,
    });

    page.drawText("Gold Fixing Transactions", {
      x: MARGIN + 20,
      y: currentY - 45,
      size: 14,
      font: font,
      color: COLORS.blue600,
    });

    currentY -= 65;

    // Date Range
    const startDate = data.startDate ? formatDate(data.startDate) : 'Beginning';
    const endDate = data.endDate ? formatDate(data.endDate) : 'Present';
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 12,
      font: boldFont,
      color: COLORS.blue800,
    });

    // Transaction Summary
    const summaryInfo = `Transactions: ${data.voucherSummary.total} total (${data.voucherSummary.marketRec} REC, ${data.voucherSummary.gfv} GFV)`;
    page.drawText(summaryInfo, {
      x: MARGIN + 20,
      y: currentY - 15,
      size: 11,
      font: font,
      color: COLORS.blue700,
    });

    // Page number
    const pageInfo = `Page ${pageNumber} of ${totalPages}`;
    page.drawText(pageInfo, {
      x: this.pageConfig.width - MARGIN - 20 - boldFont.widthOfTextAtSize(pageInfo, 10),
      y: currentY,
      size: 10,
      font: boldFont,
      color: COLORS.blue800,
    });

    currentY -= 35;

    // Ledger Table Header
    page.drawText("Open Balance Transaction History", {
      x: MARGIN + 20,
      y: currentY,
      size: 14,
      font: boldFont,
      color: COLORS.blue800,
    });

    return currentY - 25;
  }

  private drawTableHeader(page: PDFPage, tableTop: number): { tableTop: number; colWidths: number[] } {
    const { boldFont } = this.getFonts();
    const tableWidth = this.pageConfig.contentWidth - 40;
    
    // Open Balance columns (11 columns) - using let instead of const
    let colWidths = [50, 70, 30, 120, 40, 40, 40, 60, 40, 40, 60];
    
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
      borderColor: COLORS.blue300,
      borderWidth: 2,
    });

    // Table header background
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: COLORS.blue100,
    });

    // Calculate positions for grouped headers
    let xPos = MARGIN + 20;
    
    // First five columns (Date, Account, Type, Description, Gold Rate)
    const firstFiveColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    
    // Gold group header (spans Gold Debit, Gold Credit, Gold Balance)
    const goldGroupStartX = xPos + firstFiveColumnsWidth;
    const goldGroupWidth = colWidths[5] + colWidths[6] + colWidths[7];
    
    // Amount group header
    const amountGroupStartX = goldGroupStartX + goldGroupWidth;
    const amountGroupWidth = colWidths[8] + colWidths[9] + colWidths[10];

    // Draw grouped header backgrounds
    page.drawRectangle({
      x: goldGroupStartX,
      y: tableTop - 20,
      width: goldGroupWidth,
      height: 20,
      color: COLORS.blue800,
    });

    page.drawRectangle({
      x: amountGroupStartX,
      y: tableTop - 20,
      width: amountGroupWidth,
      height: 20,
      color: COLORS.blue800,
    });

    // ========== SEGMENTED VERTICAL LINES ==========

    // Segment A: FULL-HEIGHT vertical lines for first five columns
    xPos = MARGIN + 20;
    
    for (let col = 0; col <= 5; col++) {
      page.drawLine({
        start: { x: xPos, y: tableTop },
        end: { x: xPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });
      if (col < 5) {
        xPos += colWidths[col];
      }
    }

    // Segment B: Vertical lines INSIDE Gold group
    let groupXPos = goldGroupStartX;
    
    // Gold group left border
    page.drawLine({
      start: { x: groupXPos, y: tableTop },
      end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // Gold group internal vertical borders (only in bottom header row)
    page.drawLine({
      start: { x: groupXPos + colWidths[5], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[5], y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[5] + colWidths[6], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[5] + colWidths[6], y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // Gold group right border
    page.drawLine({
      start: { x: groupXPos + goldGroupWidth, y: tableTop },
      end: { x: groupXPos + goldGroupWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // Segment C: Vertical lines INSIDE Amount group
    groupXPos = amountGroupStartX;
    
    // Amount group left border
    page.drawLine({
      start: { x: groupXPos, y: tableTop },
      end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // Amount group internal vertical borders (only in bottom header row)
    page.drawLine({
      start: { x: groupXPos + colWidths[8], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[8], y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[8] + colWidths[9], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[8] + colWidths[9], y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // Amount group right border
    page.drawLine({
      start: { x: groupXPos + amountGroupWidth, y: tableTop },
      end: { x: groupXPos + amountGroupWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // RIGHTMOST TABLE BORDER
    const tableRightEdge = MARGIN + 20 + tableWidth;
    page.drawLine({
      start: { x: tableRightEdge, y: tableTop },
      end: { x: tableRightEdge, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });

    // Draw horizontal line between grouped header and column headers
    page.drawLine({
      start: { x: goldGroupStartX, y: tableTop - 20 },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - 20 },
      color: COLORS.blue300,
      thickness: 1,
    });

    // Draw horizontal line at bottom of header
    page.drawLine({
      start: { x: MARGIN + 20, y: tableTop - HEADER_HEIGHT },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 1,
    });

    // First five column headers (Date, Account, Type, Description, Gold Rate) - centered in full header height
    xPos = MARGIN + 20;
    const firstFiveHeaders = ["Date", "Account", "Type", "Description", "Gold Rate"];
    
    firstFiveHeaders.forEach((header, index) => {
      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 24,
        size: 9,
        font: boldFont,
        color: COLORS.blue800,
      });
      
      xPos += colWidths[index];
    });

    // Column header text for Gold and Amount sections (second row only) - All centered
    const goldHeaders = ["Gold Debit", "Gold Credit", "Gold Balance"];
    const amountHeaders = ["Amount Debit", "Amount Credit", "Amount Balance"];
    
    // Gold section headers - All centered horizontally
    xPos = goldGroupStartX;
    goldHeaders.forEach((header, index) => {
      const colIndex = 5 + index;
      const textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(header, 8)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 34,
        size: 8,
        font: boldFont,
        color: COLORS.blue800,
      });
      
      xPos += colWidths[colIndex];
    });

    // Amount section headers - All centered horizontally
    xPos = amountGroupStartX;
    amountHeaders.forEach((header, index) => {
      const colIndex = 8 + index;
      const textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(header, 8)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 34,
        size: 8,
        font: boldFont,
        color: COLORS.blue800,
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
        color: COLORS.blue300,
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
        color: COLORS.blue300,
        thickness: 1,
      });
    }
    
    page.drawLine({
      start: { x: MARGIN + 20, y: startY - height },
      end: { x: MARGIN + 20 + tableWidth, y: startY - height },
      color: COLORS.blue300,
      thickness: 1,
    });
  }

  private drawTableRows(page: PDFPage, entries: LedgerEntry[], startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10;
    let currentY = startY - ROW_OFFSET;

    // Draw rows
    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background - special colors for opening/closing balance
      let rowBgColor;
      if (entry.isOpeningBalance) {
        rowBgColor = rgb(254 / 255, 243 / 255, 199 / 255); // Yellow for opening
      } else if (entry.isClosingBalance) {
        rowBgColor = rgb(220 / 255, 252 / 255, 231 / 255); // Green for closing
      } else {
        rowBgColor = index % 2 === 0 ? COLORS.white : COLORS.blue50;
      }

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

      // Prepare row data
      const displayDate = entry.isOpeningBalance || entry.isClosingBalance 
        ? formatDate(entry.date)
        : formatDate(entry.date);

      // Get account information
      const accountDisplay = entry.isOpeningBalance || entry.isClosingBalance 
        ? entry.accountName 
        : `${entry.accountNo} - ${entry.accountName}`;

      // Get voucher type with proper labels
      let typeDisplay = entry.type;
      if (entry.type === "REC" && entry.goldRate) {
        typeDisplay = "REC (Gold Fixing)";
      } else if (entry.type === "GFV") {
        typeDisplay = "GFV (Gold Fixing)";
      } else if (entry.type === "BAL") {
        typeDisplay = "BAL";
      }

      // Truncate description if too long
      let description = entry.description || '';
      const maxDescLength = 35;
      if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
      }

      // Prepare row data
      const rowData: string[] = [];
      
      // Date
      rowData.push(displayDate);
      
      // Account
      rowData.push(accountDisplay.substring(0, 15) + (accountDisplay.length > 15 ? '...' : ''));
      
      // Type
      rowData.push(typeDisplay);
      
      // Description
      rowData.push(description);
      
      // Gold Rate
      rowData.push(entry.goldRate ? entry.goldRate.toFixed(3) : '-');
      
      // Gold columns
      rowData.push(entry.goldDebit && entry.goldDebit > 0 ? entry.goldDebit.toFixed(3) : '-');
      rowData.push(entry.goldCredit && entry.goldCredit > 0 ? entry.goldCredit.toFixed(3) : '-');
      rowData.push(formatBalanceNoUnit(entry.goldBalance));
      
      // Amount columns
      rowData.push(entry.kwdDebit && entry.kwdDebit > 0 ? entry.kwdDebit.toFixed(3) : '-');
      rowData.push(entry.kwdCredit && entry.kwdCredit > 0 ? entry.kwdCredit.toFixed(3) : '-');
      rowData.push(formatBalanceNoUnit(entry.kwdBalance));

      // Draw cell text
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const isLeftAligned = colIndex === 3; // Only description is left-aligned
        const isBalanceCol = colIndex === 7 || colIndex === 10;
        const isTypeCol = colIndex === 2;
        const isGoldRateCol = colIndex === 4;
        
        let textColor = COLORS.blue700;
        let textFont = (entry.isOpeningBalance || entry.isClosingBalance) ? boldFont : font;
        
        // Special formatting for voucher types
        if (isTypeCol && !entry.isOpeningBalance && !entry.isClosingBalance) {
          if (entry.type === "REC" && entry.goldRate) {
            textColor = COLORS.yellow;
          } else if (entry.type === "GFV") {
            textColor = COLORS.purple;
          } else if (entry.type === "BAL") {
            textColor = COLORS.blue700;
          }
        }
        
        // Special formatting for gold rate
        if (isGoldRateCol && entry.goldRate) {
          textFont = boldFont;
        }
        
        // Special formatting for balance columns
        if (isBalanceCol) {
          textFont = boldFont;
          const balanceValue = colIndex === 7 ? entry.goldBalance : entry.kwdBalance;
          textColor = balanceValue >= 0 ? COLORS.blue700 : COLORS.red;
        }

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

  private drawTotalsRow(page: PDFPage, data: OpenBalancePdfRequestData, startY: number, colWidths: number[]): number {
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
        color: COLORS.blue100,
      });
      xPos += width;
    });

    // Prepare totals data
    const totalsRowData: string[] = ["Totals", "", "", "", ""];
    
    // Gold totals
    totalsRowData.push(data.totals.goldDebit.toFixed(3));
    totalsRowData.push(data.totals.goldCredit.toFixed(3));
    totalsRowData.push(formatBalanceNoUnit(data.closingBalance.gold));
    
    // Amount totals
    totalsRowData.push(data.totals.kwdDebit.toFixed(3));
    totalsRowData.push(data.totals.kwdCredit.toFixed(3));
    totalsRowData.push(formatBalanceNoUnit(data.closingBalance.kwd));

    // Draw totals text
    xPos = MARGIN + 20;
    totalsRowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 3;
      const isBalanceCol = colIndex === 7 || colIndex === 10;
      const textColor = isBalanceCol ? COLORS.blue900 : COLORS.blue800;
      const textFont = colIndex >= 5 ? boldFont : font;
      
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
    const footerText = `Generated by Bloudan Jewellery - Open Balance Ledger System - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
    });
  }

  async generatePDF(data: OpenBalancePdfRequestData): Promise<Uint8Array> {
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
    console.log("Starting Open Balance PDF generation...");
    
    const data: OpenBalancePdfRequestData = req.body;

    // Validate required data
    if (!data.ledgerEntries) {
      return res.status(400).json({ success: false, error: "Ledger entries are required" });
    }

    console.log(`Generating Open Balance PDF with ${data.ledgerEntries.length} entries`);

    // Generate PDF
    const generator = new OpenBalancePDFGenerator();
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("Open Balance PDF generated successfully with pagination");

    return res.json({ 
      success: true, 
      pdfData: pdfBase64,
      message: `Open Balance Ledger PDF generated successfully` 
    });

  } catch (err) {
    console.error("Open Balance PDF generation failed:", err);
    
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: "Open Balance PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}