const { z } = require('zod');

const modelBody = z.object({
  name: z.string().trim().min(1, 'Model name is required').max(150),
  description: z.string().trim().max(2000).nullable().optional(),
});

const modelIdParams = z.object({
  id: z.string().uuid('Invalid model id'),
});

module.exports = { modelBody, modelIdParams };
