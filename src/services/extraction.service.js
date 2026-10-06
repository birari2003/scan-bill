const { File, Bill, BillItem, sequelize } = require('../models');
const { filePath } = require('../utils/fileStorage');
const { extractText } = require('./ai/ocr.service');
const { structureBill } = require('./ai/billStructuring.service');
const { normalizeBill } = require('./ai/billNormalizer');

const stockService = require('./stock.service');

const inFlight = new Set();

/**
 * Upload -> OCR.space (raw text) -> Groq (clean + structure) -> normalise -> MySQL.
 * Runs in the background; the client polls the file status.
 */
async function processFile(fileId) {
  if (inFlight.has(fileId)) return;
  inFlight.add(fileId);
  const startedAt = Date.now();

  try {
    const file = await File.findByPk(fileId);
    if (!file) return;
    await file.update({ status: 'processing', errorMessage: null });

    const ocrText = await extractText(filePath(file.userId, file.storedName), file.mimeType, file.originalName);
    await file.update({ ocrText });

    const structured = normalizeBill(await structureBill(ocrText));

    await sequelize.transaction(async (transaction) => {
      const existingBill = await Bill.findOne({ where: { fileId }, include: [{ model: BillItem, as: 'items' }], transaction });
      if (existingBill && existingBill.items) {
        await stockService.adjustStockForItems(existingBill.items, 1, transaction);
      }

      await Bill.destroy({ where: { fileId }, transaction }); // reprocess replaces the old result
      const { items, ...billData } = structured;
      const bill = await Bill.create({ ...billData, fileId }, { transaction });
      await BillItem.bulkCreate(
        items.map((item) => ({ ...item, billId: bill.id })),
        { transaction }
      );
      
      if (items && items.length > 0) {
        await stockService.adjustStockForItems(items, -1, transaction);
      }
      await file.update(
        { status: 'completed', processedAt: new Date(), processingMs: Date.now() - startedAt },
        { transaction }
      );
    });
  } catch (err) {
    console.error(`[extraction] file ${fileId} failed:`, err.message);
    await File.update(
      {
        status: 'failed',
        errorMessage: String(err.message || 'Extraction failed').slice(0, 500),
        processingMs: Date.now() - startedAt,
      },
      { where: { id: fileId } }
    ).catch(() => {});
  } finally {
    inFlight.delete(fileId);
  }
}

const enqueue = (fileId) => {
  setImmediate(() => processFile(fileId));
};

/**
 * Files left in "processing" by a crash/restart would otherwise spin forever.
 */
async function recoverInterruptedJobs() {
  const [count] = await File.update(
    { status: 'failed', errorMessage: 'Processing was interrupted. Please reprocess this file.' },
    { where: { status: ['processing', 'uploading', 'pending'] } }
  );
  if (count) console.log(`[extraction] marked ${count} interrupted file(s) as failed`);
}

module.exports = { enqueue, processFile, recoverInterruptedJobs };
