const env = require('../../config/env');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_OCR_CHARS = 24_000;
const MAX_RATE_LIMIT_RETRIES = 4;
const MAX_RETRY_WAIT_MS = 30_000;

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
const confidence = { type: 'number', description: '0 to 1' };

const FIELD_CONFIDENCE_KEYS = [
  'vendorName', 'vendorContact', 'billNumber', 'billDate', 'customerName',
  'vehicleNumber', 'vehicleModel', 'kmReading', 'mobile', 'subTotal', 'grandTotal',
];

// Strict JSON schema: every key required, unknowns represented as null.
const BILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'documentType', 'vendorName', 'vendorContact', 'billNumber', 'billDate', 'customerName',
    'vehicleNumber', 'vehicleModel', 'kmReading', 'mobile', 'items', 'subTotal', 'extraCharges',
    'grandTotal', 'amountInWords', 'notes', 'confidence', 'fieldConfidence', 'corrections',
  ],
  properties: {
    documentType: { type: 'string', enum: ['bill', 'invoice', 'quotation', 'estimate', 'job_card', 'receipt', 'other'] },
    vendorName: nullableString,
    vendorContact: nullableString,
    billNumber: nullableString,
    billDate: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD' },
    customerName: nullableString,
    vehicleNumber: nullableString,
    vehicleModel: nullableString,
    kmReading: nullableString,
    mobile: nullableString,
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['particular', 'qty', 'rate', 'amount', 'confidence'],
        properties: {
          particular: { type: 'string' },
          qty: { type: 'number' },
          rate: { type: 'number' },
          amount: { type: 'number' },
          confidence,
        },
      },
    },
    subTotal: nullableNumber,
    extraCharges: nullableNumber,
    grandTotal: nullableNumber,
    amountInWords: nullableString,
    notes: nullableString,
    confidence,
    fieldConfidence: {
      type: 'object',
      additionalProperties: false,
      required: FIELD_CONFIDENCE_KEYS,
      properties: Object.fromEntries(FIELD_CONFIDENCE_KEYS.map((k) => [k, confidence])),
    },
    corrections: {
      type: 'array',
      description: 'Every place the OCR text was fixed or interpreted',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'original', 'corrected', 'reason'],
        properties: {
          field: { type: 'string' },
          original: { type: 'string' },
          corrected: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

// Valid Indian RTO state/UT codes, used to repair misread registration numbers (e.g. "MI14" -> "MH14").
const INDIAN_STATE_CODES =
  'AN AP AR AS BR CG CH DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UK UP WB BH';

const SYSTEM_PROMPT = `You are a meticulous data-entry specialist for Indian bills, invoices, quotations, estimates and automotive job cards, many of them HANDWRITTEN on printed forms.
You receive raw OCR text that may contain recognition errors, broken lines, columns split apart and misspellings.
Return ONE clean, structured record that matches the JSON schema. Think carefully and check the arithmetic before answering.

Reading amounts (most important):
A. Indian handwritten amounts are written with a "/-" suffix, e.g. "1800/-". OCR very often turns "/-" into an extra trailing character or digit: "1800t", "1800r", "1800h", "2000-", "18001", "2935", "40935", "3800/". Strip that suffix. Example: items "18001" and "20001" with total "38001" really mean 1800 + 2000 = 3800.
B. Always reconcile: item amounts must add up to the subtotal/total. If a printed total is ~10x the item sum, or only matches after dropping its last digit, the last digit is a misread "/-". Choose the reading that makes the document's arithmetic consistent, and record the fix in "corrections".
C. Amounts handwritten BELOW the printed total (e.g. "Wheel Hub Cap - 293/-" followed by a new figure like "4093/-") are additional items added later. Include them as items. subTotal = sum of ALL items including these additions, and grandTotal is the FINAL figure (e.g. 1800 + 2000 + 293 = 4093). Mention the addition in "notes".
D. In OCR text, the description column and the amount column may appear on separate lines. Pair descriptions with amounts in order (row markers like "1", "①", "D)" indicate row numbers, not quantities).
E. Strip currency symbols and thousands separators ("Rs. 2,850/-" -> 2850). Fix O->0, l/I->1, S->5 only when context makes it certain.

Other rules:
1. Fix OCR and spelling mistakes in names and item descriptions (e.g. "Engin Oil" -> "Engine Oil", "Break Pad" -> "Brake Pad", "penting" -> "Painting", "Hubcal" -> "Hub Cap", "Swfit" -> "Swift"). Use Title Case for item, vendor and customer names when the OCR text is ALL CAPS or lower case (keep legal suffixes like "Pvt Ltd" and acronyms). Keep brand names, part numbers and model names accurate.
2. Line items: one entry per product/service row, in document order. If qty is missing use 1. If rate is missing use amount/qty. Never include subtotal/total/tax rows as items. Ignore printed brand logos (Toyota, Hyundai, Maruti Suzuki, Tata, Mahindra...) and form labels.
3. extraCharges = taxes (GST/CGST/SGST), freight, round-off etc. added after the subtotal (negative for discounts); 0 if none. grandTotal = the final payable amount; if absent, subTotal + extraCharges.
4. Dates: output YYYY-MM-DD. Indian documents use DD/MM/YY or DD/MM/YYYY; a 2-digit year "26" means 2026.
5. Vehicle numbers: Indian format "SS NN XX NNNN" e.g. "MH14 KC 9936". The first two letters must be a valid state code (${INDIAN_STATE_CODES}); fix OCR confusions such as "MI14"/"mi14" -> "MH14", "0D" -> "OD".
6. Phone numbers: format 10-digit Indian mobiles as "+91 98220 41177"; separate multiple numbers with " / ". Odometer readings: "54,210 km".
7. documentType: use the heading printed on the document (QUOTATION -> quotation, ESTIMATE -> estimate, TAX INVOICE -> invoice, JOB CARD -> job_card); default "bill".
8. Use null for anything not present. Never invent data. Ignore religious invocations and decorative text at the top of the form.
9. "corrections": list every spelling fix, misread value fix or arithmetic decision you made (field, original OCR text, corrected value, short reason). Use field names like "vehicleNumber", "grandTotal" or "items[1].amount". Do NOT list pure formatting changes (letter case, spacing, phone/date/number formatting). Empty array if none.
10. "notes": one or two short sentences with remarks printed on the document or anything the user should double-check; null if nothing notable.
11. Confidence values are 0-1 and should reflect how legible and certain each value was. Lower them for handwritten values you had to repair.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Groq returns "Please try again in 4.4775s" / a retry-after header when the per-minute token budget is spent.
function retryDelayMs(res, message) {
  const header = Number(res.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const match = /try again in ([\d.]+)(ms|s)/i.exec(message || '');
  if (match) return Math.ceil(Number(match[1]) * (match[2] === 'ms' ? 1 : 1000));
  return 5000;
}

async function callGroq(messages, { strict = true, reasoningEffort = env.groq.reasoningEffort } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.groq.model,
        temperature: 0,
        // gpt-oss models reason before answering; this is what lets them reconcile handwritten amounts.
        ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
        messages,
        response_format: strict
          ? { type: 'json_schema', json_schema: { name: 'extracted_bill', strict: true, schema: BILL_SCHEMA } }
          : { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) return JSON.parse(data.choices[0].message.content);

    const message = data?.error?.message || `AI service responded with HTTP ${res.status}`;
    const delay = retryDelayMs(res, message);
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES && delay <= MAX_RETRY_WAIT_MS) {
      console.warn(`[groq] rate limited, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt})`);
      await sleep(delay + 250);
      continue;
    }

    const err = new Error(res.status === 429 ? 'AI service is busy (rate limit reached). Please reprocess in a minute.' : message);
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }
}

/**
 * Sends OCR text to the LLM and returns a structured bill object.
 */
async function structureBill(ocrText) {
  if (!env.groq.apiKey) {
    throw new Error('AI structuring is not configured (missing GROQ_API_KEY)');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `OCR text:\n"""\n${ocrText.slice(0, MAX_OCR_CHARS)}\n"""` },
  ];

  try {
    return await callGroq(messages);
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('AI service timed out');
    if (err.status !== 400) throw err;
  }

  // The model occasionally produces output that fails strict schema validation (or the model
  // doesn't support strict mode). Retry with less reasoning, then fall back to plain JSON mode.
  try {
    return await callGroq(messages, { reasoningEffort: 'low' });
  } catch (err) {
    if (err.status !== 400) throw err;
  }
  return callGroq(
    [...messages, { role: 'user', content: `Respond with JSON matching this schema:\n${JSON.stringify(BILL_SCHEMA)}` }],
    { strict: false }
  );
}

module.exports = { structureBill, FIELD_CONFIDENCE_KEYS };
