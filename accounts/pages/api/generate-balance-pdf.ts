// pages/api/generate-balances-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface Account {
  id: string;
  accountNo: string;
  name: string;
  phone: string;
  cr: string;
}

interface AccountBalance {
  account: Account;
  goldBalance: number;
  kwdBalance: number;
  lastTransactionDate: string | null;
  voucherCount: number;
}

interface BalancesPdfRequestData {
  accountBalances: AccountBalance[];
  totals: {
    totalGoldBalance: number;
    totalKWDBalance: number;
    totalAccounts: number;
    accountsWithDebt: number;
    accountsWithCredit: number;
  };
  generatedAt: string;
}

// Helper function to format balance
const formatBalance = (balance: number, type: 'gold' | 'kwd'): string => {
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  const unit = type === 'gold' ? 'g' : 'KWD';
  
  return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 25;
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

class BalancesPDFGenerator {
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
    
    // Calculate available space for table
    const headerSectionHeight = 120; // Reduced for balances report
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
      throw new Error("BalancesPDFGenerator not initialized. Call initialize() first.");
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

  private drawPageHeader(page: PDFPage, data: BalancesPdfRequestData, pageNumber: number, totalPages: number): number {
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

    page.drawText("Account Balances Summary", {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.emerald700,
    });

    currentY -= 50;

    // Summary Information
    const summaryText = `Total Accounts: ${data.totals.totalAccounts} | Accounts with Debt: ${data.totals.accountsWithDebt} | Accounts with Credit: ${data.totals.accountsWithCredit}`;
    page.drawText(summaryText, {
      x: MARGIN + 20,
      y: currentY,
      size: 10,
      font: font,
      color: COLORS.emerald700,
    });

    currentY -= 20;

    // Date and Page Info
    const dateInfo = `Generated on: ${data.generatedAt} | Page ${pageNumber} of ${totalPages}`;
    page.drawText(dateInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 9,
      font: font,
      color: COLORS.emerald800,
    });

    currentY -= 30;

    // Table Title
    page.drawText("Account Balances Overview", {
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
    
    // 7 columns for balances summary
    let colWidths = [80, 150, 80, 80, 100, 100, 80]; // Account No, Name, Phone, CR No, Gold Balance, KWD Balance, Transactions
    
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

    // Table header background
    page.drawRectangle({
      x: MARGIN + 20,
      y: tableTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: COLORS.emerald100,
    });

    // Draw vertical lines
    this.drawTableGrid(page, tableTop, HEADER_HEIGHT, colWidths, true);

    // Column headers
    const headers = ["Account No", "Name", "Phone", "CR No", "Gold Balance", "Amount Balance", "Transactions"];
    let xPos = MARGIN + 20;
    
    headers.forEach((header, index) => {
      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 16,
        size: 9,
        font: boldFont,
        color: COLORS.emerald800,
      });
      
      xPos += colWidths[index];
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
    page.drawLine({
      start: { x: MARGIN + 20, y: startY - height },
      end: { x: MARGIN + 20 + tableWidth, y: startY - height },
      color: COLORS.emerald300,
      thickness: 1,
    });
  }

 private drawTableRows(page: PDFPage, balances: AccountBalance[], startY: number, colWidths: number[]): number {
  const { font, boldFont } = this.getFonts();
  const ROW_OFFSET = 10;
let currentY = startY - ROW_OFFSET;

  // Draw rows
  balances.forEach((balance, index) => {
    const rowTop = currentY + ROW_HEIGHT / 2;
    const rowBottom = currentY - ROW_HEIGHT / 2;

    // Row background
    const rowBgColor = index % 2 === 0 ? COLORS.white : rgb(254 / 255, 243 / 255, 199 / 255);

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
    const rowData = [
      balance.account.accountNo,
      balance.account.name.substring(0, 25) + (balance.account.name.length > 25 ? '...' : ''),
      balance.account.phone || '-',
      balance.account.cr || '-',
      formatBalance(balance.goldBalance, 'gold'),
      formatBalance(balance.kwdBalance, 'kwd'),
      balance.voucherCount.toString()
    ];

    // Draw cell text
    xPos = MARGIN + 20;
    rowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 1; // Only name is left-aligned
      
      // Determine text color based on column and balance
      let textColor;
      if (colIndex === 4) {
        // Gold balance column
        textColor = balance.goldBalance >= 0 ? COLORS.emerald700 : rgb(185 / 255, 28 / 255, 28 / 255);
      } else if (colIndex === 5) {
        // KWD balance column
        textColor = balance.kwdBalance >= 0 ? COLORS.emerald700 : rgb(185 / 255, 28 / 255, 28 / 255);
      } else {
        // All other columns
        textColor = COLORS.emerald700;
      }
      
      const textFont = font;
      
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

  private drawTotalsRow(page: PDFPage, data: BalancesPdfRequestData, startY: number, colWidths: number[]): number {
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
      "TOTALS", "", "", "",
      formatBalance(data.totals.totalGoldBalance, 'gold'),
      formatBalance(data.totals.totalKWDBalance, 'kwd'),
      ""
    ];

    // Draw totals text
    xPos = MARGIN + 20;
    totalsRowData.forEach((data, colIndex) => {
      const isLeftAligned = colIndex === 1;
      const textColor = COLORS.emerald900;
      const textFont = colIndex >= 4 ? boldFont : font;
      
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
    const footerText = `Generated by ZamZam Jewellery - Account Balances System - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
    });
  }

  async generatePDF(data: BalancesPdfRequestData): Promise<Uint8Array> {
    await this.initialize();
    const pdfDoc = this.getPDFDoc();
    
    const allBalances = data.accountBalances;
    const totalPages = Math.ceil(allBalances.length / this.pageConfig.maxRowsPerPage);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = this.createNewPage();
      const startIdx = (pageNum - 1) * this.pageConfig.maxRowsPerPage;
      const endIdx = Math.min(startIdx + this.pageConfig.maxRowsPerPage, allBalances.length);
      const pageBalances = allBalances.slice(startIdx, endIdx);
      const isLastPage = pageNum === totalPages;

      // Draw page header
      const tableTop = this.drawPageHeader(page, data, pageNum, totalPages);
      
      // Draw table header
      const { tableTop: rowsStartY, colWidths } = this.drawTableHeader(page, tableTop);
      
      // Draw table rows
      let currentY = this.drawTableRows(page, pageBalances, rowsStartY, colWidths);
      
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
    console.log("Starting Balances PDF generation...");
    
    const data: BalancesPdfRequestData = req.body;

    // Validate required data
    if (!data.accountBalances) {
      return res.status(400).json({ success: false, error: "Account balances data is required" });
    }

    console.log(`Generating Balances PDF for ${data.accountBalances.length} accounts`);

    // Generate PDF
    const generator = new BalancesPDFGenerator();
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("Balances PDF generated successfully with pagination");

    return res.json({ 
      success: true, 
      pdfData: pdfBase64,
      message: "Balances PDF generated successfully" 
    });

  } catch (err) {
    console.error("Balances PDF generation failed:", err);
    
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: "Balances PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}