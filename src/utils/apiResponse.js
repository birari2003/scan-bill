// Envelope shared with the frontend's ApiResponse<T> type.
const sendSuccess = (res, data, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  });

const sendError = (res, statusCode, code, message, details) =>
  res.status(statusCode).json({
    success: false,
    error: { code, message, ...(details !== undefined && { details }) },
    meta: { timestamp: new Date().toISOString() },
  });

module.exports = { sendSuccess, sendError };
