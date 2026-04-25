const OrderModel = require('../models/Order');
const InvoiceModel = require('../models/Invoice');
const { successResponse, errorResponse } = require('../utils/response');

// ─── VALIDATION ──────────────────────────────────────────────────────────────
function validateCreateOrder(body) {
  const errors = [];
  if (!body.table_number || isNaN(body.table_number) || body.table_number < 1)
    errors.push('table_number phải là số nguyên dương');
  if (!body.waiter_name || body.waiter_name.trim() === '')
    errors.push('waiter_name không được để trống');
  if (!Array.isArray(body.items) || body.items.length === 0)
    errors.push('items phải là mảng và có ít nhất 1 món');
  else {
    body.items.forEach((item, i) => {
      if (!item.item_name || item.item_name.trim() === '')
        errors.push(`items[${i}].item_name không được để trống`);
      if (!item.quantity || isNaN(item.quantity) || item.quantity < 1)
        errors.push(`items[${i}].quantity phải là số nguyên dương`);
      if (item.price === undefined || isNaN(item.price) || item.price < 0)
        errors.push(`items[${i}].price phải là số >= 0`);
    });
  }
  return errors;
}

function validateCheckout(body) {
  const errors = [];
  if (!body.cashier_name || body.cashier_name.trim() === '')
    errors.push('cashier_name không được để trống');
  if (body.discount !== undefined && (isNaN(body.discount) || body.discount < 0))
    errors.push('discount phải là số >= 0');
  const valid = ['cash', 'card', 'transfer'];
  if (body.payment_method && !valid.includes(body.payment_method))
    errors.push(`payment_method phải là: ${valid.join(', ')}`);
  return errors;
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────

exports.createOrder = async (req, res) => {
  try {
    const errors = validateCreateOrder(req.body);
    if (errors.length) return errorResponse(res, 'Validation failed', 400, errors);

    const { table_number, waiter_name, items, notes } = req.body;
    const order = await OrderModel.create({
      table_number: parseInt(table_number),
      waiter_name: waiter_name.trim(),
      items: items.map((i) => ({
        item_name: i.item_name.trim(),
        quantity: parseInt(i.quantity),
        price: parseFloat(i.price),
        notes: i.notes || null,
      })),
      notes: notes || null,
    });
    return successResponse(res, order, 'Tạo order thành công', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, err.message, 500);
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { status, table_number } = req.query;
    const orders = await OrderModel.findAll({ status, table_number });
    return successResponse(res, orders, `Lấy danh sách orders thành công (${orders.length} orders)`);
  } catch (err) {
    console.error(err);
    return errorResponse(res, err.message, 500);
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return errorResponse(res, 'Order không tồn tại', 404);
    return successResponse(res, order, 'Lấy chi tiết order thành công');
  } catch (err) {
    console.error(err);
    return errorResponse(res, err.message, 500);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return errorResponse(res, 'status không được để trống', 400);
    const order = await OrderModel.updateStatus(req.params.id, status);
    if (!order) return errorResponse(res, 'Order không tồn tại', 404);
    return successResponse(res, order, `Cập nhật trạng thái thành công: ${status}`);
  } catch (err) {
    console.error(err);
    return errorResponse(res, err.message, 400);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await OrderModel.cancel(req.params.id);
    if (!order) return errorResponse(res, 'Order không tồn tại', 404);
    return successResponse(res, order, 'Hủy order thành công');
  } catch (err) {
    console.error(err);
    return errorResponse(res, err.message, 400);
  }
};

exports.checkout = async (req, res) => {
  try {
    const errors = validateCheckout(req.body);
    if (errors.length) return errorResponse(res, 'Validation failed', 400, errors);

    const { cashier_name, discount = 0, discount_note, payment_method = 'cash' } = req.body;
    const invoice = await InvoiceModel.checkout({
      order_id: req.params.id,
      cashier_name: cashier_name.trim(),
      discount: parseFloat(discount),
      discount_note: discount_note || null,
      payment_method,
    });
    return successResponse(res, invoice, 'Thanh toán thành công! Invoice đã được tạo.', 201);
  } catch (err) {
    console.error(err);
    const code = err.message.includes('không tồn tại') ? 404 : 400;
    return errorResponse(res, err.message, code);
  }
};
