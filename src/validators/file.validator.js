const { z } = require('zod');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD');

const listFilesQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'pending', 'uploading', 'processing', 'completed', 'failed']).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  sortBy: z.enum(['uploadedAt', 'grandTotal', 'vendorName', 'status']).default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const recentFilesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const fileIdParams = z.object({
  id: z.string().uuid('Invalid file id'),
});

module.exports = { listFilesQuery, recentFilesQuery, fileIdParams };
