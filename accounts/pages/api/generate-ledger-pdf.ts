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
}

interface Account {
  id: string;
  accountNo: string;
  name: string;
  type: string;
  phone: string;
  crOrCivilIdNo: string;
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
  isProjectAccount?: boolean;
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
    .replace(/^Receipt - /, '')
    .replace(/^Gold Form Voucher - /, '')
    .replace(/^Alloy - /, '');
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 30;

// Updated Colors to match page theme
const COLORS = {
  // Blue theme colors
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
  
  // Supporting colors
  indigo100: rgb(224 / 255, 231 / 255, 255 / 255),
  indigo600: rgb(79 / 255, 70 / 255, 229 / 255),
  indigo700: rgb(67 / 255, 56 / 255, 202 / 255),
  indigo800: rgb(55 / 255, 48 / 255, 163 / 255),
  
  // Status colors
  red100: rgb(254 / 255, 226 / 255, 226 / 255),
  red600: rgb(220 / 255, 38 / 255, 38 / 255),
  red700: rgb(185 / 255, 28 / 255, 28 / 255),
  
  green100: rgb(220 / 255, 252 / 255, 231 / 255),
  green600: rgb(22 / 255, 163 / 255, 74 / 255),
  green700: rgb(21 / 255, 128 / 255, 61 / 255),
  
  yellow100: rgb(254 / 255, 249 / 255, 195 / 255),
  yellow600: rgb(202 / 255, 138 / 255, 4 / 255),
  
  purple100: rgb(243 / 255, 232 / 255, 255 / 255),
  purple600: rgb(147 / 255, 51 / 255, 234 / 255),
  
  white: rgb(1, 1, 1),
  gray200: rgb(229 / 255, 231 / 255, 235 / 255),
  gray300: rgb(209 / 255, 213 / 255, 219 / 255),
  gray600: rgb(75 / 255, 85 / 255, 99 / 255),
  gray700: rgb(55 / 255, 65 / 255, 81 / 255),
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
    
    // Blue gradient background effect
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageConfig.width,
      height: this.pageConfig.height,
      color: COLORS.blue50,
    });

    // Main container with border matching page
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

  private getVoucherTypeColor(vt: string): any {
    switch (vt) {
      case 'INV': return COLORS.green600;  // Invoice - Green
      case 'REC': return COLORS.red600;    // Receipt - Red
      case 'GFV': return COLORS.yellow600; // Gold Form Voucher - Yellow
      case 'Alloy': return COLORS.purple600; // Alloy - Purple
      case 'BAL': return COLORS.blue600;   // Balance - Blue
      default: return COLORS.gray700;
    }
  }

  private getVoucherTypeBackground(vt: string): any {
    switch (vt) {
      case 'INV': return COLORS.green100;
      case 'REC': return COLORS.red100;
      case 'GFV': return COLORS.yellow100;
      case 'Alloy': return COLORS.purple100;
      case 'BAL': return COLORS.blue100;
      default: return COLORS.gray200;
    }
  }

  private drawPageHeader(page: PDFPage, data: PdfRequestData, pageNumber: number, totalPages: number): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 30;

    // Header with gradient effect
    page.drawText("BLOUDAN JEWELLERY", {
      x: MARGIN + 20,
      y: currentY,
      size: 24,
      font: boldFont,
      color: COLORS.blue800,
    });

    page.drawText("Account Ledger Statement", {
      x: MARGIN + 20,
      y: currentY - 30,
      size: 18,
      font: boldFont,
      color: COLORS.blue600,
    });

    currentY -= 70;

    // Account Information Card (matching page design)
    const accountBoxHeight = 45;
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - accountBoxHeight,
      width: this.pageConfig.contentWidth - 40,
      height: accountBoxHeight,
      color: COLORS.blue100,
      borderColor: COLORS.blue300,
      borderWidth: 1.5,
      borderDashArray: [3, 2],
    });

    // Account details in a grid layout
    const accountLines = [
      `Account No: ${data.account.accountNo}`,
      `Name: ${data.account.name}`,
      `Type: ${data.account.type}`,
      `Phone: ${data.account.phone || 'N/A'}`,
      `CR/ID: ${data.account.crOrCivilIdNo || 'N/A'}`
    ];

    // Distribute account info across multiple lines if needed
    page.drawText(accountLines[0], {
      x: MARGIN + 35,
      y: currentY - 25,
      size: 10,
      font: boldFont,
      color: COLORS.blue800,
    });

    page.drawText(accountLines.slice(1).join(' | '), {
      x: MARGIN + 35,
      y: currentY - 40,
      size: 9,
      font: font,
      color: COLORS.blue700,
    });

    currentY -= 70;

    // Date Range and Page Info
    const startDate = data.dateRange.start ? new Date(data.dateRange.start).toLocaleDateString() : 'Beginning';
    const endDate = data.dateRange.end ? new Date(data.dateRange.end).toLocaleDateString() : 'Present';
    
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 12,
      font: boldFont,
      color: COLORS.blue800,
    });

    // Current balances on right side
    const goldBalanceText = `Current Gold: ${formatBalance(data.closingBalance.gold)}`;
    page.drawText(goldBalanceText, {
      x: this.pageConfig.width - MARGIN - 20 - font.widthOfTextAtSize(goldBalanceText, 10),
      y: currentY,
      size: 10,
      font: font,
      color: data.closingBalance.gold >= 0 ? COLORS.blue700 : COLORS.red700,
    });

    if (!data.isProjectAccount) {
      const kwdBalanceText = `Current Amount: ${formatBalance(data.closingBalance.kwd)} KWD`;
      page.drawText(kwdBalanceText, {
        x: this.pageConfig.width - MARGIN - 20 - font.widthOfTextAtSize(kwdBalanceText, 10),
        y: currentY - 15,
        size: 10,
        font: font,
        color: data.closingBalance.kwd >= 0 ? COLORS.blue700 : COLORS.red700,
      });
    }

    // Page number
    const pageInfo = `Page ${pageNumber} of ${totalPages}`;
    page.drawText(pageInfo, {
      x: this.pageConfig.width - MARGIN - 20 - boldFont.widthOfTextAtSize(pageInfo, 10),
      y: currentY - 30,
      size: 10,
      font: boldFont,
      color: COLORS.blue800,
    });

    currentY -= 35;

    // Ledger Table Header
    page.drawText("Transaction History", {
      x: MARGIN + 20,
      y: currentY,
      size: 14,
      font: boldFont,
      color: COLORS.blue800,
    });

    return currentY - 25;
  }

  private drawTableHeader(page: PDFPage, tableTop: number, isProjectAccount: boolean): { tableTop: number; colWidths: number[] } {
    const { boldFont } = this.getFonts();
    const tableWidth = this.pageConfig.contentWidth - 40;
    
    // Column widths - adjust based on project account
    let colWidths = isProjectAccount ? 
      // Project accounts don't show amount columns
      [50, 40, 270, 70, 70, 90] : // Date, Type, Description, G Debit, G Credit, G Balance
      // Regular accounts show all columns
      [50, 40, 200, 60, 60, 75, 60, 60, 75]; // Total: 675
    
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
      borderDashArray: [1, 0],
    });

    // Table header background
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: COLORS.blue100,
    });

    // Calculate positions
    let xPos = MARGIN + 20;
    
    if (isProjectAccount) {
      // For project accounts: simpler structure
      const firstThreeColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2];
      const goldGroupStartX = xPos + firstThreeColumnsWidth;
      const goldGroupWidth = colWidths[3] + colWidths[4] + colWidths[5];
      
      // Gold group header
      page.drawRectangle({
        x: goldGroupStartX,
        y: tableTop - 20,
        width: goldGroupWidth,
        height: 20,
        color: COLORS.blue800,
      });

      // Vertical lines for project account table
      xPos = MARGIN + 20;
      for (let col = 0; col <= 3; col++) {
        page.drawLine({
          start: { x: xPos, y: tableTop },
          end: { x: xPos, y: tableTop - HEADER_HEIGHT },
          color: COLORS.blue300,
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
        color: COLORS.blue300,
        thickness: 0.5,
      });

      for (let i = 0; i <= 3; i++) {
        if (i < 3) {
          page.drawLine({
            start: { x: groupXPos + colWidths[3 + i], y: tableTop - 20 },
            end: { x: groupXPos + colWidths[3 + i], y: tableTop - HEADER_HEIGHT },
            color: COLORS.blue300,
            thickness: 0.5,
          });
        }
        if (i < 3) groupXPos += colWidths[3 + i];
      }

      // Rightmost border
      const tableRightEdge = MARGIN + 20 + tableWidth;
      page.drawLine({
        start: { x: tableRightEdge, y: tableTop },
        end: { x: tableRightEdge, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      // Horizontal lines
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

      // Column headers for project accounts
      xPos = MARGIN + 20;
      const projectHeaders = ["Date", "Type", "Description", "Debit", "Credit", "Balance"];
      
      projectHeaders.forEach((header, index) => {
        const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
        const textY = index >= 3 ? tableTop - 34 : tableTop - 24;
        const textSize = index >= 3 ? 8 : 9;
        const textColor = index >= 3 ? COLORS.blue800 : COLORS.blue800;
        
        page.drawText(header, {
          x: textX,
          y: textY,
          size: textSize,
          font: boldFont,
          color: textColor,
        });
        
        xPos += colWidths[index];
      });

      // Gold group header text
      page.drawText("GOLD (g)", {
        x: goldGroupStartX + (goldGroupWidth - boldFont.widthOfTextAtSize("GOLD (g)", 10)) / 2,
        y: tableTop - 12,
        size: 10,
        font: boldFont,
        color: COLORS.white,
      });

    } else {
      // Original structure for regular accounts
      const firstThreeColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2];
      const goldGroupStartX = xPos + firstThreeColumnsWidth;
      const goldGroupWidth = colWidths[3] + colWidths[4] + colWidths[5];
      const amountGroupStartX = goldGroupStartX + goldGroupWidth;
      const amountGroupWidth = colWidths[6] + colWidths[7] + colWidths[8];

      // Gold and Amount group headers
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
        color: COLORS.indigo800,
      });

      // Vertical lines (same as before but with blue colors)
      xPos = MARGIN + 20;
      for (let col = 0; col <= 3; col++) {
        page.drawLine({
          start: { x: xPos, y: tableTop },
          end: { x: xPos, y: tableTop - HEADER_HEIGHT },
          color: COLORS.blue300,
          thickness: 0.5,
        });
        if (col < 3) {
          xPos += colWidths[col];
        }
      }

      // Gold group lines
      let groupXPos = goldGroupStartX;
      page.drawLine({
        start: { x: groupXPos, y: tableTop },
        end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      page.drawLine({
        start: { x: groupXPos + colWidths[3], y: tableTop - 20 },
        end: { x: groupXPos + colWidths[3], y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });
      
      page.drawLine({
        start: { x: groupXPos + colWidths[3] + colWidths[4], y: tableTop - 20 },
        end: { x: groupXPos + colWidths[3] + colWidths[4], y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      page.drawLine({
        start: { x: groupXPos + goldGroupWidth, y: tableTop },
        end: { x: groupXPos + goldGroupWidth, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      // Amount group lines
      groupXPos = amountGroupStartX;
      page.drawLine({
        start: { x: groupXPos, y: tableTop },
        end: { x: groupXPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      page.drawLine({
        start: { x: groupXPos + colWidths[6], y: tableTop - 20 },
        end: { x: groupXPos + colWidths[6], y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });
      
      page.drawLine({
        start: { x: groupXPos + colWidths[6] + colWidths[7], y: tableTop - 20 },
        end: { x: groupXPos + colWidths[6] + colWidths[7], y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      page.drawLine({
        start: { x: groupXPos + amountGroupWidth, y: tableTop },
        end: { x: groupXPos + amountGroupWidth, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      // Rightmost border
      const tableRightEdge = MARGIN + 20 + tableWidth;
      page.drawLine({
        start: { x: tableRightEdge, y: tableTop },
        end: { x: tableRightEdge, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });

      // Horizontal lines
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

      // Column headers
      xPos = MARGIN + 20;
      const firstThreeHeaders = ["Date", "Type", "Description"];
      
      firstThreeHeaders.forEach((header, index) => {
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

      // Gold section headers
      const goldHeaders = ["Debit", "Credit", "Balance"];
      xPos = goldGroupStartX;
      goldHeaders.forEach((header, index) => {
        const colIndex = 3 + index;
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

      // Amount section headers
      const amountHeaders = ["Debit", "Credit", "Balance"];
      xPos = amountGroupStartX;
      amountHeaders.forEach((header, index) => {
        const colIndex = 6 + index;
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

      // Group header text
      page.drawText("GOLD (g)", {
        x: goldGroupStartX + (goldGroupWidth - boldFont.widthOfTextAtSize("GOLD (g)", 10)) / 2,
        y: tableTop - 12,
        size: 10,
        font: boldFont,
        color: COLORS.white,
      });

      page.drawText("AMOUNT (KWD)", {
        x: amountGroupStartX + (amountGroupWidth - boldFont.widthOfTextAtSize("AMOUNT (KWD)", 10)) / 2,
        y: tableTop - 12,
        size: 10,
        font: boldFont,
        color: COLORS.white,
      });
    }

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

  private drawTableRows(page: PDFPage, entries: LedgerEntry[], startY: number, colWidths: number[], isProjectAccount: boolean): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10;
    let currentY = startY - ROW_OFFSET;

    // Draw rows
    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background - matching page zebra striping
      let rowBgColor;
      if (entry.isOpeningBalance) {
        rowBgColor = COLORS.blue50;
      } else if (entry.isClosingBalance) {
        rowBgColor = COLORS.indigo100;
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

      // Row data
      const displayDate = entry.isOpeningBalance || entry.isClosingBalance 
        ? new Date(entry.date).toLocaleDateString() 
        : (entry.date || '').split('/').slice(0, 2).join('/');

      const cleanedDescription = cleanDescription(
        entry.description || '',
        entry.isOpeningBalance,
        entry.isClosingBalance
      );

      // Get voucher type color
      const typeColor = this.getVoucherTypeColor(entry.type);
      const typeText = entry.isOpeningBalance || entry.isClosingBalance 
        ? 'BAL' 
        : (entry.type === 'INV' ? 'Invoice' : 
           entry.type === 'REC' ? 'Receipt' : 
           entry.type === 'GFV' ? 'Gold Form' : 
           entry.type === 'Alloy' ? 'Alloy' : entry.type);

      // Prepare row data based on account type
      const rowData = isProjectAccount ? [
        displayDate,
        typeText,
        cleanedDescription.substring(0, 50) + (cleanedDescription.length > 50 ? '...' : ''),
        entry.goldDebit > 0 ? (entry.goldDebit || 0).toFixed(3) : '-',
        entry.goldCredit > 0 ? (entry.goldCredit || 0).toFixed(3) : '-',
        formatBalance(entry.goldBalance || 0)
      ] : [
        displayDate,
        typeText,
        cleanedDescription.substring(0, 40) + (cleanedDescription.length > 40 ? '...' : ''),
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
        const isLeftAligned = colIndex === 2; // Description is left-aligned
        const isTypeColumn = colIndex === 1; // Type column
        const isBalanceColumn = isProjectAccount ? colIndex === 5 : (colIndex === 5 || colIndex === 8);
        
        let textColor = COLORS.blue700;
        if (isTypeColumn) {
          textColor = typeColor;
        } else if (isBalanceColumn) {
          const balance = isProjectAccount ? entry.goldBalance : (colIndex === 5 ? entry.goldBalance : entry.kwdBalance);
          textColor = balance >= 0 ? COLORS.blue700 : COLORS.red700;
        }
        
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

  private drawTotalsRow(page: PDFPage, data: PdfRequestData, startY: number, colWidths: number[], isProjectAccount: boolean): number {
    const { font, boldFont } = this.getFonts();
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowTop = startY + ROW_HEIGHT / 2;
    
    // Totals row background - matching page footer
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
    const totalsRowData = isProjectAccount ? [
      "Totals", "", "",
      data.totals.goldDebit.toFixed(3),
      data.totals.goldCredit.toFixed(3),
      formatBalance(data.closingBalance.gold)
    ] : [
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
      const isBalanceColumn = isProjectAccount ? colIndex === 5 : (colIndex === 5 || colIndex === 8);
      
      let textColor = COLORS.blue800;
      if (isBalanceColumn) {
        const balance = isProjectAccount ? data.closingBalance.gold : (colIndex === 5 ? data.closingBalance.gold : data.closingBalance.kwd);
        textColor = balance >= 0 ? COLORS.blue800 : COLORS.red800;
      }
      
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
    const footerText = `© 2025 Bloudan Jewellery | All Rights Reserved | Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray700,
    });
  }

  async generatePDF(data: PdfRequestData): Promise<Uint8Array> {
    await this.initialize();
    const pdfDoc = this.getPDFDoc();
    
    const allEntries = data.ledgerEntries;
    const totalPages = Math.ceil(allEntries.length / this.pageConfig.maxRowsPerPage);
    const isProjectAccount = data.isProjectAccount || false;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = this.createNewPage();
      const startIdx = (pageNum - 1) * this.pageConfig.maxRowsPerPage;
      const endIdx = Math.min(startIdx + this.pageConfig.maxRowsPerPage, allEntries.length);
      const pageEntries = allEntries.slice(startIdx, endIdx);
      const isLastPage = pageNum === totalPages;

      // Draw page header
      const tableTop = this.drawPageHeader(page, data, pageNum, totalPages);
      
      // Draw table header
      const { tableTop: rowsStartY, colWidths } = this.drawTableHeader(page, tableTop, isProjectAccount);
      
      // Draw table rows
      let currentY = this.drawTableRows(page, pageEntries, rowsStartY, colWidths, isProjectAccount);
      
      // Draw totals row only on last page
      if (isLastPage) {
        currentY = this.drawTotalsRow(page, data, currentY, colWidths, isProjectAccount);
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