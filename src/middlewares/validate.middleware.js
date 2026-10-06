const ApiError = require('../utils/ApiError');

// Validates and replaces req[source] with the parsed (sanitised) value.
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw ApiError.validation(details, details[0]?.message);
  }
  // Express 5 makes req.query a getter, so parsed values for non-body sources go on req.validated.
  if (source === 'body') req.body = result.data;
  else req.validated = { ...req.validated, [source]: result.data };
  next();
};

module.exports = validate;
