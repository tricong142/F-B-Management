const InvoiceModel = require('../models/Invoice');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /invoices/:id
 * Lấy chi tiết hóa đơn
 */
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await InvoiceModel.findById(req.params.id);
    if (!invoice) return errorResponse(res, 'Invoice không tồn tại', 404);
    return successResponse(res, invoice, 'Lấy chi tiết hóa đơn thành công');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

/**
 * GET /invoices
 * Lấy danh sách hóa đơn (filter: table_number, cashier_name)
 */
exports.getInvoices = async (req, res) => {
  try {
    const { table_number, cashier_name } = req.query;
    const invoices = await InvoiceModel.findAll({ table_number, cashier_name });
    return successResponse(res, invoices, `Lấy danh sách hóa đơn thành công (${invoices.length} hóa đơn)`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
