// pages/api/generate-locker-ledger-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface LockerVoucher {
  id: string;
  date: string;
  mvn?: string;
  description?: string;
  vt: "INV" | "REC";
  accountId: string;
  account: {
    name: string;
    accountNo: number;
    type: string;
  };
  gold: number;
  kwd: number;
  paymentMethod?: string;
  goldRate?: number;
  fixingAmount?: number;
  lockerGoldChange: number;
  lockerGoldBalance: number;
  quantity?: number;
}

interface LockerLedgerPdfRequestData {
  accountType: string;
  dateRange: {
    start: string;
    end: string;
  };
  voucherData: {
    allVouchers: LockerVoucher[];
    filteredVouchers: LockerVoucher[];
    openingBalance: number;
    closingBalance: number;
    totals: {
      goldDebit: number;
      goldCredit: number;
      netChange: number;
    };
  };
}

// Helper function to format balance with Cr/Db
const formatBalance = (balance: number): string => {
  if (balance === undefined || balance === null) {
    return `0.000 g Cr`;
  }
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  return `${absoluteValue.toFixed(3)} g ${suffix}`;
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

// Helper function to get voucher type text
const getVoucherTypeText = (vt: string): string => {
  switch (vt) {
    case 'REC': return 'Receipt';
    case 'INV': return 'Invoice';
    default: return vt;
  }
};

// Helper function to check if voucher affects locker
const affectsLocker = (voucher: LockerVoucher): boolean => {
  return voucher.lockerGoldChange !== 0;
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
  purple: rgb(147 / 255, 51 / 255, 234 / 255),
  emerald: rgb(16 / 255, 185 / 255, 129 / 255)
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

class LockerLedgerPDFGenerator {
  private pdfDoc: PDFDocument | null = null;
  private font: PDFFont | null = null;
  private boldFont: PDFFont | null = null;
  private pageConfig: PageConfig;
  private isInitialized: boolean = false;
  private accountType: string = "";

  constructor(accountType: string = "") {
    this.pageConfig = this.calculatePageConfig();
    this.accountType = accountType;
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
      throw new Error("LockerLedgerPDFGenerator not initialized. Call initialize() first.");
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
    data: LockerLedgerPdfRequestData, 
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

    page.drawText("Locker Gold Ledger Statement", {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.blue700,
    });

    currentY -= 50;

    // Date Range
    const startDate = data.dateRange.start ? formatDate(data.dateRange.start) : 'Beginning';
    const endDate = data.dateRange.end ? formatDate(data.dateRange.end) : 'Present';
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 12,
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

    currentY -= 30;

    // Summary info
    const summaryInfo = `Total Transactions: ${data.voucherData.filteredVouchers.length} | Opening Balance: ${formatBalance(data.voucherData.openingBalance)} | Closing Balance: ${formatBalance(data.voucherData.closingBalance)}`;
    
    page.drawText(summaryInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 10,
      font: font,
      color: COLORS.blue700,
    });

    currentY -= 20;

    // Ledger Table Header
    page.drawText("Locker Gold Transaction History", {
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
    
    // Calculate column widths for locker ledger: Date, Account, Type, Description, Gold Debit, Gold Credit, Locker Balance
    const colWidths = [50, 80, 35, 150, 60, 60, 75];
    
    // Calculate missing width and distribute proportionally
    const currentTotal = colWidths.reduce((a, b) => a + b, 0);
    const missing = tableWidth - currentTotal;
    
    if (missing > 0) {
      const extraPerColumn = missing / colWidths.length;
      colWidths.forEach((w, i) => {
        if (i === 3) { // Give more to description column
          colWidths[i] = w + extraPerColumn * 1.5;
        } else {
          colWidths[i] = w + extraPerColumn * 0.8;
        }
      });
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

    // Table header background (full height for both header rows)
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: COLORS.blue100,
    });

    // Calculate positions for grouped headers
    let xPos = MARGIN + 20;
    
    // First four columns (Date, Account, Type, Description) span full header height
    const firstFourColumnsWidth = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
    
    // Gold group header (spans Gold Debit, Gold Credit, Gold Balance)
    const goldGroupStartX = xPos + firstFourColumnsWidth;
    const goldGroupWidth = colWidths[4] + colWidths[5] + colWidths[6];

    // Draw grouped header backgrounds (only for Gold section)
    page.drawRectangle({
      x: goldGroupStartX,
      y: tableTop - 20,
      width: goldGroupWidth,
      height: 20,
      color: COLORS.blue800,
    });

    // ========== SEGMENTED VERTICAL LINES ==========

    // Segment A: FULL-HEIGHT vertical lines for first four columns
    xPos = MARGIN + 20;
    const columnsToDraw = 4; // Date, Account, Type, Description
    
    for (let col = 0; col <= columnsToDraw; col++) {
      page.drawLine({
        start: { x: xPos, y: tableTop },
        end: { x: xPos, y: tableTop - HEADER_HEIGHT },
        color: COLORS.blue300,
        thickness: 0.5,
      });
      if (col < columnsToDraw) {
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
      start: { x: groupXPos + colWidths[4], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[4], y: tableTop - HEADER_HEIGHT },
      color: COLORS.blue300,
      thickness: 0.5,
    });
    
    page.drawLine({
      start: { x: groupXPos + colWidths[4] + colWidths[5], y: tableTop - 20 },
      end: { x: groupXPos + colWidths[4] + colWidths[5], y: tableTop - HEADER_HEIGHT },
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

    // First four column headers (Date, Account, Type, Description) - centered in full header height
    xPos = MARGIN + 20;
    const firstFourHeaders = ["Date", "Account", "Type", "Description"];
    
    firstFourHeaders.forEach((header, index) => {
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

    // Column header text for Gold sections (second row only) - All centered
    const goldHeaders = ["Debit", "Credit", "Balance"];
    
    // Gold section headers - All centered horizontally
    xPos = goldGroupStartX;
    goldHeaders.forEach((header, index) => {
      const colIndex = 4 + index;
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

  private drawTableRows(
    page: PDFPage, 
    entries: LockerVoucher[], 
    startY: number, 
    colWidths: number[], 
    openingBalance: number, 
    showOpeningBalance: boolean,
    dateRange: { start: string; end: string }
  ): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10;
    let currentY = startY - ROW_OFFSET;

    // Draw Opening Balance Row only if showOpeningBalance is true
    if (showOpeningBalance) {
      const openingRowTop = currentY + ROW_HEIGHT / 2;
      
      // Opening balance row background
      let xPos = MARGIN + 20;
      colWidths.forEach(width => {
        page.drawRectangle({
          x: xPos,
          y: currentY - ROW_HEIGHT / 2,
          width: width,
          height: ROW_HEIGHT,
          color: rgb(254 / 255, 243 / 255, 199 / 255), // Light yellow
        });
        xPos += width;
      });

      // Opening balance row data
      const openingRowData = [
        dateRange.start ? formatDate(dateRange.start) : "Beginning",
        "",
        "BAL",
        "Opening Locker Balance",
        "-",
        "-",
        formatBalanceNoUnit(openingBalance)
      ];

      // Draw opening balance text
      xPos = MARGIN + 20;
      openingRowData.forEach((data, colIndex) => {
        const isLeftAligned = colIndex === 3; // Description is left-aligned
        const isBalanceCol = colIndex === 6;
        const textColor = isBalanceCol ? COLORS.blue900 : COLORS.blue800;
        const textFont = isBalanceCol ? boldFont : font;
        
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

      // Draw opening balance row grid
      this.drawTableGrid(page, openingRowTop, ROW_HEIGHT, colWidths);
      currentY -= ROW_HEIGHT;
    }

    // Draw transaction rows
    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background
      const rowBgColor = !affectsLocker(entry) 
        ? rgb(0.95, 0.95, 0.95) // Light gray for non-affecting rows
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

      // Prepare row data
      const displayDate = formatDate(entry.date);
      const accountDisplay = `${entry.account.accountNo} - ${entry.account.name}`;
      const typeText = getVoucherTypeText(entry.vt);
      
      // Format description
      let description = entry.description || entry.mvn || '';
      if (entry.quantity) {
        description = `${entry.quantity} - ${description}`;
      }

      // Truncate description if too long
      const maxDescLength = 35;
      if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
      }

      // Get account type color
      const accountType = entry.account.type;
      let typeColor = COLORS.blue700;
      if (entry.vt === "REC") {
        if (accountType === "Market" && entry.paymentMethod === "cheque") {
          typeColor = COLORS.gray;
        } else {
          typeColor = COLORS.green;
        }
      } else if (entry.vt === "INV") {
        typeColor = COLORS.red;
      }

      // Prepare row data
      const rowData: string[] = [];
      
      // Date
      rowData.push(displayDate);
      
      // Account
      const accountShort = accountDisplay.substring(0, 15) + (accountDisplay.length > 15 ? '...' : '');
      rowData.push(accountShort);
      
      // Type
      rowData.push(typeText);
      
      // Description
      rowData.push(description);
      
      // Gold Debit
      const goldDebit = entry.lockerGoldChange < 0 ? Math.abs(entry.lockerGoldChange).toFixed(3) : '-';
      rowData.push(goldDebit);
      
      // Gold Credit
      const goldCredit = entry.lockerGoldChange > 0 ? entry.lockerGoldChange.toFixed(3) : '-';
      rowData.push(goldCredit);
      
      // Locker Balance
      rowData.push(formatBalanceNoUnit(entry.lockerGoldBalance));

      // Draw cell text - All centered except description
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const isLeftAligned = colIndex === 3; // Only description is left-aligned
        const isBalanceCol = colIndex === 6;
        const isTypeCol = colIndex === 2;
        const isDebitCol = colIndex === 4;
        const isCreditCol = colIndex === 5;
        
        let textColor = COLORS.blue700;
        let textFont = font;
        
        // Special formatting for voucher types
        if (isTypeCol) {
          textColor = typeColor;
        }
        
        // Special formatting for balance column
        if (isBalanceCol) {
          textFont = boldFont;
          textColor = entry.lockerGoldBalance >= 0 ? COLORS.blue800 : COLORS.red;
        }
        
        // Special formatting for debit/credit columns
        if (isDebitCol && data !== '-') {
          textColor = COLORS.red;
        }
        if (isCreditCol && data !== '-') {
          textColor = COLORS.green;
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

  private drawClosingBalanceAndTotals(
    page: PDFPage, 
    closingBalance: number, 
    totals: { goldDebit: number; goldCredit: number; netChange: number },
    startY: number, 
    colWidths: number[],
    dateRange: { start: string; end: string }
  ): number {
    const { font, boldFont } = this.getFonts();
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowTop = startY + ROW_HEIGHT / 2;
    
    // Closing Balance Row
    const closingRowTop = startY + ROW_HEIGHT / 2;
    
    // Closing balance row background
    let xPos = MARGIN + 20;
    colWidths.forEach(width => {
      page.drawRectangle({
        x: xPos,
        y: startY - ROW_HEIGHT / 2,
        width: width,
        height: ROW_HEIGHT,
        color: rgb(209 / 255, 250 / 255, 229 / 255), // Light emerald
      });
      xPos += width;
    });

    // Closing balance row data
    const closingRowData = [
      dateRange.end ? formatDate(dateRange.end) : "Present",
      "",
      "BAL",
      "Closing Locker Balance",
      "-",
      "-",
      formatBalanceNoUnit(closingBalance)
    ];

    // Draw closing balance text
    xPos = MARGIN + 20;
    closingRowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 3; // Description is left-aligned
      const isBalanceCol = colIndex === 6;
      const textColor = isBalanceCol ? COLORS.blue900 : COLORS.blue800;
      const textFont = isBalanceCol ? boldFont : font;
      
      const textX = isLeftAligned ? 
        xPos + 5 : 
        xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, 7)) / 2;
      
      page.drawText(data, {
        x: textX,
        y: startY - 3,
        size: 7,
        font: textFont,
        color: textColor,
      });
      
      xPos += colWidths[colIndex];
    });

    // Draw closing balance row grid
    this.drawTableGrid(page, closingRowTop, ROW_HEIGHT, colWidths);
    let currentY = startY - ROW_HEIGHT;

    // Totals Row
    const totalsRowTop = currentY + ROW_HEIGHT / 2;
    
    // Totals row background
    xPos = MARGIN + 20;
    colWidths.forEach(width => {
      page.drawRectangle({
        x: xPos,
        y: currentY - ROW_HEIGHT / 2,
        width: width,
        height: ROW_HEIGHT,
        color: COLORS.blue100,
      });
      xPos += width;
    });

    // Prepare totals data
    const totalsRowData = ["Totals", "", "", "", totals.goldDebit.toFixed(3), totals.goldCredit.toFixed(3), formatBalanceNoUnit(closingBalance)];
    
    // Draw totals text
    xPos = MARGIN + 20;
    totalsRowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 3;
      const isBalanceCol = colIndex === 6;
      const isDebitCol = colIndex === 4;
      const isCreditCol = colIndex === 5;
      
      let textColor = COLORS.blue800;
      const textFont = colIndex >= 4 ? boldFont : font;
      
      if (isBalanceCol) {
        textColor = COLORS.blue900;
      } else if (isDebitCol) {
        textColor = COLORS.red;
      } else if (isCreditCol) {
        textColor = COLORS.green;
      }
      
      const textX = isLeftAligned ? 
        xPos + 5 : 
        xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, 8)) / 2;
      
      page.drawText(data, {
        x: textX,
        y: currentY - 3,
        size: 8,
        font: textFont,
        color: textColor,
      });
      
      xPos += colWidths[colIndex];
    });

    // Draw totals row grid
    this.drawTableGrid(page, totalsRowTop, ROW_HEIGHT, colWidths);

    return currentY - ROW_HEIGHT;
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number): void {
    const { font } = this.getFonts();
    const footerY = MARGIN + 10;
    const footerText = `Generated by Bloudan Jewellery - Locker Gold Ledger System - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
    });
  }

  async generatePDF(data: LockerLedgerPdfRequestData): Promise<Uint8Array> {
    await this.initialize();
    const pdfDoc = this.getPDFDoc();
    
    const allEntries = data.voucherData.filteredVouchers;
    const totalPages = Math.ceil((allEntries.length + 2) / this.pageConfig.maxRowsPerPage); // +2 for opening/closing balance rows

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = this.createNewPage();
      const entriesPerPage = this.pageConfig.maxRowsPerPage - (pageNum === 1 ? 1 : 0) - (pageNum === totalPages ? 1 : 0);
      const startIdx = (pageNum - 1) * entriesPerPage;
      const endIdx = Math.min(startIdx + entriesPerPage, allEntries.length);
      const pageEntries = allEntries.slice(startIdx, endIdx);
      const isFirstPage = pageNum === 1;
      const isLastPage = pageNum === totalPages;

      // Draw page header
      const tableTop = this.drawPageHeader(page, data, pageNum, totalPages);
      
      // Draw table header
      const { tableTop: rowsStartY, colWidths } = this.drawTableHeader(page, tableTop);
      
      let currentY = rowsStartY;
      
      // Draw opening balance only on first page
      if (isFirstPage) {
        currentY = this.drawTableRows(page, pageEntries, rowsStartY, colWidths, data.voucherData.openingBalance, isFirstPage, data.dateRange);
      } else {
        currentY = this.drawTableRows(page, pageEntries, rowsStartY, colWidths, 0, isFirstPage, data.dateRange);
      }
      
      // Draw closing balance and totals only on last page
      if (isLastPage) {
        currentY = this.drawClosingBalanceAndTotals(
          page, 
          data.voucherData.closingBalance, 
          data.voucherData.totals, 
          currentY, 
          colWidths,
          data.dateRange
        );
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
    console.log("Starting Locker Ledger PDF generation...");
    
    const data: LockerLedgerPdfRequestData = req.body;

    // Validate required data
    if (!data.voucherData || !data.voucherData.filteredVouchers) {
      return res.status(400).json({ success: false, error: "Voucher data is required" });
    }

    console.log(`Generating Locker Ledger PDF`);
    console.log(`Total entries: ${data.voucherData.filteredVouchers.length}`);
    console.log(`Opening Balance: ${data.voucherData.openingBalance}, Closing Balance: ${data.voucherData.closingBalance}`);

    // Generate PDF
    const generator = new LockerLedgerPDFGenerator(data.accountType);
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("Locker Ledger PDF generated successfully");

    return res.json({ 
      success: true, 
      pdfData: pdfBase64,
      message: `Locker Gold Ledger PDF generated successfully` 
    });

  } catch (err) {
    console.error("Locker Ledger PDF generation failed:", err);
    
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: "Locker Ledger PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}