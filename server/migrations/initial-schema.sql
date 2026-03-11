-- ============================================================================
-- 小会计 基础数据库结构 (v6.5 兼容版)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, credit_limit REAL DEFAULT 0, pinyin TEXT);
CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, spec TEXT, unit TEXT, default_price REAL, pinyin TEXT);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, customer TEXT, product TEXT, spec TEXT, qty REAL, unit TEXT, price REAL, total REAL, outsource TEXT, notes TEXT, fixture_loss REAL DEFAULT 0, attachment_url TEXT, invoiced INTEGER DEFAULT 0, tax_rate REAL DEFAULT 0, status TEXT DEFAULT '待产', worker TEXT, reconciled INTEGER DEFAULT 0, voucher_id INTEGER, invoice_no TEXT, invoice_date TEXT);
CREATE TABLE IF NOT EXISTS incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, customer TEXT, amount REAL, bank TEXT, notes TEXT, voucher_id INTEGER);
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, category TEXT, supplier TEXT, amount REAL, method TEXT, notes TEXT, tax_rate REAL DEFAULT 0, account_id TEXT, voucher_id INTEGER);
CREATE TABLE IF NOT EXISTS supplier_bills (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, supplier TEXT, category TEXT, amount REAL, notes TEXT, voucher_id INTEGER, qty REAL DEFAULT 0, unit_price REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, stock REAL, unit TEXT, low_threshold REAL, unit_cost REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT, timestamp TEXT, type TEXT, delta REAL, notes TEXT);
CREATE TABLE IF NOT EXISTS archives (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT UNIQUE, archived_at TEXT);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, action TEXT, details TEXT);
CREATE TABLE IF NOT EXISTS material_requisitions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, item_name TEXT, qty REAL, worker TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, category TEXT, parent_id TEXT);
CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, type TEXT DEFAULT 'Digital');
CREATE TABLE IF NOT EXISTS fixed_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, acquisition_date TEXT, cost REAL, depreciation_method TEXT, useful_life INTEGER, salvage_value REAL, status TEXT DEFAULT '在用');
CREATE TABLE IF NOT EXISTS closing_periods (month TEXT PRIMARY KEY, closed_at TEXT, status TEXT DEFAULT 'closed');
CREATE TABLE IF NOT EXISTS journal_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, voucher_no TEXT, notes TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS journal_entry_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER, account_id TEXT, debit REAL DEFAULT 0, credit REAL DEFAULT 0, FOREIGN KEY(entry_id) REFERENCES journal_entries(id));
CREATE TABLE IF NOT EXISTS profit_distributions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, amount REAL, type TEXT, notes TEXT);

CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer);
CREATE INDEX IF NOT EXISTS idx_incomes_customer ON incomes(customer);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
