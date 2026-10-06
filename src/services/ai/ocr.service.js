const fs = require('fs/promises');
const sharp = require('sharp');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const OCR_URL = 'https://api.ocr.space/parse/image';
// OCR.space free tier rejects files over 1 MB.
const OCR_MAX_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 90_000;

const EXTENSIONS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIF',
};

/**
 * Shrinks large images until they fit the OCR size limit while keeping text legible.
 * Returns { buffer, mimeType }.
 */
async function prepareImage(buffer) {
  if (buffer.length <= OCR_MAX_BYTES) return { buffer, mimeType: null };

  let width = 2400;
  let quality = 85;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const out = await sharp(buffer)
      .rotate() // honour EXIF orientation from phone cameras
      .resize({ width, withoutEnlargement: true })
      .grayscale()
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= OCR_MAX_BYTES) return { buffer: out, mimeType: 'image/jpeg' };
    width = Math.round(width * 0.8);
    quality = Math.max(60, quality - 5);
  }
  throw new ApiError(422, 'FILE_TOO_LARGE', 'Image is too large to process even after compression');
}

async function callOcrSpace(buffer, mimeType, fileName, engine) {
  const form = new FormData();
  form.append('apikey', env.ocrSpace.apiKey);
  form.append('OCREngine', String(engine));
  // Table mode keeps line-item rows on one line; engine 3 does its own layout analysis.
  if (engine !== 3) form.append('isTable', 'true');
  form.append('scale', 'true');
  form.append('detectOrientation', 'true');
  form.append('filetype', EXTENSIONS[mimeType] || 'JPG');
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);

  const res = await fetch(OCR_URL, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`OCR service responded with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.IsErroredOnProcessing) {
    const message = [].concat(data.ErrorMessage || data.ErrorDetails || 'OCR failed').join(' ');
    throw new Error(message);
  }

  const pages = (data.ParsedResults || []).map((r) => (r.ParsedText || '').trim()).filter(Boolean);
  return pages.length > 1 ? pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join('\n\n') : pages[0] || '';
}

/**
 * Extracts raw text from an image or PDF on disk using OCR.space.
 */
async function extractText(filePath, mimeType, fileName) {
  if (!env.ocrSpace.apiKey) {
    throw new Error('OCR is not configured (missing OCR_SPACE_API_KEY)');
  }

  let buffer = await fs.readFile(filePath);
  let type = mimeType;

  if (mimeType === 'application/pdf') {
    if (buffer.length > OCR_MAX_BYTES) {
      throw new Error('PDF is larger than 1 MB, the OCR provider limit. Please upload a smaller PDF or a photo of the bill.');
    }
  } else {
    const prepared = await prepareImage(buffer);
    buffer = prepared.buffer;
    type = prepared.mimeType || mimeType;
  }

  // Engine 3 reads handwriting best, 2 is good for printed receipts; fall back through them.
  const engines = [...new Set([env.ocrSpace.engine, 2, 1])];
  let lastError;
  for (const engine of engines) {
    try {
      const text = await callOcrSpace(buffer, type, fileName, engine);
      if (text.trim()) return text;
      lastError = new Error('No readable text found in the document');
    } catch (err) {
      lastError = err.name === 'TimeoutError' ? new Error('OCR service timed out') : err;
    }
  }
  throw lastError;
}

module.exports = { extractText };
