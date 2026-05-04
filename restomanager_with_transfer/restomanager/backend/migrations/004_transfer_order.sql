-- =============================================================================
--  Migration 004 – Chuyển bàn (Transfer Table)
--  Thêm cột transfer_log vào orders để ghi lịch sử chuyển bàn
--  Thêm index hỗ trợ tra cứu nhanh
-- =============================================================================

-- Ghi lịch sử chuyển bàn trực tiếp trong order (audit trail không tách bảng)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS transfer_log JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index cho activity_logs khi filter action TRANSFER_TABLE
CREATE INDEX IF NOT EXISTS logs_action_idx ON activity_logs(action);

-- Comment tài liệu hoá
COMMENT ON COLUMN orders.transfer_log IS
  'Mảng JSON ghi lịch sử chuyển bàn: [{from_table_code, to_table_code, transferred_by, transferred_at}]';
