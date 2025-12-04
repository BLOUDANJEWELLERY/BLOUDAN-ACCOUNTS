// pages/api/generate-balance-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface AccountBalance {
  id: string;
  accountNo: number;
  name: string;
  type: string;
  phone: string | null;
  crOrCivilIdNo: string | null;
  goldBalance: number;
  kwdBalance: number;
  transactionCount: number;
}

interface AccountTypeBalancesPdfRequestData {
  accountType: string;
  accountBalances: AccountBalance[];
  totals: {
    totalGold: number;
    totalKwd: number;
    totalAccounts: number;
    totalTransactions: number;
    accountsWithPositiveGold: number;
    accountsWithPositiveKwd: number;
    accountsWithZeroBalance: number;
    activeAccounts: number;
  };
  generatedAt: string;
}

// Helper function to format balance with Cr/Db
const formatBalance = (balance: number, type: 'gold' | 'kwd'): string => {
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  const unit = type === 'gold' ? 'g' : 'KWD';
  
  return `${absoluteValue.toFixed(3)} ${unit} ${suffix}`;
};

// Helper function to format balance for table
const formatBalanceCompact = (balance: number, type: 'gold' | 'kwd'): string => {
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
  gray: rgb(107 / 255, 114 / 255, 128 / 255),
  amber600: rgb(217 / 255, 119 / 255, 6 / 255),
  red600: rgb(220 / 255, 38 / 255, 38 / 255)
};

// Type-specific colors
const TYPE_COLORS: Record<string, [number, number, number]> = {
  Market: [59 / 255, 130 / 255, 246 / 255],      // Blue
  Casting: [168 / 255, 85 / 255, 247 / 255],     // Purple
  Faceting: [245 / 255, 158 / 255, 11 / 255],    // Amber
  Project: [34 / 255, 197 / 255, 94 / 255],      // Green
  'Gold Fixing': [250 / 255, 204 / 255, 21 / 255] // Yellow
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

interface ColumnConfig {
  widths: number[];
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  balanceColumnIndices: number[];
  showAmountBalance: boolean;
}

class AccountTypeBalancesPDFGenerator {
  private pdfDoc: PDFDocument | null = null;
  private font: PDFFont | null = null;
  private boldFont: PDFFont | null = null;
  private pageConfig: PageConfig;
  private isInitialized: boolean = false;
  private accountType: string = '';
  private columnConfig: ColumnConfig | null = null;

  constructor() {
    this.pageConfig = this.calculatePageConfig();
  }

  private calculatePageConfig(): PageConfig {
    const width = A4_LANDSCAPE_WIDTH;
    const height = A4_LANDSCAPE_HEIGHT;
    const contentWidth = width - (MARGIN * 2);
    const contentHeight = height - (MARGIN * 2);
    
    const headerSectionHeight = 110;
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

  private getColumnConfig(accountType: string): ColumnConfig {
    // For Project accounts, don't show amount balance column
    const isProject = accountType === 'Project';
    
    if (isProject) {
      return {
        widths: [60, 220, 80, 130, 80], // More width for name since we removed amount column
        headers: ["Account No", "Account Name", "Phone", "Gold Balance", "Txns"],
        alignments: ['left', 'left', 'center', 'right', 'center'],
        balanceColumnIndices: [3], // Only gold balance column at index 3
        showAmountBalance: false
      };
    } else {
      return {
        widths: [60, 180, 70, 100, 100, 60],
        headers: ["Account No", "Account Name", "Phone", "Gold Balance", "Amount Balance", "Txns"],
        alignments: ['left', 'left', 'center', 'right', 'right', 'center'],
        balanceColumnIndices: [3, 4], // Gold at index 3, Amount at index 4
        showAmountBalance: true
      };
    }
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

  private drawPageHeader(page: PDFPage, data: AccountTypeBalancesPdfRequestData, pageNumber: number, totalPages: number): number {
    const { font, boldFont } = this.getFonts();
    let currentY = this.pageConfig.height - MARGIN - 30;

    // Header with account type
    page.drawText("ZAMZAM JEWELLERY", {
      x: MARGIN + 20,
      y: currentY,
      size: 20,
      font: boldFont,
      color: COLORS.emerald800,
    });

    page.drawText(`${data.accountType} Account Balances`, {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.emerald700,
    });

    currentY -= 50;

    // Account Type Badge with special note for Project
    const typeColor = TYPE_COLORS[data.accountType] || [6 / 255, 95 / 255, 70 / 255];
    page.drawRectangle({
      x: MARGIN + 20,
      y: currentY + 5,
      width: 120,
      height: 20,
      color: rgb(...typeColor),
      borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
      borderWidth: 1,
    });

    const badgeText = data.accountType === 'Project' ? 'PROJECT (Gold Only)' : data.accountType;
    page.drawText(badgeText, {
      x: MARGIN + 20 + (120 - boldFont.widthOfTextAtSize(badgeText, 10)) / 2,
      y: currentY + 10,
      size: 10,
      font: boldFont,
      color: COLORS.white,
    });

    currentY -= 30;

    // Summary Information
    let summaryText: string;
    if (data.accountType === 'Project') {
      summaryText = `Total Accounts: ${data.totals.totalAccounts} | Active Accounts: ${data.totals.activeAccounts} | Total Transactions: ${data.totals.totalTransactions}`;
    } else {
      summaryText = `Total Accounts: ${data.totals.totalAccounts} | Active Accounts: ${data.totals.activeAccounts} | Total Transactions: ${data.totals.totalTransactions}`;
    }
    
    page.drawText(summaryText, {
      x: MARGIN + 20,
      y: currentY,
      size: 10,
      font: font,
      color: COLORS.emerald700,
    });

    currentY -= 20;

    // Balance Stats (adjust for Project)
    let statsText: string;
    if (data.accountType === 'Project') {
      statsText = `Positive Gold Balances: ${data.totals.accountsWithPositiveGold} | Zero Balances: ${data.totals.accountsWithZeroBalance}`;
    } else {
      statsText = `Positive Gold: ${data.totals.accountsWithPositiveGold} | Positive KWD: ${data.totals.accountsWithPositiveKwd} | Zero Balances: ${data.totals.accountsWithZeroBalance}`;
    }
    
    page.drawText(statsText, {
      x: MARGIN + 20,
      y: currentY,
      size: 9,
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
    const tableTitle = data.accountType === 'Project' 
      ? "Project Account Balances (Gold Only)"
      : "Account Balances Overview";
    
    page.drawText(tableTitle, {
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
    
    if (!this.columnConfig) {
      throw new Error("Column config not set");
    }

    // Use the pre-calculated column widths
    let colWidths = [...this.columnConfig.widths];
    
    // Adjust column widths to fit the table width
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
    const headers = this.columnConfig.headers;
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

    if (!this.columnConfig) {
      throw new Error("Column config not set");
    }

    // Draw rows
    balances.forEach((balance, index) => {
      const rowTop = currentY + ROW_HEIGHT / 2;
      const rowBottom = currentY - ROW_HEIGHT / 2;

      // Row background - alternate colors
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

      // Prepare row data based on column config
      const rowData = this.getRowDataForBalance(balance);

      // Draw cell text
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const alignment = this.columnConfig!.alignments[colIndex];
        const isBalanceColumn = this.columnConfig!.balanceColumnIndices.includes(colIndex);
        
        // Determine text color
        let textColor;
        if (isBalanceColumn) {
          // For Project accounts, we only have gold balance
          // For other accounts, we need to determine which balance
          if (this.columnConfig!.showAmountBalance && colIndex === 4) {
            // KWD balance column (index 4 when amount balance is shown)
            textColor = balance.kwdBalance >= 0 ? COLORS.emerald700 : COLORS.red600;
          } else {
            // Gold balance column
            textColor = balance.goldBalance >= 0 ? COLORS.emerald700 : COLORS.red600;
          }
        } else {
          textColor = COLORS.emerald700;
        }
        
        const textFont = font;
        const fontSize = 7;
        const textWidth = textFont.widthOfTextAtSize(data, fontSize);
        
        let textX;
        if (alignment === 'left') {
          textX = xPos + 5;
        } else if (alignment === 'right') {
          textX = xPos + colWidths[colIndex] - textWidth - 5;
        } else {
          // Center aligned
          textX = xPos + (colWidths[colIndex] - textWidth) / 2;
        }
        
        page.drawText(data, {
          x: textX,
          y: currentY - 3,
          size: fontSize,
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

  private getRowDataForBalance(balance: AccountBalance): string[] {
    if (!this.columnConfig) {
      throw new Error("Column config not set");
    }

    if (this.accountType === 'Project') {
      // For Project accounts: Account No, Name, Phone, Gold Balance, Transactions
      return [
        balance.accountNo.toString(),
        balance.name.substring(0, 30) + (balance.name.length > 30 ? '...' : ''),
        balance.phone || '-',
        formatBalanceCompact(balance.goldBalance, 'gold'),
        balance.transactionCount.toString()
      ];
    } else {
      // For other accounts: Account No, Name, Phone, Gold Balance, Amount Balance, Transactions
      return [
        balance.accountNo.toString(),
        balance.name.substring(0, 25) + (balance.name.length > 25 ? '...' : ''),
        balance.phone || '-',
        formatBalanceCompact(balance.goldBalance, 'gold'),
        formatBalanceCompact(balance.kwdBalance, 'kwd'),
        balance.transactionCount.toString()
      ];
    }
  }

  private drawTotalsRow(page: PDFPage, data: AccountTypeBalancesPdfRequestData, startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const rowTop = startY + ROW_HEIGHT / 2;
    
    if (!this.columnConfig) {
      throw new Error("Column config not set");
    }

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

    // Get totals row data
    const totalsRowData = this.getTotalsRowData(data);

    // Draw totals text
    xPos = MARGIN + 20;
    totalsRowData.forEach((cellData, colIndex) => {
      const alignment = this.columnConfig!.alignments[colIndex];
      const isBalanceColumn = this.columnConfig!.balanceColumnIndices.includes(colIndex);
      
      const textColor = COLORS.emerald900;
      const textFont = isBalanceColumn ? boldFont : font;
      const fontSize = isBalanceColumn ? 8 : 7;
      const textWidth = textFont.widthOfTextAtSize(cellData, fontSize);
      
      let textX;
      if (alignment === 'left') {
        textX = xPos + 5;
      } else if (alignment === 'right') {
        textX = xPos + colWidths[colIndex] - textWidth - 5;
      } else {
        textX = xPos + (colWidths[colIndex] - textWidth) / 2;
      }
      
      page.drawText(cellData, {
        x: textX,
        y: startY - 3,
        size: fontSize,
        font: textFont,
        color: textColor,
      });
      
      xPos += colWidths[colIndex];
    });

    // Draw totals row grid
    this.drawTableGrid(page, rowTop, ROW_HEIGHT, colWidths);

    return startY - ROW_HEIGHT;
  }

  private getTotalsRowData(data: AccountTypeBalancesPdfRequestData): string[] {
    if (!this.columnConfig) {
      throw new Error("Column config not set");
    }

    if (this.accountType === 'Project') {
      // For Project accounts: TOTALS, empty, empty, Gold Total, Transactions Total
      return [
        "TOTALS", 
        "", 
        "",
        formatBalanceCompact(data.totals.totalGold, 'gold'),
        data.totals.totalTransactions.toString()
      ];
    } else {
      // For other accounts: TOTALS, empty, empty, Gold Total, KWD Total, Transactions Total
      return [
        "TOTALS", 
        "", 
        "",
        formatBalanceCompact(data.totals.totalGold, 'gold'),
        formatBalanceCompact(data.totals.totalKwd, 'kwd'),
        data.totals.totalTransactions.toString()
      ];
    }
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number): void {
    const { font } = this.getFonts();
    const footerY = MARGIN + 10;
    const footerText = this.accountType === 'Project' 
      ? `Project Account Balances (Gold Only) - Generated by ZamZam Jewellery - Page ${pageNumber} of ${totalPages}`
      : `${this.accountType} Account Balances - Generated by ZamZam Jewellery - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
    });
  }

  async generatePDF(data: AccountTypeBalancesPdfRequestData): Promise<Uint8Array> {
    await this.initialize();
    const pdfDoc = this.getPDFDoc();
    
    // Set account type and column config
    this.accountType = data.accountType;
    this.columnConfig = this.getColumnConfig(this.accountType);
    
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

// Handle both old and new data structures
function isAccountTypeBalancesData(data: any): data is AccountTypeBalancesPdfRequestData {
  return data.accountType && Array.isArray(data.accountBalances) && 
         data.accountBalances.length > 0 && 
         typeof data.accountBalances[0].accountNo === 'number';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    console.log("Starting PDF generation...");
    
    const data = req.body;

    // Validate required data
    if (!data.accountBalances || !Array.isArray(data.accountBalances)) {
      return res.status(400).json({ 
        success: false, 
        error: "Account balances data is required and must be an array" 
      });
    }

    if (!data.accountType) {
      return res.status(400).json({ 
        success: false, 
        error: "Account type is required" 
      });
    }

    if (isAccountTypeBalancesData(data)) {
      console.log(`Generating PDF for ${data.accountType} - ${data.accountBalances.length} accounts`);
      
      // Generate PDF for account type balances
      const generator = new AccountTypeBalancesPDFGenerator();
      const pdfBytes = await generator.generatePDF(data);
      const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      console.log("Account Type PDF generated successfully");

      return res.json({ 
        success: true, 
        pdfData: pdfBase64,
        message: `${data.accountType} Account Balances PDF generated successfully` 
      });
    } else {
      console.log("Generating PDF for general balances - unsupported in this endpoint");
      
      return res.status(400).json({ 
        success: false, 
        error: "This endpoint now only supports account type balances. Please update your request.",
        hint: "Make sure you're sending accountType, accountBalances with the correct structure"
      });
    }

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