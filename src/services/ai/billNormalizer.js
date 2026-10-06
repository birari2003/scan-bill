const { FIELD_CONFIDENCE_KEYS } = require('./billStructuring.service');

const DOCUMENT_TYPES = ['bill', 'invoice', 'quotation', 'estimate', 'job_card', 'receipt', 'other'];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const clamp01 = (v) => {
  const n = toNumber(v);
  return n === null ? null : Math.min(1, Math.max(0, n));
};
const cleanString = (v, max = 255) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const toIsoDate = (v) => {
  const s = cleanString(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
};

// Handwritten "/-" after an amount is often OCR'd as one extra trailing digit ("3800/-" -> "38001").
// Returns the value with that digit dropped, or null if the value can't be such a misread.
const withoutRupeeSuffix = (n) => (Number.isInteger(n) && n >= 10 ? Math.floor(n / 10) : null);
const near = (a, b) => Math.abs(a - b) <= 1;

// "MH14 KC 9936" vs "mh14kc9936" -> same; used to drop formatting-only corrections.
const canonical = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');

// DD/MM/YY(YY) -> YYYY-MM-DD, so a date that was only reformatted isn't reported as a correction.
const dmyToIso = (v) => {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\.?$/.exec(String(v).trim());
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

// True when a "correction" only changed presentation, not the value.
const isFormattingOnly = ({ field, original, corrected }) => {
  if (canonical(original) === canonical(corrected)) return true;
  if (/date/i.test(field) && dmyToIso(original) === corrected) return true;
  // Phone numbers: adding a +91 country code isn't a correction.
  if (/mobile|contact|phone/i.test(field)) {
    const strip = (v) => String(v).replace(/\+91/g, '').replace(/\D/g, '');
    if (strip(original) === strip(corrected)) return true;
  }
  return false;
};

/**
 * Defensive post-processing of LLM output: types, bounds and arithmetic.
 * The LLM is good at reading; we don't trust it with the final maths.
 */
function normalizeBill(raw) {
  const warnings = [];

  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((item) => {
      const particular = cleanString(item.particular, 500);
      if (!particular) return null;
      let qty = toNumber(item.qty);
      let rate = toNumber(item.rate);
      let amount = toNumber(item.amount);
      if (!qty || qty <= 0) qty = 1;
      if (amount === null && rate !== null) amount = rate * qty;
      if (rate === null && amount !== null) rate = amount / qty;
      return {
        particular,
        qty: round2(qty),
        rate: round2(rate ?? 0),
        amount: round2(amount ?? 0),
        confidence: clamp01(item.confidence),
      };
    })
    .filter(Boolean)
    .map((item, idx) => ({ srNo: idx + 1, ...item }));

  const repairs = [];
  const itemsSum = round2(items.reduce((sum, i) => sum + i.amount, 0));
  let subTotal = toNumber(raw.subTotal);
  let extraCharges = toNumber(raw.extraCharges);
  let grandTotal = toNumber(raw.grandTotal);

  // Repair totals that only add up once a misread "/-" digit is dropped.
  if (items.length && subTotal !== null && !near(subTotal, itemsSum)) {
    const fixed = withoutRupeeSuffix(subTotal);
    if (fixed !== null && near(fixed, itemsSum)) {
      repairs.push({ field: 'subTotal', original: String(subTotal), corrected: String(fixed), reason: 'Trailing digit was a misread "/-" suffix; matches the sum of items' });
      subTotal = fixed;
    }
  }
  if (grandTotal !== null) {
    const expected = (subTotal ?? itemsSum) + (extraCharges ?? 0);
    if (!near(grandTotal, expected)) {
      const fixed = withoutRupeeSuffix(grandTotal);
      if (fixed !== null && (near(fixed, expected) || near(fixed, itemsSum))) {
        repairs.push({ field: 'grandTotal', original: String(grandTotal), corrected: String(fixed), reason: 'Trailing digit was a misread "/-" suffix; matches the bill arithmetic' });
        grandTotal = fixed;
      }
    }
  }

  // Items added below a printed total (common on handwritten bills): the printed figure is a
  // partial total, the items are authoritative when they match the final amount.
  if (items.length && grandTotal !== null && near(itemsSum, grandTotal) && subTotal !== null && !near(subTotal, itemsSum)) {
    subTotal = itemsSum;
    extraCharges = 0;
  }

  if (subTotal === null) subTotal = itemsSum;
  if (extraCharges === null) extraCharges = grandTotal !== null ? grandTotal - subTotal : 0;
  if (grandTotal === null) grandTotal = subTotal + extraCharges;

  if (items.length && Math.abs(itemsSum - subTotal) > 1) {
    warnings.push(`Line items add up to ${itemsSum.toFixed(2)} but the subtotal reads ${subTotal.toFixed(2)}.`);
  }
  if (Math.abs(subTotal + extraCharges - grandTotal) > 1) {
    warnings.push(`Subtotal + extra charges (${(subTotal + extraCharges).toFixed(2)}) differs from the grand total (${grandTotal.toFixed(2)}).`);
  }

  const fieldConfidence = {};
  FIELD_CONFIDENCE_KEYS.forEach((key) => {
    const c = clamp01(raw.fieldConfidence?.[key]);
    if (c !== null) fieldConfidence[key] = c;
  });

  const corrections = [...(Array.isArray(raw.corrections) ? raw.corrections : []), ...repairs]
    .map((c) => ({
      field: cleanString(c.field, 100) || '',
      original: cleanString(c.original, 255) || '',
      corrected: cleanString(c.corrected, 255) || '',
      reason: cleanString(c.reason, 255) || '',
    }))
    // Drop formatting-only "fixes" (case, spacing, punctuation) — the model lists them despite instructions.
    .filter((c) => !isFormattingOnly(c));

  const notes = [cleanString(raw.notes, 2000), ...warnings].filter(Boolean).join(' ');
  const overall = clamp01(raw.confidence) ?? 0.5;

  return {
    documentType: DOCUMENT_TYPES.includes(raw.documentType) ? raw.documentType : 'bill',
    vendorName: cleanString(raw.vendorName),
    vendorContact: cleanString(raw.vendorContact),
    billNumber: cleanString(raw.billNumber, 100),
    billDate: toIsoDate(raw.billDate),
    customerName: cleanString(raw.customerName),
    vehicleNumber: cleanString(raw.vehicleNumber, 50),
    vehicleModel: cleanString(raw.vehicleModel, 150),
    kmReading: cleanString(raw.kmReading, 50),
    mobile: cleanString(raw.mobile, 50),
    items,
    subTotal: round2(subTotal),
    extraCharges: round2(extraCharges),
    grandTotal: round2(grandTotal),
    amountInWords: cleanString(raw.amountInWords, 500),
    notes: notes || null,
    // Arithmetic problems lower our trust in the extraction.
    confidence: round2(warnings.length ? Math.min(overall, 0.75) : overall),
    fieldConfidence,
    corrections,
  };
}

module.exports = { normalizeBill };
