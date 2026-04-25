const { errorResponse } = require('../utils/response');

exports.notFoundHandler = (req, res, next) => {
  return errorResponse(res, 'Route không tồn tại', 404);
};

exports.globalErrorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);
  return errorResponse(res, err.message || 'Lỗi server nội bộ', 500);
};
