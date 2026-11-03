const path = require('path');
const PDFDocument = require('pdfkit');

const ASSETS = path.join(__dirname, '..', 'assets', 'bill');
const asset = (name) => path.join(ASSETS, name);
const DEVANAGARI_FONT = asset('Lohit-Devanagari.ttf');

// The shop's printed letterhead. Bills read from another vendor print that vendor's name instead.
const LETTERHEAD = {
  name: 'S. SALUNKE MOTORS',
  address: 'Pune Nashik highway, Narayangaon',
  band: 'Prop.: T. S. Salunke Mob. No. 9923917003 / 9960887003',
  invocationLeft: '॥ श्री गजानन प्रसन्न ॥',
  invocationRight: '॥ श्री तुळजाभवानी प्रसन्न ॥',
};

const DOCUMENT_TITLES = {
  bill: 'BILL',
  invoice: 'INVOICE',
  quotation: 'QUOTATION',
  estimate: 'ESTIMATE',
  job_card: 'JOB CARD',
  receipt: 'RECEIPT',
  other: 'BILL',
};

const COLOR = { red: '#C8352B', maroon: '#A42E28', band: '#3A1D1A', label: '#3C3C3C', ink: '#14306E', rule: '#3A3A3A' };

// A4 layout, in points. Proportions follow the printed form.
const FRAME = { x: 20, y: 18, w: 555, h: 806 };
const HEADER_H = 112;
const CUSTOMER_H = 112;
const TABLE_HEAD_H = 26;
const ROW_H = 26;
const ROWS_PER_PAGE = 14;
const LOGOS_H = 28;
const WORDS_H = 58;
const COL = { particular: 20, rate: 331, qty: 389, amount: 456, end: 575 };

// ---------- Formatting ----------

const formatAmount = (value) => {
  const n = Number(value) || 0;
  const hasPaise = Math.abs(n % 1) > 0.004;
  const text = n.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 });
  return `${text}/-`;
};

const formatQty = (value) => String(Number(Number(value || 0).toFixed(2)));
const formatRate = (value) => `${Number(Number(value || 0).toFixed(2))}%`;

const formatDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const belowThousand = (n) => {
  const parts = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
  const rest = n % 100;
  if (rest >= 20) parts.push(TENS[Math.floor(rest / 10)], ONES[rest % 10]);
  else if (rest > 0) parts.push(ONES[rest]);
  return parts.filter(Boolean).join(' ');
};

// Indian numbering: crore, lakh, thousand.
const integerToWords = (n) => {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7);
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  const lakh = Math.floor((n % 1e7) / 1e5);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  const thousand = Math.floor((n % 1e5) / 1e3);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  const rest = n % 1e3;
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
};

const amountToWords = (value) => {
  const n = Number(value) || 0;
  const paiseTotal = Math.round(Math.abs(n) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  const words = `${integerToWords(rupees)} Rupees${paise ? ` and ${integerToWords(paise)} Paise` : ''} Only`;
  return n < 0 ? `Minus ${words}` : words;
};

// ---------- Text helpers ----------

const hasDevanagari = (text) => /[ऀ-ॿ]/.test(text);

// The built-in fonts only cover Latin; Devanagari uses the bundled font, anything else is replaced.
const fontFor = (text, latinFont) => (hasDevanagari(text) ? DEVANAGARI_FONT : latinFont);
const printable = (text) => String(text ?? '').replace(/[^ -ÿऀ-ॿ–—‘’“”]/g, ' ').replace(/\s+/g, ' ').trim();

// Shrinks text to fit `width`, then truncates with an ellipsis as a last resort.
const fitText = (doc, text, font, size, width, minSize = 8) => {
  doc.font(font);
  let current = size;
  while (current > minSize && doc.fontSize(current).widthOfString(text) > width) current -= 0.5;
  doc.fontSize(current);
  if (doc.widthOfString(text) <= width) return { text, size: current };
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}...`) > width) cut = cut.slice(0, -1);
  return { text: `${cut.trimEnd()}...`, size: current };
};

const drawLine = (doc, text, x, y, options = {}) => doc.text(text, x, y, { lineBreak: false, ...options });

const drawCentered = (doc, text, centerX, y) => drawLine(doc, text, centerX - doc.widthOfString(text) / 2, y);
const drawRight = (doc, text, rightX, y) => drawLine(doc, text, rightX - doc.widthOfString(text), y);

// Right-aligned figure that shrinks rather than crossing into the next column.
const drawFigure = (doc, text, font, size, rightX, width, y) => {
  const fitted = fitText(doc, text, font, size, width, 6);
  doc.font(font).fontSize(fitted.size);
  drawRight(doc, fitted.text, rightX, y + (size - fitted.size) / 2);
};

// Word-wraps into lines no wider than `width`, splitting words that are too long on their own.
const wrapText = (doc, text, width) => {
  const lines = [];
  let line = '';
  for (let word of text.split(' ')) {
    while (doc.widthOfString(word) > width) {
      if (line) {
        lines.push(line);
        line = '';
      }
      let head = word;
      while (head.length > 1 && doc.widthOfString(head) > width) head = head.slice(0, -1);
      lines.push(head);
      word = word.slice(head.length);
    }
    const candidate = line ? `${line} ${word}` : word;
    if (doc.widthOfString(candidate) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

const hLine = (doc, x1, x2, y, color = COLOR.rule, width = 0.6) =>
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(width).strokeColor(color).stroke();
const vLine = (doc, x, y1, y2, color = COLOR.red, width = 0.9) =>
  doc.moveTo(x, y1).lineTo(x, y2).lineWidth(width).strokeColor(color).stroke();

// ---------- Layout data ----------

// Saved vendor decides the letterhead: the shop's own, or a plain one for any other vendor.
const resolveLetterhead = (bill) => {
  const vendor = printable(bill.vendorName);
  if (!vendor || /salunke/i.test(vendor)) return LETTERHEAD;
  const contact = printable(bill.vendorContact);
  return {
    name: vendor.toUpperCase(),
    address: '',
    band: contact ? `Mob. No. ${contact}` : '',
    invocationLeft: LETTERHEAD.invocationLeft,
    invocationRight: LETTERHEAD.invocationRight,
  };
};

// Long descriptions take several ruled rows; rows are then split across pages.
const buildPages = (doc, items) => {
  const particularWidth = COL.rate - COL.particular - 34;
  const rows = [];
  items.forEach((item, index) => {
    const text = printable(item.particular);
    doc.font(fontFor(text, 'Helvetica')).fontSize(11);
    wrapText(doc, text, particularWidth).forEach((line, lineIndex) => {
      rows.push({ line, first: lineIndex === 0, srNo: index + 1, item });
    });
  });
  const pages = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  return pages.length ? pages : [[]];
};

// ---------- Drawing ----------

const drawHeader = (doc, bill, letterhead) => {
  const { x, y, w } = FRAME;
  const bandY = y + HEADER_H - 25;

  doc.image(asset('ganesh.jpg'), x + 5, y + 4, { width: 76, height: 77 });
  doc.rect(x + 5, y + 4, 76, 77).lineWidth(0.8).strokeColor(COLOR.red).stroke();

  const textX = x + 84;
  const textW = w - 88;
  const centerX = textX + textW / 2;

  doc.fillColor(COLOR.label).font(DEVANAGARI_FONT).fontSize(10);
  drawLine(doc, letterhead.invocationLeft, textX + 2, y + 4);
  drawRight(doc, letterhead.invocationRight, x + w - 8, y + 4);

  const title = DOCUMENT_TITLES[bill.documentType] || DOCUMENT_TITLES.bill;
  doc.fillColor('#222222').font('Helvetica-Bold').fontSize(12.5);
  const titleW = doc.widthOfString(title);
  const titleX = centerX - titleW / 2;
  drawLine(doc, title, titleX, y + 8);
  hLine(doc, titleX, titleX + titleW, y + 20, '#222222', 0.9);

  const name = printable(letterhead.name);
  const fittedName = fitText(doc, name, fontFor(name, 'Times-Bold'), 34, textW - 8, 16);
  doc.fillColor(COLOR.red).font(fontFor(name, 'Times-Bold')).fontSize(fittedName.size);
  drawCentered(doc, fittedName.text, centerX, y + 27);

  if (letterhead.address) {
    doc.fillColor('#222222').font('Times-Bold').fontSize(14.5);
    drawCentered(doc, letterhead.address, centerX, y + 62);
  }

  doc.rect(x, bandY, w, 25).fill(COLOR.band);
  if (letterhead.band) {
    const band = fitText(doc, printable(letterhead.band), 'Times-Bold', 14.5, w - 20);
    doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(band.size);
    drawCentered(doc, band.text, x + w / 2, bandY + 6.5);
  }
};

const drawField = (doc, label, value, x, y, rightX) => {
  doc.fillColor(COLOR.label).font('Times-Bold').fontSize(12.5);
  drawLine(doc, label, x, y);
  const lineX = x + doc.widthOfString(label) + 3;
  hLine(doc, lineX, rightX, y + 14, COLOR.rule, 0.7);

  const text = printable(value);
  if (!text) return;
  const fitted = fitText(doc, text, fontFor(text, 'Helvetica'), 11, rightX - lineX - 8);
  doc.fillColor(COLOR.ink).font(fontFor(text, 'Helvetica')).fontSize(fitted.size);
  drawLine(doc, fitted.text, lineX + 5, y + (hasDevanagari(text) ? -1 : 2));
};

const drawCustomer = (doc, bill) => {
  const y = FRAME.y + HEADER_H + 10;
  const leftX = FRAME.x + 7;
  const leftEnd = COL.qty - 2;
  const rightX = COL.qty + 9;
  const rightEnd = COL.end - 7;

  drawField(doc, 'Name :', bill.customerName, leftX, y, leftEnd);
  drawField(doc, 'Vehical No. :', bill.vehicleNumber, leftX, y + 24, leftEnd);
  drawField(doc, 'Mobile No. :', bill.mobile, leftX, y + 48, leftEnd);

  drawField(doc, 'Date:', formatDate(bill.billDate), rightX, y, rightEnd);
  drawField(doc, 'Model :', bill.vehicleModel, rightX, y + 24, rightEnd);
  drawField(doc, 'Km. :', bill.kmReading, rightX, y + 48, rightEnd);

  doc.fillColor(COLOR.label).font('Times-Bold').fontSize(12.5);
  drawLine(doc, 'Bill No.:', leftX, y + 76);
  const billNo = fitText(doc, printable(bill.billNumber), 'Courier-Bold', 17, 220, 10);
  doc.fillColor('#111111').font('Courier-Bold').fontSize(billNo.size);
  drawLine(doc, billNo.text, leftX + 62, y + 73);
};

const drawTable = (doc, rows) => {
  const headY = FRAME.y + HEADER_H + CUSTOMER_H;
  const rowsY = headY + TABLE_HEAD_H;
  const rowsEnd = rowsY + ROW_H * ROWS_PER_PAGE;
  const logosEnd = rowsEnd + LOGOS_H;
  const wordsEnd = logosEnd + WORDS_H;

  doc.rect(FRAME.x, headY, FRAME.w, TABLE_HEAD_H).fill(COLOR.maroon);
  doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(14);
  const textY = headY + 7;
  drawCentered(doc, "Particular's", (COL.particular + COL.rate) / 2, textY);
  drawCentered(doc, 'Rate', (COL.rate + COL.qty) / 2, textY);
  drawCentered(doc, 'Qty.', (COL.qty + COL.amount) / 2, textY);
  drawCentered(doc, 'Amount', (COL.amount + COL.end) / 2, textY);

  // Faint car sits behind the ruled lines, as on the printed form.
  doc.image(asset('watermark.jpg'), 137, rowsY + 104, { width: 332 });

  for (let i = 1; i <= ROWS_PER_PAGE; i += 1) hLine(doc, FRAME.x, COL.end, rowsY + ROW_H * i);
  hLine(doc, FRAME.x, COL.end, logosEnd);
  hLine(doc, COL.amount, COL.end, wordsEnd - 26);
  hLine(doc, FRAME.x, COL.end, wordsEnd);

  vLine(doc, COL.rate, headY + TABLE_HEAD_H, logosEnd);
  vLine(doc, COL.qty, headY + TABLE_HEAD_H, wordsEnd);
  vLine(doc, COL.amount, headY + TABLE_HEAD_H, wordsEnd);

  doc.image(asset('logos.jpg'), FRAME.x + 7, rowsEnd + 2, { fit: [COL.rate - FRAME.x - 14, LOGOS_H - 4], align: 'center', valign: 'center' });

  rows.forEach((row, index) => {
    const y = rowsY + ROW_H * index;
    const baseY = y + 8;
    if (row.first) {
      doc.circle(FRAME.x + 13, y + 13, 7.5).lineWidth(0.7).strokeColor(COLOR.ink).stroke();
      doc.fillColor(COLOR.ink).font('Helvetica').fontSize(row.srNo > 99 ? 6.5 : 8.5);
      drawCentered(doc, String(row.srNo), FRAME.x + 13, y + (row.srNo > 99 ? 10.5 : 10));
    }

    doc.fillColor(COLOR.ink).font(fontFor(row.line, 'Helvetica')).fontSize(11);
    drawLine(doc, row.line, FRAME.x + 26, baseY + (hasDevanagari(row.line) ? -3 : 0));

    if (row.first) {
      drawFigure(doc, formatAmount(row.item.rate), 'Helvetica', 11, COL.qty - 5, COL.qty - COL.rate - 9, baseY);
      doc.font('Helvetica').fontSize(11);
      drawCentered(doc, formatQty(row.item.qty), (COL.qty + COL.amount) / 2, baseY);
      drawFigure(doc, formatAmount(row.item.amount), 'Helvetica-Bold', 11, COL.end - 8, COL.end - COL.amount - 14, baseY);
    }
  });

  return { rowsEnd, logosEnd, wordsEnd };
};

const drawWordsAndTotal = (doc, bill, isLastPage, { logosEnd, wordsEnd }) => {
  const lineStart = FRAME.x + 7;
  doc.fillColor(COLOR.label).font('Times-Bold').fontSize(12.5);
  drawLine(doc, 'Amount in word', lineStart + 5, logosEnd + 9);
  const labelEnd = lineStart + 5 + doc.widthOfString('Amount in word') + 2;
  const firstLineY = logosEnd + 23;
  const secondLineY = logosEnd + 47;
  const wordsRight = COL.qty - 7;
  hLine(doc, labelEnd, wordsRight, firstLineY, COLOR.rule, 0.7);
  hLine(doc, lineStart, wordsRight, secondLineY, COLOR.rule, 0.7);

  // Total row: y of the box above the end of the words section.
  const totalY = wordsEnd - 18;
  doc.fillColor(COLOR.label).font('Times-Bold').fontSize(12.5);
  drawCentered(doc, isLastPage ? 'Total :' : 'Contd.', (COL.qty + COL.amount) / 2, totalY);

  if (!isLastPage) return;

  // Always derived from the saved grand total, so edits can't leave the words out of date.
  const words = amountToWords(bill.grandTotal);
  doc.fillColor(COLOR.ink).font('Helvetica').fontSize(10.5);
  const firstLine = wrapText(doc, words, wordsRight - labelEnd - 6)[0];
  const remaining = words.slice(firstLine.length).trim();
  drawLine(doc, firstLine, labelEnd + 3, firstLineY - 12);
  if (remaining) {
    const fitted = fitText(doc, remaining, 'Helvetica', 10.5, wordsRight - lineStart - 8, 7);
    doc.font('Helvetica').fontSize(fitted.size);
    drawLine(doc, fitted.text, lineStart + 4, secondLineY - 12);
  }

  doc.fillColor(COLOR.ink);
  drawFigure(doc, formatAmount(bill.subTotal), 'Helvetica-Bold', 11.5, COL.end - 8, COL.end - COL.amount - 14, totalY);
};

// Extra charges, GST and the final figure sit below the Total, like additions on the paper bill.
const drawAdjustments = (doc, bill, wordsEnd) => {
  const rows = [];
  if (bill.extraCharges) rows.push([bill.extraCharges < 0 ? 'Discount' : 'Extra Charges', bill.extraCharges]);
  if (bill.gstType && bill.gstType !== 'none') rows.push([`GST (${formatRate(bill.gstRate)})`, bill.gstAmount]);

  const differsFromSubTotal = Math.abs((Number(bill.grandTotal) || 0) - (Number(bill.subTotal) || 0)) > 0.004;
  if (!rows.length && !differsFromSubTotal) return;

  let y = wordsEnd + 5;
  rows.forEach(([label, value]) => {
    doc.fillColor(COLOR.label).font('Times-Bold').fontSize(11);
    drawRight(doc, `${label} :`, COL.amount - 6, y);
    doc.fillColor(COLOR.ink);
    drawFigure(doc, formatAmount(value), 'Helvetica', 11, COL.end - 8, COL.end - COL.amount - 14, y);
    y += 15;
  });

  hLine(doc, COL.amount - 4, COL.end - 4, y - 1, COLOR.ink, 0.9);
  doc.fillColor(COLOR.label).font('Times-Bold').fontSize(12);
  drawRight(doc, 'Grand Total :', COL.amount - 6, y + 3);
  doc.fillColor(COLOR.ink);
  drawFigure(doc, formatAmount(bill.grandTotal), 'Helvetica-Bold', 12.5, COL.end - 8, COL.end - COL.amount - 14, y + 3);
};

const drawFooter = (doc, letterhead, pageNumber, pageCount) => {
  const frameEnd = FRAME.y + FRAME.h;
  doc.image(asset('cars.jpg'), FRAME.x + 6, frameEnd - 66, { fit: [330, 62], align: 'left', valign: 'bottom' });

  const forLine = `FOR ${printable(letterhead.name)}`;
  const fitted = fitText(doc, forLine, fontFor(forLine, 'Times-Bold'), 11, 205, 7);
  doc.fillColor(COLOR.red).font(fontFor(forLine, 'Times-Bold')).fontSize(fitted.size);
  drawRight(doc, fitted.text, COL.end - 8, frameEnd - 18);

  if (pageCount > 1) {
    doc.fillColor(COLOR.label).font('Helvetica').fontSize(8);
    drawRight(doc, `Page ${pageNumber} of ${pageCount}`, COL.end - 8, frameEnd - 32);
  }
};

const drawPage = (doc, bill, letterhead, rows, pageNumber, pageCount) => {
  const isLastPage = pageNumber === pageCount;
  drawHeader(doc, bill, letterhead);
  drawCustomer(doc, bill);
  const table = drawTable(doc, rows);
  drawWordsAndTotal(doc, bill, isLastPage, table);
  if (isLastPage) drawAdjustments(doc, bill, table.wordsEnd);
  drawFooter(doc, letterhead, pageNumber, pageCount);
  doc.rect(FRAME.x, FRAME.y, FRAME.w, FRAME.h).lineWidth(1.6).strokeColor(COLOR.red).stroke();
};

// ---------- Public API ----------

// Renders to a buffer, so a failure can still return a normal JSON error rather than a broken download.
const renderBillPdf = (bill) =>
  new Promise((resolve, reject) => {
    const letterhead = resolveLetterhead(bill);
    const title = DOCUMENT_TITLES[bill.documentType] || DOCUMENT_TITLES.bill;
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: false,
      info: { Title: `${title} ${printable(bill.billNumber)}`.trim(), Author: printable(letterhead.name), Creator: 'BillScan' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const pages = buildPages(doc, bill.items || []);
      pages.forEach((rows, index) => {
        doc.addPage();
        drawPage(doc, bill, letterhead, rows, index + 1, pages.length);
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });

// e.g. Quotation-1761-Sandeep-Sheth-Rangar.pdf
const billPdfFileName = (bill) => {
  const title = (DOCUMENT_TITLES[bill.documentType] || DOCUMENT_TITLES.bill).toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase()).replace(/\s/g, '-');
  const parts = [title, bill.billNumber, bill.customerName]
    .map((part) => String(part || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean);
  return `${parts.join('-').slice(0, 100)}.pdf`;
};

module.exports = { renderBillPdf, billPdfFileName, amountToWords };
