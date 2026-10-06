const { Op, fn, col, literal } = require('sequelize');
const env = require('../config/env');
const { File, Bill, BillItem, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { removeFile } = require('../utils/fileStorage');
const { signFileToken } = require('../utils/fileToken');
const extraction = require('./extraction.service');
const stockService = require('./stock.service');

const SORT_COLUMNS = {
  uploadedAt: [['createdAt']],
  status: [['status']],
  grandTotal: [[{ model: Bill, as: 'bill' }, 'grandTotal']],
  vendorName: [[{ model: Bill, as: 'bill' }, 'vendorName']],
};

// ---------- Serialisation (DB rows -> frontend BillFile / ExtractedBill shape) ----------

const str = (v) => (v === null || v === undefined ? '' : String(v));

function serializeBill(bill, rawText = '') {
  if (!bill) return null;
  const items = (bill.items || [])
    .slice()
    .sort((a, b) => a.srNo - b.srNo)
    .map((i) => ({
      id: i.id,
      srNo: i.srNo,
      particular: i.particular,
      rate: i.rate,
      qty: i.qty,
      amount: i.amount,
      confidence: i.confidence ?? undefined,
    }));

  return {
    id: bill.id,
    fileId: bill.fileId,
    documentType: bill.documentType,
    vendorName: str(bill.vendorName),
    vendorContact: str(bill.vendorContact),
    billNumber: str(bill.billNumber),
    billDate: str(bill.billDate),
    customerName: str(bill.customerName),
    vehicleNumber: str(bill.vehicleNumber),
    vehicleModel: str(bill.vehicleModel),
    kmReading: str(bill.kmReading),
    mobile: str(bill.mobile),
    items,
    subTotal: bill.subTotal,
    extraCharges: bill.extraCharges,
    grandTotal: bill.grandTotal,
    amountInWords: str(bill.amountInWords),
    notes: str(bill.notes),
    rawText,
    confidence: bill.confidence,
    fieldConfidence: bill.fieldConfidence || {},
    corrections: bill.corrections || [],
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
}

function serializeFile(file, { withDetail = false } = {}) {
  const token = signFileToken(file.id, file.userId);
  const contentUrl = `${env.publicApiPath}/files/${file.id}/content?token=${token}`;
  return {
    id: file.id,
    originalName: file.originalName,
    storedName: file.storedName,
    fileType: file.mimeType,
    size: file.size,
    status: file.status,
    uploadedAt: file.createdAt,
    processedAt: file.processedAt,
    processingMs: file.processingMs,
    errorMessage: file.errorMessage,
    contentUrl,
    thumbnailUrl: file.mimeType.startsWith('image/') ? contentUrl : undefined,
    extractedBill: serializeBill(file.bill, withDetail ? str(file.ocrText) : ''),
  };
}

// ---------- Queries ----------

async function findOwnedFile(userId, fileId, { withItems = true } = {}) {
  const file = await File.findOne({
    where: { id: fileId, userId },
    include: [
      {
        model: Bill,
        as: 'bill',
        required: false,
        include: withItems ? [{ model: BillItem, as: 'items' }] : [],
      },
    ],
  });
  if (!file) throw ApiError.notFound('File not found');
  return file;
}

async function createUpload(userId, uploaded) {
  const file = await File.create({
    userId,
    originalName: uploaded.originalname,
    storedName: uploaded.filename,
    mimeType: uploaded.mimetype,
    size: uploaded.size,
    status: 'processing',
  });
  extraction.enqueue(file.id);
  return serializeFile(file);
}

async function listFiles(userId, params) {
  const { search, status, startDate, endDate, sortBy, sortOrder, page, limit } = params;
  const where = { userId };

  if (status && status !== 'all') where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
  }
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    where[Op.or] = [
      { originalName: like },
      { '$bill.vendor_name$': like },
      { '$bill.bill_number$': like },
      { '$bill.customer_name$': like },
      { '$bill.vehicle_number$': like },
    ];
  }

  const order = SORT_COLUMNS[sortBy].map((path) => [...path, sortOrder.toUpperCase()]);
  order.push(['createdAt', 'DESC']);

  const { rows, count } = await File.findAndCountAll({
    where,
    // Bill is 1:1, so joining it doesn't break LIMIT. Items aren't needed for list views.
    include: [{ model: Bill, as: 'bill', required: false }],
    order,
    limit,
    offset: (page - 1) * limit,
    subQuery: false,
  });

  return {
    items: rows.map((f) => serializeFile(f)),
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}

async function recentFiles(userId, limit) {
  const rows = await File.findAll({
    where: { userId },
    include: [{ model: Bill, as: 'bill', required: false }],
    order: [['createdAt', 'DESC']],
    limit,
  });
  return rows.map((f) => serializeFile(f));
}

async function getFile(userId, fileId) {
  return serializeFile(await findOwnedFile(userId, fileId), { withDetail: true });
}

async function reprocessFile(userId, fileId) {
  const file = await findOwnedFile(userId, fileId, { withItems: false });
  if (file.status === 'processing') {
    throw ApiError.conflict('This file is already being processed');
  }
  await file.update({ status: 'processing', errorMessage: null });
  extraction.enqueue(file.id);
  return serializeFile(file);
}

async function deleteFile(userId, fileId) {
  const file = await findOwnedFile(userId, fileId, { withItems: true });
  
  await sequelize.transaction(async (transaction) => {
    if (file.bill && file.bill.items) {
      await stockService.adjustStockForItems(file.bill.items, 1, transaction);
    }
    await file.destroy({ transaction }); // bills + items cascade at the DB level
  });
  
  await removeFile(file.userId, file.storedName);
  return { deleted: true };
}

async function getFileForDownload(fileId, userId) {
  const file = await File.findOne({ where: { id: fileId, userId } });
  if (!file) throw ApiError.notFound('File not found');
  return file;
}

// ---------- Bill editing ----------

async function updateBill(userId, billId, data) {
  const bill = await Bill.findOne({
    where: { [Op.or]: [{ id: billId }, { fileId: billId }] },
    include: [{ model: File, as: 'file', where: { userId }, required: true }],
  });
  if (!bill) throw ApiError.notFound('Bill not found');

  const { items, ...fields } = data;
  await sequelize.transaction(async (transaction) => {
    await bill.update(
      { ...fields, billDate: fields.billDate === '' ? null : fields.billDate },
      { transaction }
    );
    if (items) {
      const existingItems = await BillItem.findAll({ where: { billId: bill.id }, transaction });
      await stockService.adjustStockForItems(existingItems, 1, transaction);

      await BillItem.destroy({ where: { billId: bill.id }, transaction });
      const createdItems = await BillItem.bulkCreate(
        items.map((item, idx) => ({ ...item, id: undefined, srNo: idx + 1, billId: bill.id })),
        { transaction }
      );
      
      await stockService.adjustStockForItems(createdItems, -1, transaction);
    }
  });

  const fresh = await Bill.findByPk(bill.id, { include: [{ model: BillItem, as: 'items' }] });
  return serializeBill(fresh, str(bill.file.ocrText));
}

// ---------- Dashboard ----------

async function dashboardStats(userId) {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const days = 30;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [statusCounts, monthTotal, averages, daily] = await Promise.all([
    File.findAll({
      where: { userId },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
    Bill.sum('grandTotal', {
      include: [{ model: File, as: 'file', attributes: [], where: { userId, createdAt: { [Op.gte]: startOfMonth } } }],
    }),
    File.findOne({
      where: { userId, status: 'completed' },
      attributes: [
        [fn('AVG', col('File.processing_ms')), 'avgMs'],
        [fn('AVG', col('bill.confidence')), 'avgConfidence'],
      ],
      include: [{ model: Bill, as: 'bill', attributes: [] }],
      raw: true,
    }),
    File.findAll({
      where: { userId, createdAt: { [Op.gte]: since } },
      attributes: [
        [fn('DATE', col('File.created_at')), 'day'],
        [fn('COUNT', col('File.id')), 'count'],
        [fn('COALESCE', fn('SUM', col('bill.grand_total')), 0), 'amount'],
      ],
      include: [{ model: Bill, as: 'bill', attributes: [] }],
      group: [literal('day')],
      raw: true,
    }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.count)]));
  const dailyMap = new Map(daily.map((d) => [String(d.day).slice(0, 10), d]));

  const dailyUploads = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = dailyMap.get(key);
    return {
      date: key,
      displayLabel: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }),
      count: row ? Number(row.count) : 0,
      amount: row ? Number(row.amount) : 0,
    };
  });

  return {
    totalFiles: Object.values(byStatus).reduce((a, b) => a + b, 0),
    processedFiles: byStatus.completed || 0,
    processingFiles: (byStatus.processing || 0) + (byStatus.uploading || 0) + (byStatus.pending || 0),
    failedFiles: byStatus.failed || 0,
    totalAmountThisMonth: Number(monthTotal) || 0,
    avgProcessingTimeSec: averages?.avgMs ? Math.round(Number(averages.avgMs) / 100) / 10 : 0,
    confidenceAvgPercent: averages?.avgConfidence ? Math.round(Number(averages.avgConfidence) * 100) : 0,
    dailyUploads,
  };
}

module.exports = {
  createUpload,
  listFiles,
  recentFiles,
  getFile,
  reprocessFile,
  deleteFile,
  getFileForDownload,
  updateBill,
  dashboardStats,
};
