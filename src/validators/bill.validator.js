const { z } = require('zod');

const text = (max) => z.string().trim().max(max).nullable().optional();
const money = z.coerce.number().finite().min(-1e12).max(1e12);

const billItem = z.object({
  id: z.string().optional(),
  srNo: z.coerce.number().int().optional(),
  particular: z.string().trim().min(1, 'Item description is required').max(500),
  rate: money,
  qty: z.coerce.number().finite().min(0).max(1e7),
  amount: money,
  confidence: z.number().min(0).max(1).nullable().optional(),
});

// Only whitelisted fields can be edited; everything else in the body is dropped.
const updateBillBody = z.object({
  documentType: z.enum(['bill', 'invoice', 'quotation', 'estimate', 'job_card', 'receipt', 'other']).optional(),
  vendorName: text(255),
  vendorContact: text(255),
  billNumber: text(100),
  billDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bill date must be YYYY-MM-DD')]).nullable().optional(),
  customerName: text(255),
  vehicleNumber: text(50),
  vehicleModel: text(150),
  kmReading: text(50),
  mobile: text(50),
  subTotal: money.optional(),
  extraCharges: money.optional(),
  // gstAmount is always computed server-side, so it is not accepted here.
  gstType: z.enum(['none', 'default', 'custom']).optional(),
  gstRate: z.coerce.number().finite().min(0, 'GST rate cannot be negative').max(100, 'GST rate cannot exceed 100%').optional(),
  grandTotal: money.optional(),
  amountInWords: text(500),
  notes: text(5000),
  items: z.array(billItem).max(500).optional(),
});

const billIdParams = z.object({
  id: z.string().uuid('Invalid bill id'),
});

module.exports = { updateBillBody, billIdParams };
