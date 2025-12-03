// pages/api/generate-ledger-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface LedgerEntry {
  date: string;
  voucherId: string;
  type: "INV" | "REC" | "GFV" | "Alloy" | "BAL";
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
  crOrCivilIdNo: string;
  type: string;
}

interface PdfRequestData {
  account: Account;
  dateRange: {
    start: string;
    end: string;
    isCustom?: boolean;
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
  isProjectAccount: boolean;
}

// Helper function to format balance
const formatBalance = (balance: number, type: 'gold' | 'kwd' = 'gold'): string => {
  if (balance === undefined || balance === null) {
    return `0.000 Cr`;
  }
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  const unit = type === 'gold' ? 'g' : 'KWD';
  return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
};

// Helper function to get voucher type text
const getVoucherTypeText = (vt: string): string => {
  switch (vt) {
    case 'REC': return 'Receipt';
    case 'INV': return 'Invoice';
    case 'GFV': return 'Gold Form Voucher';
    case 'Alloy': return 'Alloy';
    case 'BAL': return 'Balance';
    default: return vt;
  }
};

// Helper function to clean description
const cleanDescription = (description: string, isOpeningBalance?: boolean, isClosingBalance?: boolean): string => {
  if (isOpeningBalance) return "Opening Balance";
  if (isClosingBalance) return "Closing Balance";
  return description;
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 30;

// BLUE Color Scheme matching the web page
const COLORS = {
  // Background colors
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
  
  // Complementary colors from page
  indigo100: rgb(224 / 255, 231 / 255, 255 / 255),
  indigo300: rgb(165 / 255, 180 / 255, 252 / 255),
  indigo500: rgb(99 / 255, 102 / 255, 241 / 255),
  indigo600: rgb(79 / 255, 70 / 255, 229 / 255),
  indigo800: rgb(55 / 255, 48 / 255, 163 / 255),
  
  // Status colors
  red500: rgb(239 / 255, 68 / 255, 68 / 255),
  red700: rgb(185 / 255, 28 / 255, 28 / 255),
  green500: rgb(34 / 255, 197 / 255, 94 / 255),
  green700: rgb(21 / 255, 128 / 255, 61 / 255),
  yellow100: rgb(254 / 255, 249 / 255, 195 / 255),
  yellow300: rgb(253 / 255, 224 / 255, 71 / 255),
  purple100: rgb(243 / 255, 232 / 255, 255 / 255),
  purple300: rgb(216 / 255, 180 / 255, 254 / 255),
  
  // Neutral colors
  white: rgb(1, 1, 1),
  gray: rgb(107 / 255, 114 / 255, 128 / 255),
  gray100: rgb(243 / 255, 244 / 255, 246 / 255),
  gray200: rgb(229 / 255, 231 / 255, 235 / 255),
  gray700: rgb(55 / 255, 65 / 255, 81 / 255),
  gray800: rgb(31 / 255, 41 / 255, 55 / 255),
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

  constructor(private isProjectAccount: boolean = false) {
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
    
    // Gradient-like background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageConfig.width,
      height: this.pageConfig.height,
      color: COLORS.blue50,
    });

    // Main container with border
    page.drawRectangle({
      x: MARGIN,
      y: MARGIN,
      width: this.pageConfig.contentWidth,
      height: this.pageConfig.contentHeight,
      color: COLORS.white,
      borderColor: COLORS.blue300,
      borderWidth: 2,
    });

    // Decorative elements
    page.drawCircle({
      x: MARGIN + 50,
      y: this.pageConfig.height - MARGIN - 50,
      size: 60,
      color: COLORS.blue200,
      opacity: 0.2,
    });

    page.drawCircle({
      x: this.pageConfig.width - MARGIN - 80,
      y: MARGIN + 80,
      size: 80,
      color: COLORS.indigo300,
      opacity: 0.2,
    });

    return page;
  }

  private drawPageHeader(page: PDFPage, data: PdfRequestData, pageNumber: number, totalPages: number): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 30;

    // Header with gradient effect
    const headerBgWidth = this.pageConfig.contentWidth - 40;
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - 5,
      width: headerBgWidth,
      height: 40,
      color: COLORS.blue600,
      opacity: 0.1,
    });

    page.drawText("BLOUDAN JEWELLERY", {
      x: MARGIN + 20,
      y: currentY,
      size: 20,
      font: boldFont,
      color: COLORS.blue800,
    });

    page.drawText("Account Ledger Statement", {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.blue700,
    });

    currentY -= 50;

    // Account Information Card
    const accountBoxHeight = 50;
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - accountBoxHeight,
      width: this.pageConfig.contentWidth - 40,
      height: accountBoxHeight,
      color: COLORS.blue50,
      borderColor: COLORS.blue300,
      borderWidth: 2,
      borderDashArray: [0],
    });

    // Account details in grid layout
    const accountLines = [
      `Account No: ${data.account.accountNo}`,
      `Name: ${data.account.name}`,
      `Type: ${data.account.type}`,
      `Phone: ${data.account.phone || 'N/A'}`,
      `CR/ID: ${data.account.crOrCivilIdNo || 'N/A'}`
    ];

    const columnWidth = (this.pageConfig.contentWidth - 60) / 5;
    let xPos = MARGIN + 35;
    
    accountLines.forEach((line, index) => {
      page.drawText(line, {
        x: xPos + (index * columnWidth),
        y: currentY - 30,
        size: 9,
        font: font,
        color: COLORS.blue800,
      });
    });

    currentY -= 70;

    // Date Range and Page Info
    const startDate = data.dateRange.start ? new Date(data.dateRange.start).toLocaleDateString() : 'Beginning';
    const endDate = data.dateRange.end ? new Date(data.dateRange.end).toLocaleDateString() : 'Present';
    
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 11,
      font: boldFont,
      color: COLORS.blue800,
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

    currentY -= 25;

    // Balance Summary Section
    page.drawText("Current Balance Summary", {
      x: MARGIN + 20,
      y: currentY,
      size: 14,
      font: boldFont,
      color: COLORS.blue800,
    });

    currentY -= 40;

    // Balance boxes
    const balanceBoxWidth = (this.pageConfig.contentWidth - 60) / (this.isProjectAccount ? 1 : 2);
    
    // Gold Balance
    const goldBalanceBoxX = MARGIN + 20;
    const goldBalanceColor = data.closingBalance.gold >= 0 ? COLORS.blue600 : COLORS.red700;
    
    page.drawRectangle({
      x: goldBalanceBoxX,
      y: currentY - 40,
      width: balanceBoxWidth,
      height: 50,
      color: goldBalanceColor,
      borderColor: COLORS.blue400,
      borderWidth: 2,
    });

    page.drawText("Gold Balance", {
      x: goldBalanceBoxX + 10,
      y: currentY - 15,
      size: 10,
      font: boldFont,
      color: COLORS.white,
    });

    page.drawText(formatBalance(data.closingBalance.gold, 'gold'), {
      x: goldBalanceBoxX + 10,
      y: currentY - 30,
      size: 14,
      font: boldFont,
      color: COLORS.white,
    });

    // Amount Balance (only if not project account)
    if (!this.isProjectAccount) {
      const amountBalanceBoxX = goldBalanceBoxX + balanceBoxWidth + 20;
      const amountBalanceColor = data.closingBalance.kwd >= 0 ? COLORS.blue600 : COLORS.red700;
      
      page.drawRectangle({
        x: amountBalanceBoxX,
        y: currentY - 40,
        width: balanceBoxWidth,
        height: 50,
        color: amountBalanceColor,
        borderColor: COLORS.blue400,
        borderWidth: 2,
      });

      page.drawText("Amount Balance", {
        x: amountBalanceBoxX + 10,
        y: currentY - 15,
        size: 10,
        font: boldFont,
        color: COLORS.white,
      });

      page.drawText(formatBalance(data.closingBalance.kwd, 'kwd'), {
        x: amountBalanceBoxX + 10,
        y: currentY - 30,
        size: 14,
        font: boldFont,
        color: COLORS.white,
      });
    }

    currentY -= 80;

    // Transaction History Title
    page.drawText("Transaction History", {
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
    
    // Column configuration based on account type
    let colConfig = [
      { name: "Date", width: 50 },
      { name: "Type", width: 35 },
      { name: "Description", width: 200 },
      { name: "Gold Debit (g)", width: 60 },
      { name: "Gold Credit (g)", width: 60 },
      { name: "Gold Balance", width: 75 },
    ];

    if (!this.isProjectAccount) {
      colConfig.push(
        { name: "Amount Debit", width: 60 },
        { name: "Amount Credit", width: 60 },
        { name: "Amount Balance", width: 75 }
      );
    }

    let colWidths = colConfig.map(col => col.width);
    const currentTotal = colWidths.reduce((a, b) => a + b, 0);
    const missing = tableWidth - currentTotal;
    
    if (missing > 0) {
      const extraPerColumn = missing / colWidths.length;
      colWidths = colWidths.map(w => w + extraPerColumn);
    }

    // Draw table container with blue border
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
    
    // First three columns (Date, Type, Description) span full header height
    const firstThreeColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2];
    
    // Gold group header
    const goldGroupStartX = xPos + firstThreeColumnsWidth;
    const goldGroupWidth = colWidths[3] + colWidths[4] + colWidths[5];
    
    // Amount group header (if applicable)
    let amountGroupStartX = 0;
    let amountGroupWidth = 0;
    
    if (!this.isProjectAccount) {
      amountGroupStartX = goldGroupStartX + goldGroupWidth;
      amountGroupWidth = colWidths[6] + colWidths[7] + colWidths[8];
    }

    // Draw grouped header backgrounds
    page.drawRectangle({
      x: goldGroupStartX,
      y: tableTop - 20,
      width: goldGroupWidth,
      height: 20,
      color: COLORS.blue600,
    });

    if (!this.isProjectAccount) {
      page.drawRectangle({
        x: amountGroupStartX,
        y: tableTop - 20,
        width: amountGroupWidth,
        height: 20,
        color: COLORS.blue600,
      });
    }

    // Draw vertical lines
    xPos = MARGIN + 20;
    for (let col = 0; col <= colWidths.length; col++) {
      page.drawLine({
        start: { x: xPos, y: tableTop },
        end: { x: xPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });
      if (col < colWidths.length) {
        xPos += colWidths[col];
      }
    }

    // Draw horizontal lines
    page.drawLine({
      start: { x: goldGroupStartX, y: tableTop - 20 },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - 20 },
      color: COLORS.blue300,
      thickness: 1,
    });

    page.drawLine({
      start: { x: MARGIN + 20, y: tableTop - HEADER_HEIGHT },
      end: { x: MARGIN + 20 + tableWidth, y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 1,
    });

    // Draw column headers
    xPos = MARGIN + 20;
    colConfig.forEach((col, index) => {
      let textY = tableTop - 24;
      let textSize = 9;
      let textColor = COLORS.blue800;
      
      if (index >= 3) { // Gold and Amount columns
        textY = tableTop - 34;
        textSize = 8;
      }
      
      if (index >= 3 && index <= 5) { // Gold section
        textColor = COLORS.white;
      }
      
      if (!this.isProjectAccount && index >= 6) { // Amount section
        textColor = COLORS.white;
      }

      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(col.name, textSize)) / 2;
      
      page.drawText(col.name, {
        x: textX,
        y: textY,
        size: textSize,
        font: boldFont,
        color: textColor,
      });
      
      xPos += colWidths[index];
    });

    // Draw grouped header text
    page.drawText("GOLD", {
      x: goldGroupStartX + (goldGroupWidth - boldFont.widthOfTextAtSize("GOLD", 10)) / 2,
      y: tableTop - 12,
      size: 10,
      font: boldFont,
      color: COLORS.white,
    });

    if (!this.isProjectAccount) {
      page.drawText("AMOUNT", {
        x: amountGroupStartX + (amountGroupWidth - boldFont.widthOfTextAtSize("AMOUNT", 10)) / 2,
        y: tableTop - 12,
        size: 10,
        font: boldFont,
        color: COLORS.white,
      });
    }

    return { tableTop: tableTop - HEADER_HEIGHT, colWidths };
  }

  private getVoucherTypeColor(vt: string): any {
    switch (vt) {
      case 'REC': return COLORS.red500;
      case 'INV': return COLORS.green500;
      case 'GFV': return COLORS.yellow300;
      case 'Alloy': return COLORS.purple300;
      case 'BAL': return COLORS.blue600;
      default: return COLORS.blue600;
    }
  }

  private drawTableRows(page: PDFPage, entries: LedgerEntry[], startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10;
    let currentY = startY - ROW_OFFSET;

    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background
      let rowBgColor;
      if (entry.isOpeningBalance) {
        rowBgColor = COLORS.blue50;
      } else if (entry.isClosingBalance) {
        rowBgColor = COLORS.indigo100;
      } else {
        rowBgColor = index % 2 === 0 ? COLORS.white : COLORS.blue50;
      }

      // Draw row background
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
        ? (entry.date === "Beginning" || entry.date === "Present" 
            ? entry.date 
            : new Date(entry.date).toLocaleDateString())
        : (entry.date || '');

      const cleanedDescription = cleanDescription(
        entry.description || '',
        entry.isOpeningBalance,
        entry.isClosingBalance
      );

      const rowData = [
        displayDate,
        getVoucherTypeText(entry.type),
        cleanedDescription.substring(0, 40) + (cleanedDescription.length > 40 ? '...' : ''),
        entry.goldDebit > 0 ? (entry.goldDebit || 0).toFixed(3) : '-',
        entry.goldCredit > 0 ? (entry.goldCredit || 0).toFixed(3) : '-',
        formatBalance(entry.goldBalance || 0, 'gold'),
      ];

      if (!this.isProjectAccount) {
        rowData.push(
          entry.kwdDebit > 0 ? (entry.kwdDebit || 0).toFixed(3) : '-',
          entry.kwdCredit > 0 ? (entry.kwdCredit || 0).toFixed(3) : '-',
          formatBalance(entry.kwdBalance || 0, 'kwd')
        );
      }

      // Draw cell content
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const isLeftAligned = colIndex === 2;
        const isBalance = colIndex === 5 || colIndex === 8;
        
        let textColor = COLORS.blue700;
        const textFont = (entry.isOpeningBalance || entry.isClosingBalance) ? boldFont : font;
        let textSize = 7;

        if (isBalance) {
          const balanceValue = colIndex === 5 ? entry.goldBalance : entry.kwdBalance;
          textColor = balanceValue >= 0 ? COLORS.blue700 : COLORS.red700;
        }

        if (colIndex === 1 && !entry.isOpeningBalance && !entry.isClosingBalance) {
          // Voucher type badge
          const typeColor = this.getVoucherTypeColor(entry.type);
          const badgeWidth = boldFont.widthOfTextAtSize(data, 6) + 8;
          
          page.drawRectangle({
            x: xPos + 2,
            y: rowBottom + 2,
            width: badgeWidth,
            height: ROW_HEIGHT - 4,
            color: typeColor,
            opacity: 0.1,
            borderColor: typeColor,
            borderWidth: 1,
          });
          
          page.drawText(data, {
            x: xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(data, 6)) / 2,
            y: currentY - 4,
            size: 6,
            font: boldFont,
            color: typeColor,
          });
        } else {
          const textX = isLeftAligned ? 
            xPos + 5 : 
            xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, textSize)) / 2;
          
          page.drawText(data, {
            x: textX,
            y: currentY - 3,
            size: textSize,
            font: textFont,
            color: textColor,
          });
        }
        
        xPos += colWidths[colIndex];
      });

      // Draw row grid
      this.drawRowGrid(page, rowTop, ROW_HEIGHT, colWidths, entry);

      currentY -= ROW_HEIGHT;
    });

    return currentY;
  }

  private drawRowGrid(page: PDFPage, rowTop: number, rowHeight: number, colWidths: number[], entry: LedgerEntry): void {
    const rowBottom = rowTop - rowHeight;
    let xPos = MARGIN + 20;

    // Draw vertical lines
    for (let col = 0; col <= colWidths.length; col++) {
      const lineColor = entry.isOpeningBalance || entry.isClosingBalance ? COLORS.blue300 : COLORS.gray200;
      
      page.drawLine({
        start: { x: xPos, y: rowTop },
        end: { x: xPos, y: rowBottom },
        color: lineColor,
        thickness: 0.5,
      });
      
      if (col < colWidths.length) {
        xPos += colWidths[col];
      }
    }

    // Draw horizontal lines
    const horizontalLineColor = entry.isOpeningBalance || entry.isClosingBalance ? COLORS.blue300 : COLORS.gray200;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    
    page.drawLine({
      start: { x: MARGIN + 20, y: rowTop },
      end: { x: MARGIN + 20 + tableWidth, y: rowTop },
      color: horizontalLineColor,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: MARGIN + 20, y: rowBottom },
      end: { x: MARGIN + 20 + tableWidth, y: rowBottom },
      color: horizontalLineColor,
      thickness: 0.5,
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
        color: COLORS.blue100,
      });
      xPos += width;
    });

    // Totals row data
    const totalsRowData = [
      "Filtered Period Totals", "", "",
      data.totals.goldDebit.toFixed(3),
      data.totals.goldCredit.toFixed(3),
      formatBalance(data.closingBalance.gold, 'gold'),
    ];

    if (!this.isProjectAccount) {
      totalsRowData.push(
        data.totals.kwdDebit.toFixed(3),
        data.totals.kwdCredit.toFixed(3),
        formatBalance(data.closingBalance.kwd, 'kwd')
      );
    }

    // Draw totals text
    xPos = MARGIN + 20;
    totalsRowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 2;
      const isBalance = colIndex === 5 || colIndex === 8;
      
      let textColor = COLORS.blue800;
      const textFont = colIndex >= 3 ? boldFont : font;
      
      if (isBalance) {
        const balanceValue = colIndex === 5 ? data.closingBalance.gold : data.closingBalance.kwd;
        textColor = balanceValue >= 0 ? COLORS.blue700 : COLORS.red700;
      }

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
    this.drawRowGrid(page, rowTop, ROW_HEIGHT, colWidths, {} as LedgerEntry);

    return startY - ROW_HEIGHT;
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number): void {
    const { font } = this.getFonts();
    const footerY = MARGIN + 10;
    
    // Footer background
    page.drawRectangle({
      x: MARGIN + 20,
      y: MARGIN,
      width: this.pageConfig.contentWidth - 40,
      height: FOOTER_HEIGHT,
      color: COLORS.blue800,
    });

    const footerText = `© 2025 Bloudan Jewellery | All Rights Reserved | Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.white,
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
    console.log("Starting PDF generation with blue theme...");
    
    const data: PdfRequestData = req.body;

    // Validate required data
    if (!data.account) {
      return res.status(400).json({ success: false, error: "Account data is required" });
    }

    if (!data.ledgerEntries) {
      return res.status(400).json({ success: false, error: "Ledger entries are required" });
    }

    console.log(`Generating PDF for account: ${data.account.accountNo}, entries: ${data.ledgerEntries.length}, Project Account: ${data.isProjectAccount}`);

    // Generate PDF with correct account type handling
    const generator = new PDFGenerator(data.isProjectAccount);
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("PDF generated successfully with blue theme");

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