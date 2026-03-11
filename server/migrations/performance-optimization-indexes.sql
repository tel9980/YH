-- ============================================================================
-- 性能优化索引脚本 (Task 32.1)
-- ============================================================================
-- 本脚本添加额外的数据库索引以优化查询性能
-- 目标：
-- - 凭证查询响应时间 < 500ms (1000条记录)
-- - 报表生成时间 < 2s (一年数据)
-- - 月末结账时间 < 5s (1000笔凭证)
-- ============================================================================

-- 1. 优化凭证查询性能
-- 为凭证表的日期和状态组合创建复合索引
CREATE INDEX IF NOT EXISTS idx_vouchers_date_status ON vouchers(date, status);

-- 为凭证行的科目和凭证ID创建复合索引（优化JOIN查询）
CREATE INDEX IF NOT EXISTS idx_voucher_lines_account_voucher ON voucher_lines(account_id, voucher_id);

-- 为凭证的日期范围查询优化
CREATE INDEX IF NOT EXISTS idx_vouchers_date_type_status ON vouchers(date, voucher_type, status);

-- 2. 优化报表生成性能
-- 为科目类型和状态创建复合索引
CREATE INDEX IF NOT EXISTS idx_accounts_type_status ON accounts(type, status);

-- 为凭证行的借贷金额创建索引（优化SUM查询）
-- 注意：SQLite会自动使用这些索引进行聚合查询
CREATE INDEX IF NOT EXISTS idx_voucher_lines_debit ON voucher_lines(debit) WHERE debit > 0;
CREATE INDEX IF NOT EXISTS idx_voucher_lines_credit ON voucher_lines(credit) WHERE credit > 0;

-- 3. 优化月末结账性能
-- 为生产订单的日期和状态创建复合索引
CREATE INDEX IF NOT EXISTS idx_production_orders_date_status ON production_orders(start_date, status);

-- 为成本差异的期间和处理状态创建复合索引
CREATE INDEX IF NOT EXISTS idx_cost_variances_period_processed ON cost_variances(period, processed);

-- 为固定资产的状态创建索引（已存在，确保存在）
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);

-- 4. 优化业务单据查询
-- 为订单的日期和凭证ID创建复合索引
CREATE INDEX IF NOT EXISTS idx_orders_date_voucher ON orders(date, voucher_id);

-- 为收入记录的日期和凭证ID创建复合索引
CREATE INDEX IF NOT EXISTS idx_incomes_date_voucher ON incomes(date, voucher_id);

-- 为费用记录的日期和凭证ID创建复合索引
CREATE INDEX IF NOT EXISTS idx_expenses_date_voucher ON expenses(date, voucher_id);

-- 为供应商账单的日期和凭证ID创建复合索引
CREATE INDEX IF NOT EXISTS idx_supplier_bills_date_voucher ON supplier_bills(date, voucher_id);

-- 5. 优化库存查询
-- 为库存事务的日期和类型创建复合索引
CREATE INDEX IF NOT EXISTS idx_inv_trans_date_type ON inventory_transactions(transaction_date, transaction_type);

-- 为库存事务的项目和日期创建复合索引
CREATE INDEX IF NOT EXISTS idx_inv_trans_item_date ON inventory_transactions(item_id, transaction_date);

-- 6. 优化辅助核算查询
-- 为凭证行的辅助数据创建索引（JSON字段）
-- 注意：SQLite 3.38.0+ 支持JSON索引
-- CREATE INDEX IF NOT EXISTS idx_voucher_lines_aux_customer ON voucher_lines(json_extract(auxiliary_data, '$.customer_id')) WHERE auxiliary_data IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_voucher_lines_aux_supplier ON voucher_lines(json_extract(auxiliary_data, '$.supplier_id')) WHERE auxiliary_data IS NOT NULL;

-- 7. 优化审计日志查询
-- 为审计日志的时间戳创建索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 为审计日志的操作类型创建索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- 性能优化完成
-- ============================================================================
-- 建议：
-- 1. 定期运行 ANALYZE 命令更新统计信息
-- 2. 定期运行 VACUUM 命令整理数据库
-- 3. 监控慢查询日志，根据实际情况调整索引
-- ============================================================================

-- 更新统计信息
ANALYZE;

