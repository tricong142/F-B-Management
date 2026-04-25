exports.successResponse = (res, data, message = '', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data: data || {},
    message: message || ''
  });
};

exports.errorResponse = (res, message, statusCode = 400, errors = []) => {
  const response = {
    success: false,
    message: message || 'Lỗi server'
  };
  if (errors.length > 0) response.errors = errors;
  return res.status(statusCode).json(response);
};
