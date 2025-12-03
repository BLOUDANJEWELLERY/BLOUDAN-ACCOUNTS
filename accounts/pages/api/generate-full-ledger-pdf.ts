// pages/api/generate-full-ledger-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface AccountInfo {
  id: string;
  name: string;
  accountNo: number;
  type: string;
}

interface LedgerEntry {
  date: string;
  voucherId: string;
  accountId: string;
  accountName: string;
  accountNo: number;
  type: "INV" | "REC" | "GFV" | "Alloy" | "BAL";
  description: string;
  quantity?: number;
  goldDebit: number;
  goldCredit: number;
  goldBalance: number;
  kwdDebit: number;
  kwdCredit: number;
  kwdBalance: number;
  isOpeningBalance?: boolean;
  isClosingBalance?: boolean;
}

interface FullLedgerPdfRequestData {
  accountType: string;
  accounts: AccountInfo[];
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
  isProjectAccount: boolean;
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
  grayLight: rgb(209 / 255, 213 / 255, 219 / 255),
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

class FullLedgerPDFGenerator {
  private pdfDoc: PDFDocument | null = null;
  private font: PDFFont | null = null;
  private boldFont: PDFFont | null = null;
  private pageConfig: PageConfig;
  private isInitialized: boolean = false;
  private isProjectAccount: boolean = false;
  private accountType: string = "";

  constructor(isProjectAccount: boolean = false, accountType: string = "") {
    this.pageConfig = this.calculatePageConfig();
    this.isProjectAccount = isProjectAccount;
    this.accountType = accountType;
  }

  private calculatePageConfig(): PageConfig {
    const width = A4_LANDSCAPE_WIDTH;
    const height = A4_LANDSCAPE_HEIGHT;
    const contentWidth = width - (MARGIN * 2);
    const contentHeight = height - (MARGIN * 2);
    
    // Calculate available space for table
    const headerSectionHeight = 120; // Reduced header height
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
      throw new Error("FullLedgerPDFGenerator not initialized. Call initialize() first.");
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
    
    // Background with gradient effect
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pageConfig.width,
      height: this.pageConfig.height,
      color: COLORS.blue50,
    });

    // Main container
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
    data: FullLedgerPdfRequestData, 
    pageNumber: number, 
    totalPages: number
  ): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 20;

    // Main Title
    page.drawText("Bloudan Jewellery", {
      x: MARGIN + 20,
      y: currentY,
      size: 22,
      font: boldFont,
      color: COLORS.blue800,
    });

    page.drawText("Combined Ledger Statement", {
      x: MARGIN + 20,
      y: currentY - 28,
      size: 18,
      font: boldFont,
      color: COLORS.blue700,
    });

    currentY -= 55;

    // Account Type and Summary
    page.drawText(`${this.accountType} Accounts Combined Ledger`, {
      x: MARGIN + 20,
      y: currentY,
      size: 14,
      font: boldFont,
      color: COLORS.blue800,
    });

    currentY -= 25;

    // Date Range
    const startDate = data.dateRange.start ? formatDate(data.dateRange.start) : 'Beginning';
    const endDate = data.dateRange.end ? formatDate(data.dateRange.end) : 'Present';
    const periodInfo = `Period: ${startDate} to ${endDate}`;
    
    page.drawText(periodInfo, {
      x: MARGIN + 20,
      y: currentY,
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
      color: COLORS.blue700,
    });

    currentY -= 25;

    // Accounts Summary
    const accountCount = data.accounts.length;
    const accountInfo = `${accountCount} Account${accountCount !== 1 ? 's' : ''} | ${data.ledgerEntries.length} Total Transactions`;
    
    page.drawText(accountInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 11,
      font: boldFont,
      color: COLORS.blue600,
    });

    return currentY - 20;
  }

  private calculateColumnWidths(tableWidth: number): number[] {
    if (this.isProjectAccount) {
      // Project accounts: Date, Account, Type, Description, Gold Debit, Gold Credit, Gold Balance
      const baseWidths = [60, 90, 40, 200, 70, 70, 100]; // Total: 630
      const currentTotal = baseWidths.reduce((a, b) => a + b, 0);
      const missing = tableWidth - currentTotal;
      
      if (missing > 0) {
        const extraPerColumn = missing / baseWidths.length;
        return baseWidths.map(w => w + extraPerColumn);
      }
      return baseWidths;
    } else {
      // Non-project accounts: Date, Account, Type, Description, Gold Debit, Gold Credit, Gold Balance, Amount Debit, Amount Credit, Amount Balance
      const baseWidths = [55, 85, 35, 150, 60, 60, 85, 60, 60, 85]; // Total: 735
      const currentTotal = baseWidths.reduce((a, b) => a + b, 0);
      const missing = tableWidth - currentTotal;
      
      if (missing > 0) {
        const extraPerColumn = missing / baseWidths.length;
        return baseWidths.map(w => w + extraPerColumn);
      }
      return baseWidths;
    }
  }

  private drawTableHeader(page: PDFPage, tableTop: number): { tableTop: number; colWidths: number[] } {
    const { boldFont } = this.getFonts();
    const tableWidth = this.pageConfig.contentWidth - 40;
    const colWidths = this.calculateColumnWidths(tableWidth);
    
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

    // Draw vertical lines
    let xPos = MARGIN + 20;
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
      start: { x: MARGIN + 20, y: tableTop - 20 },
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
    const headers = this.isProjectAccount 
      ? ["Date", "Account", "Type", "Description", "Gold Debit", "Gold Credit", "Gold Balance"]
      : ["Date", "Account", "Type", "Description", "Gold Debit", "Gold Credit", "Gold Balance", "Amount Debit", "Amount Credit", "Amount Balance"];
    
    xPos = MARGIN + 20;
    headers.forEach((header, index) => {
      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
      const isGoldColumn = this.isProjectAccount 
        ? index >= 4 && index <= 6
        : index >= 4 && index <= 9;
      
      const isAmountColumn = !this.isProjectAccount && index >= 7 && index <= 9;
      
      let columnHeader = header;
      if (isGoldColumn && header.startsWith("Gold")) {
        columnHeader = header.replace("Gold ", "");
      } else if (isAmountColumn && header.startsWith("Amount")) {
        columnHeader = header.replace("Amount ", "");
      }
      
      page.drawText(columnHeader, {
        x: textX,
        y: tableTop - 14,
        size: 9,
        font: boldFont,
        color: COLORS.blue800,
      });
      
      // Draw group headers for Gold and Amount
      if (index === 4 && !this.isProjectAccount) {
        // Gold group header
        const goldGroupWidth = colWidths[4] + colWidths[5] + colWidths[6];
        page.drawRectangle({
          x: xPos,
          y: tableTop - 20,
          width: goldGroupWidth,
          height: 20,
          color: COLORS.blue800,
        });
        
        page.drawText("GOLD", {
          x: xPos + (goldGroupWidth - boldFont.widthOfTextAtSize("GOLD", 10)) / 2,
          y: tableTop - 12,
          size: 10,
          font: boldFont,
          color: COLORS.white,
        });
      } else if (index === 7 && !this.isProjectAccount) {
        // Amount group header
        const amountGroupWidth = colWidths[7] + colWidths[8] + colWidths[9];
        page.drawRectangle({
          x: xPos,
          y: tableTop - 20,
          width: amountGroupWidth,
          height: 20,
          color: COLORS.blue800,
        });
        
        page.drawText("AMOUNT (KWD)", {
          x: xPos + (amountGroupWidth - boldFont.widthOfTextAtSize("AMOUNT (KWD)", 10)) / 2,
          y: tableTop - 12,
          size: 10,
          font: boldFont,
          color: COLORS.white,
        });
      }
      
      xPos += colWidths[index];
    });

    return { tableTop: tableTop - HEADER_HEIGHT, colWidths };
  }

  private getVoucherTypeColor(type: string): any {
    switch (type) {
      case 'INV': return COLORS.green;
      case 'REC': return COLORS.red;
      case 'GFV': return COLORS.yellow;
      case 'Alloy': return COLORS.purple;
      case 'BAL': return COLORS.blue700;
      default: return COLORS.blue700;
    }
  }

  private drawTableRows(
    page: PDFPage, 
    entries: LedgerEntry[], 
    startY: number, 
    colWidths: number[]
  ): number {
    const { font, boldFont } = this.getFonts();
    let currentY = startY;

    entries.forEach((entry, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background with alternating colors
      let rowBgColor;
      if (entry.isOpeningBalance || entry.isClosingBalance) {
        rowBgColor = entry.isOpeningBalance ? COLORS.blue50 : COLORS.blue100;
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
        ? formatDate(entry.date)
        : formatDate(entry.date);

      const accountDisplay = entry.isOpeningBalance || entry.isClosingBalance 
        ? `All ${this.accountType} Accounts`
        : `${entry.accountName} (#${entry.accountNo})`;

      const typeDisplay = entry.isOpeningBalance || entry.isClosingBalance 
        ? 'BAL' 
        : entry.type;

      // Format description with quantity
      let description = entry.description || '';
      if (entry.quantity && !entry.isOpeningBalance && !entry.isClosingBalance) {
        description = `${entry.quantity} - ${description}`;
      }

      // Truncate description if too long
      const maxDescLength = 40;
      if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
      }

      // Prepare all column values
      const rowData: string[] = [];
      
      // Date
      rowData.push(displayDate);
      
      // Account (truncate if needed)
      const maxAccountLength = 25;
      let accountText = accountDisplay;
      if (accountText.length > maxAccountLength) {
        accountText = accountText.substring(0, maxAccountLength - 3) + '...';
      }
      rowData.push(accountText);
      
      // Type
      rowData.push(typeDisplay);
      
      // Description
      rowData.push(description);
      
      // Gold Debit
      rowData.push(entry.goldDebit > 0 ? entry.goldDebit.toFixed(3) : '-');
      
      // Gold Credit
      rowData.push(entry.goldCredit > 0 ? entry.goldCredit.toFixed(3) : '-');
      
      // Gold Balance
      rowData.push(formatBalanceNoUnit(entry.goldBalance));
      
      // Amount columns (only for non-project accounts)
      if (!this.isProjectAccount) {
        rowData.push(entry.kwdDebit > 0 ? entry.kwdDebit.toFixed(3) : '-');
        rowData.push(entry.kwdCredit > 0 ? entry.kwdCredit.toFixed(3) : '-');
        rowData.push(formatBalanceNoUnit(entry.kwdBalance));
      }

      // Draw row text
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const isDescriptionCol = colIndex === 3;
        const isBalanceCol = colIndex === 6 || (!this.isProjectAccount && colIndex === 9);
        const isTypeCol = colIndex === 2;
        
        let textColor = COLORS.blue700;
        let textFont = font;
        let textSize = 8;

        // Special formatting
        if (entry.isOpeningBalance || entry.isClosingBalance) {
          textFont = boldFont;
          textColor = COLORS.blue800;
        } else if (isTypeCol && !isBalanceCol) {
          textColor = this.getVoucherTypeColor(entry.type);
        } else if (isBalanceCol) {
          textFont = boldFont;
          textColor = entry.goldBalance >= 0 ? COLORS.blue700 : COLORS.red;
        }

        // Alignment
        let textX;
        if (isDescriptionCol) {
          // Left align for description
          textX = xPos + 3;
        } else {
          // Center align for other columns
          textX = xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, textSize)) / 2;
        }

        // Special handling for account column (can be left aligned or centered)
        if (colIndex === 1) {
          // Center align account name
          textX = xPos + (colWidths[colIndex] - textFont.widthOfTextAtSize(data, textSize)) / 2;
        }

        page.drawText(data, {
          x: textX,
          y: currentY - 5,
          size: textSize,
          font: textFont,
          color: textColor,
        });

        xPos += colWidths[colIndex];
      });

      // Draw row grid
      this.drawRowGrid(page, rowTop, ROW_HEIGHT, colWidths);

      currentY -= ROW_HEIGHT;
    });

    return currentY;
  }

  private drawRowGrid(
    page: PDFPage, 
    rowTop: number, 
    rowHeight: number, 
    colWidths: number[]
  ): void {
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowBottom = rowTop - rowHeight;

    // Draw vertical lines
    let xPos = MARGIN + 20;
    for (let col = 0; col <= colWidths.length; col++) {
      page.drawLine({
        start: { x: xPos, y: rowTop },
        end: { x: xPos, y: rowBottom },
        color: COLORS.blue300,
        thickness: 0.3,
      });
      if (col < colWidths.length) {
        xPos += colWidths[col];
      }
    }

    // Draw bottom horizontal line
    page.drawLine({
      start: { x: MARGIN + 20, y: rowBottom },
      end: { x: MARGIN + 20 + tableWidth, y: rowBottom },
      color: COLORS.blue300,
      thickness: 0.3,
    });
  }

  private drawTotalsRow(
    page: PDFPage, 
    data: FullLedgerPdfRequestData, 
    startY: number, 
    colWidths: number[]
  ): number {
    const { font, boldFont } = this.getFonts();
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowTop = startY + ROW_HEIGHT / 2;
    const rowBottom = startY - ROW_HEIGHT / 2;

    // Totals row background
    let xPos = MARGIN + 20;
    colWidths.forEach(width => {
      page.drawRectangle({
        x: xPos,
        y: rowBottom,
        width: width,
        height: ROW_HEIGHT,
        color: COLORS.blue200,
      });
      xPos += width;
    });

    // Prepare totals data
    const totalsData: string[] = ['Totals', '', '', ''];
    
    // Gold totals
    totalsData.push(data.totals.goldDebit.toFixed(3));
    totalsData.push(data.totals.goldCredit.toFixed(3));
    totalsData.push(formatBalanceNoUnit(data.closingBalance.gold));
    
    // Amount totals (only for non-project accounts)
    if (!this.isProjectAccount) {
      totalsData.push(data.totals.kwdDebit.toFixed(3));
      totalsData.push(data.totals.kwdCredit.toFixed(3));
      totalsData.push(formatBalanceNoUnit(data.closingBalance.kwd));
    }

    // Draw totals text
    xPos = MARGIN + 20;
    totalsData.forEach((data, colIndex) => {
      let textX;
      if (colIndex === 0) {
        // Left align "Totals" text
        textX = xPos + 3;
      } else {
        // Center align numbers
        textX = xPos + (colWidths[colIndex] - boldFont.widthOfTextAtSize(data, 9)) / 2;
      }

      const isBalanceCol = colIndex === 6 || (!this.isProjectAccount && colIndex === 9);
      const textColor = isBalanceCol ? COLORS.blue900 : COLORS.blue800;

      page.drawText(data, {
        x: textX,
        y: startY - 5,
        size: 9,
        font: boldFont,
        color: textColor,
      });

      xPos += colWidths[colIndex];
    });

    // Draw totals row grid
    this.drawRowGrid(page, rowTop, ROW_HEIGHT, colWidths);

    // Add thicker bottom border
    page.drawLine({
      start: { x: MARGIN + 20, y: rowBottom },
      end: { x: MARGIN + 20 + tableWidth, y: rowBottom },
      color: COLORS.blue700,
      thickness: 1.5,
    });

    return startY - ROW_HEIGHT - 10; // Extra space after totals
  }

  private drawSummarySection(
    page: PDFPage, 
    data: FullLedgerPdfRequestData, 
    startY: number
  ): void {
    const { font, boldFont } = this.getFonts();
    let currentY = startY;

    // Summary box
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY - 70,
      width: this.pageConfig.contentWidth - 40,
      height: 70,
      borderColor: COLORS.blue400,
      borderWidth: 1.5,
      color: COLORS.blue50,
    });

    // Summary title
    page.drawText("Period Summary", {
      x: MARGIN + 30,
      y: currentY - 25,
      size: 12,
      font: boldFont,
      color: COLORS.blue800,
    });

    currentY -= 40;

    // Summary details
    const summaryItems = [
      { label: "Opening Gold Balance:", value: formatBalance(data.openingBalance.gold, 'gold') },
      { label: "Closing Gold Balance:", value: formatBalance(data.closingBalance.gold, 'gold') },
      { label: "Net Gold Change:", value: formatBalance(data.closingBalance.gold - data.openingBalance.gold, 'gold') },
    ];

    if (!this.isProjectAccount) {
      summaryItems.push(
        { label: "Opening Amount Balance:", value: formatBalance(data.openingBalance.kwd, 'kwd') },
        { label: "Closing Amount Balance:", value: formatBalance(data.closingBalance.kwd, 'kwd') },
        { label: "Net Amount Change:", value: formatBalance(data.closingBalance.kwd - data.openingBalance.kwd, 'kwd') }
      );
    }

    summaryItems.forEach((item, index) => {
      const rowY = currentY - (index * 13);
      
      page.drawText(item.label, {
        x: MARGIN + 30,
        y: rowY,
        size: 9,
        font: font,
        color: COLORS.blue700,
      });

      const valueX = this.pageConfig.width - MARGIN - 30 - boldFont.widthOfTextAtSize(item.value, 9);
      page.drawText(item.value, {
        x: valueX,
        y: rowY,
        size: 9,
        font: boldFont,
        color: COLORS.blue800,
      });
    });
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number): void {
    const { font } = this.getFonts();
    const footerY = MARGIN + 10;
    
    const footerText = `© 2025 Bloudan Jewellery | Generated: ${new Date().toLocaleDateString()} | Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
    });

    // Footer separator line
    page.drawLine({
      start: { x: MARGIN + 20, y: footerY + 15 },
      end: { x: this.pageConfig.width - MARGIN - 20, y: footerY + 15 },
      color: COLORS.blue300,
      thickness: 0.5,
    });
  }

  async generatePDF(data: FullLedgerPdfRequestData): Promise<Uint8Array> {
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
      
      // Draw totals row and summary only on last page
      if (isLastPage) {
        currentY = this.drawTotalsRow(page, data, currentY, colWidths);
        this.drawSummarySection(page, data, currentY);
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
    console.log("Starting Full Ledger PDF generation...");
    
    const data: FullLedgerPdfRequestData = req.body;

    // Validate required data
    if (!data.ledgerEntries || !data.accountType) {
      return res.status(400).json({ 
        success: false, 
        error: "Ledger entries and account type are required" 
      });
    }

    console.log(`Generating Full Ledger PDF for ${data.accountType} accounts`);
    console.log(`Total entries: ${data.ledgerEntries.length}, Is Project: ${data.isProjectAccount}`);
    console.log(`Accounts involved: ${data.accounts?.length || 0}`);

    // Generate PDF
    const generator = new FullLedgerPDFGenerator(data.isProjectAccount, data.accountType);
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("Full Ledger PDF generated successfully");

    return res.json({ 
      success: true, 
      pdfData: pdfBase64,
      message: `${data.accountType} Combined Ledger PDF generated successfully`,
      details: {
        accountType: data.accountType,
        accountsCount: data.accounts?.length || 0,
        transactionsCount: data.ledgerEntries.length,
        isProjectAccount: data.isProjectAccount,
        dateRange: data.dateRange
      }
    });

  } catch (err) {
    console.error("Full Ledger PDF generation failed:", err);
    
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: "Full Ledger PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}