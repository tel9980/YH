-- ============================================================================
-- 小会计专业合规版升级 v7.0 数据库迁移脚本
-- ============================================================================
-- 本脚本将系统从 v6.5 升级到 v7.0，引入专业会计准则合规功能
-- 执行前请务必备份数据库！
-- ============================================================================

-- ============================================================================
-- 第一部分：表重命名（保留历史数据）
-- ============================================================================

-- 1.1 重命名凭证相关表
ALTER TABLE journal_entries RENAME TO vouchers;
ALTER TABLE journal_entry_lines RENAME TO voucher_lines;

-- 1.2 更新 voucher_lines 表的外键引用列名
-- SQLite 不支持直接重命名列，需要重建表
CREATE TABLE voucher_lines_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL,
  line_no INTEGER DEFAULT 1,
  account_id TEXT NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  auxiliary_data TEXT,
  notes TEXT,
  FOREIGN KEY(voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  FOREIGN KEY(account_id) REFERENCES accounts(id)
);

-- 复制数据（entry_id -> voucher_id）
INSERT INTO voucher_lines_new (id, voucher_id, account_id, debit, credit)
SELECT id, entry_id, account_id, debit, credit FROM voucher_lines;

-- 删除旧表，重命名新表
DROP TABLE voucher_lines;
ALTER TABLE voucher_lines_new RENAME TO voucher_lines;

-- ============================================================================
-- 第二部分：为现有表添加新字段
-- ============================================================================

-- 2.1 为 accounts 表添加新字段
ALTER TABLE accounts ADD COLUMN level INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN auxiliary_types TEXT;
ALTER TABLE accounts ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE accounts ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- 2.2 为 vouchers 表添加新字段
ALTER TABLE vouchers ADD COLUMN voucher_type TEXT DEFAULT 'manual';
ALTER TABLE vouchers ADD COLUMN status TEXT DEFAULT 'draft';
ALTER TABLE vouchers ADD COLUMN source_type TEXT;
ALTER TABLE vouchers ADD COLUMN source_id INTEGER;
ALTER TABLE vouchers ADD COLUMN created_by TEXT;
ALTER TABLE vouchers ADD COLUMN approved_by TEXT;
ALTER TABLE vouchers ADD COLUMN approved_at TEXT;
ALTER TABLE vouchers ADD COLUMN attachment_url TEXT;

-- 2.3 为业务单据表添加 voucher_id 字段（如果不存在）
-- orders 表已有 voucher_id，跳过
-- incomes 表已有 voucher_id，跳过
-- expenses 表已有 voucher_id，跳过
-- supplier_bills 表已有 voucher_id，跳过

-- 2.4 为 fixed_assets 表添加新字段
ALTER TABLE fixed_assets ADD COLUMN asset_no TEXT;
ALTER TABLE fixed_assets ADD COLUMN net_book_value REAL DEFAULT 0;
ALTER TABLE fixed_assets ADD COLUMN accumulated_depreciation REAL DEFAULT 0;
ALTER TABLE fixed_assets ADD COLUMN category TEXT DEFAULT '机器设备';
ALTER TABLE fixed_assets ADD COLUMN department_id INTEGER;
ALTER TABLE fixed_assets ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE fixed_assets ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- 2.5 为 inventory 表添加新字段（支持库存计价）
ALTER TABLE inventory ADD COLUMN total_cost REAL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN total_quantity REAL DEFAULT 0;

-- 2.6 更新 inventory_transactions 表结构
-- 需要重建表以添加更多字段
CREATE TABLE inventory_transactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  transaction_date TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  balance_quantity REAL NOT NULL,
  balance_cost REAL NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(item_id) REFERENCES inventory(id)
);

-- 保留旧表数据（如果需要迁移历史数据，可以在这里添加 INSERT 语句）
-- 注意：旧表结构与新表不完全兼容，建议从 v7.0 开始使用新的库存事务记录

DROP TABLE inventory_transactions;
ALTER TABLE inventory_transactions_new RENAME TO inventory_transactions;

-- 2.7 更新 closing_periods 表结构
ALTER TABLE closing_periods ADD COLUMN closed_by TEXT;
ALTER TABLE closing_periods ADD COLUMN checklist TEXT;
ALTER TABLE closing_periods ADD COLUMN report TEXT;

-- ============================================================================
-- 第三部分：创建新表
-- ============================================================================

-- 3.1 凭证模板表
CREATE TABLE IF NOT EXISTS voucher_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  voucher_type TEXT,
  template_lines TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 产品成本表
CREATE TABLE IF NOT EXISTS product_costs (
  product_id INTEGER PRIMARY KEY,
  costing_method TEXT DEFAULT 'actual',
  standard_material_cost REAL DEFAULT 0,
  standard_labor_cost REAL DEFAULT 0,
  standard_overhead_cost REAL DEFAULT 0,
  standard_total_cost REAL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 3.3 生产订单表
CREATE TABLE IF NOT EXISTS production_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  product_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  start_date TEXT NOT NULL,
  completion_date TEXT,
  status TEXT DEFAULT 'in_progress',
  actual_material_cost REAL DEFAULT 0,
  actual_labor_cost REAL DEFAULT 0,
  actual_overhead_cost REAL DEFAULT 0,
  actual_total_cost REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 3.4 成本差异表
CREATE TABLE IF NOT EXISTS cost_variances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  material_price_variance REAL DEFAULT 0,
  material_quantity_variance REAL DEFAULT 0,
  labor_efficiency_variance REAL DEFAULT 0,
  overhead_variance REAL DEFAULT 0,
  total_variance REAL DEFAULT 0,
  variance_rate REAL DEFAULT 0,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 3.5 制造费用分配表
CREATE TABLE IF NOT EXISTS overhead_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL,
  method TEXT NOT NULL,
  total_overhead REAL NOT NULL,
  allocation_details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3.6 库存计价配置表
CREATE TABLE IF NOT EXISTS inventory_valuation_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  method TEXT DEFAULT 'weighted_average',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- 插入默认库存计价配置
INSERT OR IGNORE INTO inventory_valuation_config (id, method) VALUES (1, 'weighted_average');

-- 3.7 税务配置表
CREATE TABLE IF NOT EXISTS tax_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  vat_taxpayer_type TEXT DEFAULT 'general',
  vat_rate REAL DEFAULT 13.0,
  eit_rate REAL DEFAULT 25.0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认税务配置
INSERT OR IGNORE INTO tax_config (id, vat_taxpayer_type, vat_rate, eit_rate) 
VALUES (1, 'general', 13.0, 25.0);

-- 3.8 税务报表表
CREATE TABLE IF NOT EXISTS tax_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  period TEXT NOT NULL,
  report_data TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3.9 固定资产折旧计划表
CREATE TABLE IF NOT EXISTS depreciation_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  opening_book_value REAL NOT NULL,
  depreciation_amount REAL NOT NULL,
  accumulated_depreciation REAL NOT NULL,
  closing_book_value REAL NOT NULL,
  voucher_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(asset_id) REFERENCES fixed_assets(id),
  FOREIGN KEY(voucher_id) REFERENCES vouchers(id)
);

-- 3.10 固定资产处置表
CREATE TABLE IF NOT EXISTS asset_disposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL,
  disposal_date TEXT NOT NULL,
  disposal_amount REAL NOT NULL,
  disposal_expense REAL DEFAULT 0,
  gain_loss REAL NOT NULL,
  voucher_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(asset_id) REFERENCES fixed_assets(id),
  FOREIGN KEY(voucher_id) REFERENCES vouchers(id)
);

-- ============================================================================
-- 第四部分：创建索引
-- ============================================================================

-- 4.1 accounts 表索引
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- 4.2 vouchers 表索引
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
CREATE INDEX IF NOT EXISTS idx_vouchers_type ON vouchers(voucher_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_source ON vouchers(source_type, source_id);

-- 4.3 voucher_lines 表索引
CREATE INDEX IF NOT EXISTS idx_voucher_lines_voucher ON voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lines_account ON voucher_lines(account_id);

-- 4.4 product_costs 表索引
CREATE INDEX IF NOT EXISTS idx_product_costs_method ON product_costs(costing_method);

-- 4.5 production_orders 表索引
CREATE INDEX IF NOT EXISTS idx_production_orders_product ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_date ON production_orders(start_date);

-- 4.6 cost_variances 表索引
CREATE INDEX IF NOT EXISTS idx_cost_variances_period ON cost_variances(period);
CREATE INDEX IF NOT EXISTS idx_cost_variances_product ON cost_variances(product_id);

-- 4.7 overhead_allocations 表索引
CREATE INDEX IF NOT EXISTS idx_overhead_allocations_period ON overhead_allocations(period);

-- 4.8 inventory_transactions 表索引
CREATE INDEX IF NOT EXISTS idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inv_trans_type ON inventory_transactions(transaction_type);

-- 4.9 tax_reports 表索引
CREATE INDEX IF NOT EXISTS idx_tax_reports_period ON tax_reports(period);
CREATE INDEX IF NOT EXISTS idx_tax_reports_type ON tax_reports(report_type);

-- 4.10 depreciation_schedules 表索引
CREATE INDEX IF NOT EXISTS idx_depreciation_asset ON depreciation_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_period ON depreciation_schedules(period);

-- 4.11 asset_disposals 表索引
CREATE INDEX IF NOT EXISTS idx_asset_disposals_asset ON asset_disposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_disposals_date ON asset_disposals(disposal_date);

-- 4.12 fixed_assets 表索引
CREATE INDEX IF NOT EXISTS idx_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_no ON fixed_assets(asset_no);

-- 4.13 closing_periods 表索引
CREATE INDEX IF NOT EXISTS idx_closing_status ON closing_periods(status);

-- ============================================================================
-- 第五部分：数据迁移和初始化
-- ============================================================================

-- 5.1 更新现有科目的 level 字段
UPDATE accounts SET level = 1 WHERE parent_id IS NULL OR parent_id = '';
UPDATE accounts SET level = 2 WHERE parent_id IS NOT NULL AND parent_id != '' 
  AND id NOT LIKE '%-%-%';
UPDATE accounts SET level = 3 WHERE id LIKE '%-%-%';

-- 5.2 更新现有凭证的状态（历史凭证默认为已审核）
UPDATE vouchers SET status = 'approved', voucher_type = 'manual' WHERE status IS NULL;

-- 5.3 为固定资产生成资产编号（如果没有）
UPDATE fixed_assets 
SET asset_no = 'FA' || substr('000' || id, -4, 4)
WHERE asset_no IS NULL OR asset_no = '';

-- 5.4 计算固定资产净值
UPDATE fixed_assets 
SET net_book_value = cost - COALESCE(accumulated_depreciation, 0);

-- 5.5 初始化库存总成本和总数量
UPDATE inventory 
SET total_quantity = stock,
    total_cost = stock * COALESCE(unit_cost, 0);

-- ============================================================================
-- 第六部分：插入预置数据
-- ============================================================================

-- 6.1 插入制造业常用会计科目（如果不存在）
INSERT OR IGNORE INTO accounts (id, name, type, category, parent_id, level, status) VALUES
-- 生产成本科目
('5101', '生产成本', 'cost', '成本类', NULL, 1, 'active'),
('5101-01', '直接材料', 'cost', '成本类', '5101', 2, 'active'),
('5101-02', '直接人工', 'cost', '成本类', '5101', 2, 'active'),
('5101-03', '制造费用', 'cost', '成本类', '5101', 2, 'active'),
('5101-04', '燃料动力', 'cost', '成本类', '5101', 2, 'active'),

-- 制造费用明细科目
('5601', '制造费用', 'expense', '费用类', NULL, 1, 'active'),
('5601-01', '间接材料', 'expense', '费用类', '5601', 2, 'active'),
('5601-02', '间接人工', 'expense', '费用类', '5601', 2, 'active'),
('5601-03', '折旧费', 'expense', '费用类', '5601', 2, 'active'),
('5601-04', '修理费', 'expense', '费用类', '5601', 2, 'active'),
('5601-05', '水电费', 'expense', '费用类', '5601', 2, 'active'),

-- 研发支出
('6602-04', '研发支出', 'expense', '费用类', '6602', 2, 'active'),

-- 长期待摊费用
('1801', '长期待摊费用', 'asset', '资产类', NULL, 1, 'active'),

-- 预收账款
('2203', '预收账款', 'liability', '负债类', NULL, 1, 'active'),

-- 预付账款
('1123', '预付账款', 'asset', '资产类', NULL, 1, 'active'),

-- 主营业务成本
('5401', '主营业务成本', 'cost', '成本类', NULL, 1, 'active'),

-- 库存商品
('1405', '库存商品', 'asset', '资产类', NULL, 1, 'active'),

-- 应收账款
('1122', '应收账款', 'asset', '资产类', NULL, 1, 'active'),

-- 主营业务收入
('6001', '主营业务收入', 'revenue', '收入类', NULL, 1, 'active'),

-- 应交税费
('2221', '应交税费', 'liability', '负债类', NULL, 1, 'active'),
('2221-01', '应交增值税', 'liability', '负债类', '2221', 2, 'active'),
('2221-02', '应交企业所得税', 'liability', '负债类', '2221', 2, 'active'),

-- 本年利润
('4103', '本年利润', 'equity', '权益类', NULL, 1, 'active');

-- ============================================================================
-- 第七部分：创建视图（可选）
-- ============================================================================

-- 7.1 凭证汇总视图
CREATE VIEW IF NOT EXISTS v_voucher_summary AS
SELECT 
  v.id,
  v.date,
  v.voucher_no,
  v.voucher_type,
  v.status,
  v.notes,
  SUM(vl.debit) as total_debit,
  SUM(vl.credit) as total_credit,
  COUNT(vl.id) as line_count
FROM vouchers v
LEFT JOIN voucher_lines vl ON v.id = vl.voucher_id
GROUP BY v.id;

-- 7.2 科目余额视图
CREATE VIEW IF NOT EXISTS v_account_balance AS
SELECT 
  a.id,
  a.name,
  a.type,
  a.level,
  COALESCE(SUM(vl.debit), 0) as total_debit,
  COALESCE(SUM(vl.credit), 0) as total_credit,
  COALESCE(SUM(vl.debit) - SUM(vl.credit), 0) as balance
FROM accounts a
LEFT JOIN voucher_lines vl ON a.id = vl.account_id
WHERE a.status = 'active'
GROUP BY a.id;

-- ============================================================================
-- 第八部分：数据完整性检查
-- ============================================================================

-- 8.1 检查凭证借贷平衡
-- 注意：这是一个查询，不会修改数据，仅用于验证
-- SELECT voucher_id, SUM(debit) as total_debit, SUM(credit) as total_credit
-- FROM voucher_lines
-- GROUP BY voucher_id
-- HAVING ABS(SUM(debit) - SUM(credit)) > 0.01;

-- ============================================================================
-- 迁移完成
-- ============================================================================
-- 数据库已成功升级到 v7.0
-- 请验证数据完整性并测试核心功能
-- ============================================================================
