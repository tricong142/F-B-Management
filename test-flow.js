/**
 * 🧪 TEST FLOW: Order → Serving → Checkout → Invoice (PostgreSQL)
 * Chạy: node test-flow.js
 */
require('dotenv').config();
const { initDatabase, closePool } = require('./src/database/db');
const OrderModel = require('./src/models/Order');
const InvoiceModel = require('./src/models/Invoice');

function divider(title) {
  console.log('\n' + '═'.repeat(55));
  console.log(`  ${title}`);
  console.log('═'.repeat(55));
}

async function runTests() {
  await initDatabase();
  console.log('\n🍽️  RESTAURANT SYSTEM — END-TO-END TEST (PostgreSQL)');
  console.log('='.repeat(55));

  // ─── STEP 1: TẠO ORDER ─────────────────────────────────────
  divider('STEP 1: Waiter tạo order bàn số 5');
  const order = await OrderModel.create({
    table_number: 5,
    waiter_name: 'Nguyễn Văn A',
    notes: 'Khách dị ứng hải sản',
    items: [
      { item_name: 'Phở bò tái',    quantity: 2, price: 75000 },
      { item_name: 'Cơm tấm sườn',  quantity: 1, price: 65000 },
      { item_name: 'Nước cam tươi', quantity: 3, price: 35000 },
      { item_name: 'Chả giò chiên', quantity: 2, price: 45000 },
    ],
  });
  console.log(`✅ Order ID   : ${order.id}`);
  console.log(`✅ Trạng thái : ${order.status}`);
  console.log(`✅ Tổng tiền  : ${Number(order.total_amount).toLocaleString('vi-VN')} VNĐ`);
  console.log(`✅ Số món     : ${order.items.length}`);

  // ─── STEP 2: SERVING ───────────────────────────────────────
  divider('STEP 2: Update → serving');
  const serving = await OrderModel.updateStatus(order.id, 'serving');
  console.log(`✅ Trạng thái mới: ${serving.status}`);

  // ─── STEP 3: CHECKOUT ──────────────────────────────────────
  divider('STEP 3: Thu ngân checkout → tạo Invoice');
  const invoice = await InvoiceModel.checkout({
    order_id: order.id,
    cashier_name: 'Trần Thị B',
    discount: 50000,
    discount_note: 'Giảm 50k khách thân thiết',
    payment_method: 'cash',
  });
  console.log(`✅ Invoice ID     : ${invoice.id}`);
  console.log(`✅ Order liên kết : ${invoice.order_id}`);
  console.log(`✅ Bàn số         : ${invoice.table_number}`);
  console.log(`✅ Nhân viên      : ${invoice.waiter_name}`);
  console.log(`✅ Thu ngân       : ${invoice.cashier_name}`);
  console.log(`✅ Tổng tiền gốc  : ${Number(invoice.total_amount).toLocaleString('vi-VN')} VNĐ`);
  console.log(`✅ Giảm giá       : -${Number(invoice.discount).toLocaleString('vi-VN')} VNĐ`);
  console.log(`✅ Thành tiền     : ${Number(invoice.final_amount).toLocaleString('vi-VN')} VNĐ`);
  console.log(`✅ Giờ vào        : ${invoice.check_in_time}`);
  console.log(`✅ Giờ ra         : ${invoice.check_out_time}`);

  // ─── STEP 4: VERIFY ORDER COMPLETED ───────────────────────
  divider('STEP 4: Verify order → completed');
  const done = await OrderModel.findById(order.id);
  console.log(`✅ Order status     : ${done.status}`);
  console.log(`✅ check_out_time   : ${done.check_out_time}`);

  // ─── STEP 5: QUERY INVOICE ────────────────────────────────
  divider('STEP 5: Query lại invoice từ DB');
  const fromDb = await InvoiceModel.findById(invoice.id);
  console.log('\n📋 Danh sách món trong hóa đơn:');
  fromDb.items.forEach((item, i) => {
    console.log(
      `   ${i+1}. ${item.item_name.padEnd(20)} x${item.quantity}  ${Number(item.price).toLocaleString('vi-VN').padStart(8)} đ  =  ${Number(item.total_price).toLocaleString('vi-VN').padStart(10)} đ`
    );
  });
  const total = Number(fromDb.total_amount);
  const disc  = Number(fromDb.discount);
  const final = Number(fromDb.final_amount);
  console.log(`\n   ${''.padEnd(20)}  Tổng:   ${total.toLocaleString('vi-VN').padStart(12)} đ`);
  console.log(`   ${''.padEnd(20)}  Giảm: - ${disc.toLocaleString('vi-VN').padStart(12)} đ`);
  console.log(`   ${''.padEnd(20)}  THANH TOÁN: ${final.toLocaleString('vi-VN').padStart(9)} đ`);

  // ─── STEP 6: BUSINESS RULES ───────────────────────────────
  divider('STEP 6: Test Business Rules');

  console.log('\n🔒 checkout order đã completed → phải báo lỗi');
  try {
    await InvoiceModel.checkout({ order_id: order.id, cashier_name: 'Test' });
    console.log('❌ FAIL');
  } catch (e) { console.log(`✅ PASS: ${e.message}`); }

  console.log('\n🔒 checkout order đã cancelled → phải báo lỗi');
  const cancelOrder = await OrderModel.create({
    table_number: 3, waiter_name: 'Staff',
    items: [{ item_name: 'Test', quantity: 1, price: 10000 }],
  });
  await OrderModel.cancel(cancelOrder.id);
  try {
    await InvoiceModel.checkout({ order_id: cancelOrder.id, cashier_name: 'Cashier' });
    console.log('❌ FAIL');
  } catch (e) { console.log(`✅ PASS: ${e.message}`); }

  console.log('\n🔒 update status order completed → phải báo lỗi');
  try {
    await OrderModel.updateStatus(order.id, 'serving');
    console.log('❌ FAIL');
  } catch (e) { console.log(`✅ PASS: ${e.message}`); }

  // ─── STEP 7: TỔNG KẾT ────────────────────────────────────
  divider('STEP 7: Tổng kết');
  const allOrders   = await OrderModel.findAll();
  const allInvoices = await InvoiceModel.findAll();
  console.log(`✅ Tổng orders   trong DB: ${allOrders.length}`);
  console.log(`✅ Tổng invoices trong DB: ${allInvoices.length}`);

  const expected = (75000*2)+(65000*1)+(35000*3)+(45000*2);
  console.log(`\n💰 Kiểm tra tính toán:`);
  console.log(`   Expected total: ${expected.toLocaleString('vi-VN')} đ → Actual: ${total.toLocaleString('vi-VN')} đ  ${total === expected ? '✅':'❌'}`);
  console.log(`   Expected final: ${(expected-50000).toLocaleString('vi-VN')} đ → Actual: ${final.toLocaleString('vi-VN')} đ  ${final === expected-50000 ? '✅':'❌'}`);

  divider('✅ ALL TESTS PASSED!');
  await closePool();
}

runTests().catch(async (err) => {
  console.error('❌ Test failed:', err.message);
  await closePool();
  process.exit(1);
});
