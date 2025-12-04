// pages/api/generate-type-summary-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

interface AccountTypeSummary {
  type: string;
  totalAccounts: number;
  totalTransactions: number;
  goldBalance: number;
  kwdBalance: number;
  lockerGold: number;
}

interface OpenBalanceSummary {
  goldBalance: number;
  kwdBalance: number;
  totalTransactions: number;
  marketRecCount: number;
  gfvCount: number;
}

interface TypeSummaryPdfRequestData {
  typeSummaries: AccountTypeSummary[];
  openBalance: OpenBalanceSummary;
  overallGold: number;
  overallKwd: number;
  totalActiveAccounts: number;
  totalTransactions: number;
  grandTotalGold: number;
  grandTotalKwd: number;
  lockerTotalGold: number;
  generatedAt: string;
}

// Helper function to format balance
const formatBalance = (balance: number): string => {
  const absoluteValue = Math.abs(balance);
  const suffix = balance >= 0 ? 'Cr' : 'Db';
  return `${absoluteValue.toFixed(3)} ${suffix}`;
};

// Constants for layout
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;
const MARGIN = 30;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 25;
const FOOTER_HEIGHT = 30;

// Colors - Blue theme
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
  orange: rgb(249 / 255, 115 / 255, 22 / 255),
  purple: rgb(168 / 255, 85 / 255, 247 / 255),
  amber: rgb(245 / 255, 158 / 255, 11 / 255),
  emerald: rgb(16 / 255, 185 / 255, 129 / 255),
  yellow: rgb(234 / 255, 179 / 255, 8 / 255)
};

// Type-specific colors
const TYPE_COLORS: Record<string, [number, number, number]> = {
  Market: [59 / 255, 130 / 255, 246 / 255],      // Blue
  Casting: [168 / 255, 85 / 255, 247 / 255],     // Purple
  Faceting: [245 / 255, 158 / 255, 11 / 255],    // Amber
  Project: [16 / 255, 185 / 255, 129 / 255],     // Emerald
  'Gold Fixing': [234 / 255, 179 / 255, 8 / 255] // Yellow
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
}

class TypeSummaryPDFGenerator {
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

  private getColumnConfig(): ColumnConfig {
    return {
      widths: [120, 80, 80, 90, 90, 90, 80],
      headers: ["Account Type", "Accounts", "Transactions", "Gold Balance", "KWD Balance", "Locker Gold", "Status"],
      alignments: ['left', 'center', 'center', 'right', 'right', 'right', 'center'],
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

  private drawPageHeader(page: PDFPage, data: TypeSummaryPdfRequestData, pageNumber: number, totalPages: number): number {
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

    page.drawText("Account Type Summary Report", {
      x: MARGIN + 20,
      y: currentY - 25,
      size: 16,
      font: boldFont,
      color: COLORS.blue700,
    });

    currentY -= 50;

    // Summary Information
    const summaryText = `Active Accounts: ${data.totalActiveAccounts} | Total Transactions: ${data.totalTransactions}`;
    page.drawText(summaryText, {
      x: MARGIN + 20,
      y: currentY,
      size: 10,
      font: font,
      color: COLORS.blue700,
    });

    currentY -= 20;

    // Date and Page Info
    const dateInfo = `Generated on: ${data.generatedAt} | Page ${pageNumber} of ${totalPages}`;
    page.drawText(dateInfo, {
      x: MARGIN + 20,
      y: currentY,
      size: 9,
      font: font,
      color: COLORS.blue800,
    });

    currentY -= 30;

    // Table Title
    page.drawText("Account Type Financial Summary", {
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
    const columnConfig = this.getColumnConfig();
    
    // Use the pre-calculated column widths
    let colWidths = [...columnConfig.widths];
    
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
    this.drawTableGrid(page, tableTop, HEADER_HEIGHT, colWidths, true);

    // Column headers
    const headers = columnConfig.headers;
    let xPos = MARGIN + 20;
    
    headers.forEach((header, index) => {
      const textX = xPos + (colWidths[index] - boldFont.widthOfTextAtSize(header, 9)) / 2;
      
      page.drawText(header, {
        x: textX,
        y: tableTop - 16,
        size: 9,
        font: boldFont,
        color: COLORS.blue800,
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
        color: COLORS.blue300,
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
      color: COLORS.blue300,
      thickness: 1,
    });
  }

  private getRowDataForSummary(summary: AccountTypeSummary, isProject: boolean): string[] {
    return [
      summary.type,
      summary.totalAccounts.toString(),
      summary.totalTransactions.toString(),
      formatBalance(summary.goldBalance),
      isProject ? "N/A" : formatBalance(summary.kwdBalance),
      formatBalance(summary.lockerGold),
      summary.totalAccounts > 0 ? "Active" : "No Accounts"
    ];
  }

  private getTypeColor(type: string) {
    return TYPE_COLORS[type] || [30 / 255, 64 / 255, 175 / 255];
  }

  private drawTableRows(page: PDFPage, summaries: AccountTypeSummary[], startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const ROW_OFFSET = 10;
    let currentY = startY - ROW_OFFSET;

    const columnConfig = this.getColumnConfig();

    // Draw rows
    summaries.forEach((summary, index) => {
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

      // Prepare row data
      const isProject = summary.type === 'Project';
      const rowData = this.getRowDataForSummary(summary, isProject);

      // Draw cell text
      xPos = MARGIN + 20;
      rowData.forEach((data, colIndex) => {
        const alignment = columnConfig.alignments[colIndex];
        const isBalanceCol = colIndex === 3 || colIndex === 4 || colIndex === 5;
        const isTypeCol = colIndex === 0;
        
        let textColor = COLORS.blue700;
        let textFont = font;
        
        // Special formatting for type column
        if (isTypeCol) {
          const typeColor = this.getTypeColor(summary.type);
          textColor = rgb(...typeColor);
        }
        
        // Special formatting for balance columns
        if (isBalanceCol && !(isProject && colIndex === 4)) {
          let balanceValue = 0;
          if (colIndex === 3) balanceValue = summary.goldBalance;
          if (colIndex === 4) balanceValue = summary.kwdBalance;
          if (colIndex === 5) balanceValue = summary.lockerGold;
          
          textFont = boldFont;
          textColor = balanceValue >= 0 ? COLORS.blue700 : COLORS.red;
        }
        
        // Gray color for N/A in Project KWD column
        if (isProject && colIndex === 4) {
          textColor = COLORS.gray;
        }

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

  private drawTotalsRow(page: PDFPage, data: TypeSummaryPdfRequestData, startY: number, colWidths: number[]): number {
    const { font, boldFont } = this.getFonts();
    const rowTop = startY + ROW_HEIGHT / 2;
    
    const columnConfig = this.getColumnConfig();

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

    // Active Accounts Total Row
    let textX = MARGIN + 20;
    page.drawText("Active Accounts Total", {
      x: textX + 5,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: COLORS.blue900,
    });

    // Accounts column
    textX += colWidths[0];
    const accountsText = data.totalActiveAccounts.toString();
    const accountsX = textX + (colWidths[1] - boldFont.widthOfTextAtSize(accountsText, 8)) / 2;
    page.drawText(accountsText, {
      x: accountsX,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: COLORS.blue900,
    });

    // Transactions column
    textX += colWidths[1];
    const transactionsText = data.totalTransactions.toString();
    const transactionsX = textX + (colWidths[2] - boldFont.widthOfTextAtSize(transactionsText, 8)) / 2;
    page.drawText(transactionsText, {
      x: transactionsX,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: COLORS.blue900,
    });

    // Gold Balance column
    textX += colWidths[2];
    const goldText = formatBalance(data.overallGold);
    const goldX = textX + colWidths[3] - boldFont.widthOfTextAtSize(goldText, 8) - 5;
    page.drawText(goldText, {
      x: goldX,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: data.overallGold >= 0 ? COLORS.blue900 : COLORS.red,
    });

    // KWD Balance column
    textX += colWidths[3];
    const kwdText = formatBalance(data.overallKwd);
    const kwdX = textX + colWidths[4] - boldFont.widthOfTextAtSize(kwdText, 8) - 5;
    page.drawText(kwdText, {
      x: kwdX,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: data.overallKwd >= 0 ? COLORS.blue900 : COLORS.red,
    });

    // Locker Gold column
    textX += colWidths[4];
    const lockerText = formatBalance(data.lockerTotalGold);
    const lockerX = textX + colWidths[5] - boldFont.widthOfTextAtSize(lockerText, 8) - 5;
    page.drawText(lockerText, {
      x: lockerX,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: data.lockerTotalGold >= 0 ? COLORS.blue900 : COLORS.red,
    });

    // Status column
    textX += colWidths[5];
    const statusText = "Active";
    const statusX = textX + (colWidths[6] - boldFont.widthOfTextAtSize(statusText, 8)) / 2;
    page.drawText(statusText, {
      x: statusX,
      y: startY - 3,
      size: 8,
      font: boldFont,
      color: COLORS.blue900,
    });

    // Draw totals row grid
    this.drawTableGrid(page, rowTop, ROW_HEIGHT, colWidths);

    return startY - ROW_HEIGHT;
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number): void {
    const { font } = this.getFonts();
    const footerY = MARGIN + 10;
    const footerText = `Account Type Summary - Generated by Bloudan Jewellery - Page ${pageNumber} of ${totalPages}`;
    
    page.drawText(footerText, {
      x: (this.pageConfig.width - font.widthOfTextAtSize(footerText, 9)) / 2,
      y: footerY,
      size: 9,
      font: font,
      color: COLORS.gray,
    });
  }

  async generatePDF(data: TypeSummaryPdfRequestData): Promise<Uint8Array> {
    await this.initialize();
    const pdfDoc = this.getPDFDoc();
    
    const allSummaries = data.typeSummaries;
    const totalPages = Math.ceil(allSummaries.length / this.pageConfig.maxRowsPerPage);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = this.createNewPage();
      const startIdx = (pageNum - 1) * this.pageConfig.maxRowsPerPage;
      const endIdx = Math.min(startIdx + this.pageConfig.maxRowsPerPage, allSummaries.length);
      const pageSummaries = allSummaries.slice(startIdx, endIdx);
      const isLastPage = pageNum === totalPages;

      // Draw page header
      const tableTop = this.drawPageHeader(page, data, pageNum, totalPages);
      
      // Draw table header
      const { tableTop: rowsStartY, colWidths } = this.drawTableHeader(page, tableTop);
      
      // Draw table rows
      let currentY = this.drawTableRows(page, pageSummaries, rowsStartY, colWidths);
      
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
    console.log("Starting Type Summary PDF generation...");
    
    const data: TypeSummaryPdfRequestData = req.body;

    // Validate required data
    if (!data.typeSummaries || !Array.isArray(data.typeSummaries)) {
      return res.status(400).json({ 
        success: false, 
        error: "Type summaries data is required and must be an array" 
      });
    }

    console.log(`Generating Type Summary PDF for ${data.typeSummaries.length} account types`);

    // Generate PDF
    const generator = new TypeSummaryPDFGenerator();
    const pdfBytes = await generator.generatePDF(data);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    console.log("Type Summary PDF generated successfully");

    return res.json({ 
      success: true, 
      pdfData: pdfBase64,
      message: "Account Type Summary PDF generated successfully" 
    });

  } catch (err) {
    console.error("Type Summary PDF generation failed:", err);
    
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: "Type Summary PDF generation failed",
      details: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}