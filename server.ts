import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import session from "express-session";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("xiaokuaiji.db");

// Environment and Directory check for robust deployment
const checkEnv = () => {
  console.log("------------------------------------------");
  console.log("🚀 小会计 v5.0 - 系统环境自检中...");
  console.log(`📅 当前时间: ${new Date().toLocaleString()}`);
  console.log(`📂 工作目录: ${process.cwd()}`);
  
  try {
    // Check database connection
    db.prepare("SELECT 1").get();
    console.log("✅ 数据库连接: 正常");
  } catch (err) {
    console.error("❌ 数据库连接失败: ", err.message);
  }

  // Ensure core directories exist
  const dirs = ["core_data", "core_data/logs", "core_data/finance_bp"];
  dirs.forEach(dir => {
    const p = path.join(__dirname, dir);
    if (!fs.existsSync(p)) {
      try {
        fs.mkdirSync(p, { recursive: true });
        console.log(`✅ 目录创建成功: ${dir}`);
      } catch (err) {
        console.error(`❌ 目录创建失败 (${dir}): `, err.message);
      }
    } else {
      console.log(`✅ 目录状态正常: ${dir}`);
    }
  });
  console.log("🚀 系统自检完成，准备启动服务...");
  console.log("------------------------------------------");
};
checkEnv();

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, credit_limit REAL DEFAULT 0, pinyin TEXT);
  CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, spec TEXT, unit TEXT, default_price REAL, pinyin TEXT);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, customer TEXT, product TEXT, spec TEXT, qty REAL, unit TEXT, price REAL, total REAL, outsource TEXT, notes TEXT, fixture_loss REAL DEFAULT 0, attachment_url TEXT, invoiced INTEGER DEFAULT 0, tax_rate REAL DEFAULT 0, status TEXT DEFAULT '待产', worker TEXT, reconciled INTEGER DEFAULT 0, voucher_id INTEGER, invoice_no TEXT, invoice_date TEXT);
  CREATE TABLE IF NOT EXISTS incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, customer TEXT, amount REAL, bank TEXT, notes TEXT, voucher_id INTEGER);
  CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, category TEXT, supplier TEXT, amount REAL, method TEXT, notes TEXT, tax_rate REAL DEFAULT 0, account_id TEXT, voucher_id INTEGER);
  CREATE TABLE IF NOT EXISTS supplier_bills (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, supplier TEXT, category TEXT, amount REAL, notes TEXT, voucher_id INTEGER);
  CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, stock REAL, unit TEXT, low_threshold REAL, unit_cost REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT, timestamp TEXT, type TEXT, delta REAL, notes TEXT);
  CREATE TABLE IF NOT EXISTS archives (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT UNIQUE, archived_at TEXT);
  CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, action TEXT, details TEXT);
  CREATE TABLE IF NOT EXISTS material_requisitions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, item_name TEXT, qty REAL, worker TEXT, notes TEXT);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, category TEXT, parent_id TEXT);
  CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS fixed_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, acquisition_date TEXT, cost REAL, depreciation_method TEXT, useful_life INTEGER, salvage_value REAL, status TEXT DEFAULT '在用');
  CREATE TABLE IF NOT EXISTS closing_periods (month TEXT PRIMARY KEY, closed_at TEXT, status TEXT DEFAULT 'closed');
  CREATE TABLE IF NOT EXISTS journal_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, voucher_no TEXT, notes TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS journal_entry_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER, account_id TEXT, debit REAL DEFAULT 0, credit REAL DEFAULT 0, FOREIGN KEY(entry_id) REFERENCES journal_entries(id));
  CREATE TABLE IF NOT EXISTS profit_distributions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, amount REAL, type TEXT, notes TEXT);
  
  CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer);
  CREATE INDEX IF NOT EXISTS idx_incomes_customer ON incomes(customer);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
`);

const isPeriodClosed = (date: string) => {
  if (!date) return false;
  const month = date.substring(0, 7); // YYYY-MM
  const period = db.prepare("SELECT * FROM closing_periods WHERE month = ? AND status = 'closed'").get(month) as any;
  return !!period;
};

// Migration: Add columns if they don't exist
try {
  db.prepare("ALTER TABLE orders ADD COLUMN invoiced INTEGER DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN tax_rate REAL DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT '待产'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN worker TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE customers ADD COLUMN pinyin TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE products ADD COLUMN pinyin TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE products ADD COLUMN spec TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN spec TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN reconciled INTEGER DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE inventory ADD COLUMN unit_cost REAL DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE expenses ADD COLUMN tax_rate REAL DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE expenses ADD COLUMN account_id TEXT").run();
} catch (e) {}

// Migration: Add invoice fields to orders
  try {
    db.prepare("ALTER TABLE orders ADD COLUMN invoice_no TEXT").run();
    db.prepare("ALTER TABLE orders ADD COLUMN invoice_date TEXT").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE orders ADD COLUMN voucher_id INTEGER").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE incomes ADD COLUMN voucher_id INTEGER").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE expenses ADD COLUMN voucher_id INTEGER").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE supplier_bills ADD COLUMN voucher_id INTEGER").run();
  } catch (e) {}

  // Migration: Add payment_type to payment_methods
  try {
    db.prepare("ALTER TABLE payment_methods ADD COLUMN type TEXT DEFAULT 'Digital'").run();
  } catch (e) {}

  // Initialize default data
  const initDefaults = () => {
    const accountsCount = db.prepare("SELECT COUNT(*) as count FROM accounts").get().count;
    if (accountsCount === 0) {
      const defaultAccounts = [
        // 资产类 (1xxx)
        { id: '1001', name: '库存现金', type: 'asset', category: '流动资产', parent_id: null },
        { id: '1002', name: '银行存款', type: 'asset', category: '流动资产', parent_id: null },
        { id: '1122', name: '应收账款', type: 'asset', category: '流动资产', parent_id: null },
        { id: '1221', name: '其他应收款', type: 'asset', category: '流动资产', parent_id: null },
        { id: '1403', name: '原材料', type: 'asset', category: '流动资产', parent_id: null },
        { id: '1405', name: '库存商品', type: 'asset', category: '流动资产', parent_id: null },
        { id: '1601', name: '固定资产', type: 'asset', category: '非流动资产', parent_id: null },
        { id: '1602', name: '累计折旧', type: 'asset', category: '非流动资产', parent_id: null },
        
        // 负债类 (2xxx)
        { id: '2202', name: '应付账款', type: 'liability', category: '流动负债', parent_id: null },
        { id: '2211', name: '应付职工薪酬', type: 'liability', category: '流动负债', parent_id: null },
        { id: '2221', name: '应交税费', type: 'liability', category: '流动负债', parent_id: null },
        { id: '222101', name: '应交增值税-进项', type: 'liability', category: '流动负债', parent_id: '2221' },
        { id: '222102', name: '应交增值税-销项', type: 'liability', category: '流动负债', parent_id: '2221' },
        { id: '222103', name: '应交所得税', type: 'liability', category: '流动负债', parent_id: '2221' },

        // 权益类 (4xxx)
        { id: '4001', name: '实收资本', type: 'equity', category: '所有者权益', parent_id: null },
        { id: '4101', name: '盈余公积', type: 'equity', category: '所有者权益', parent_id: null },
        { id: '4103', name: '本年利润', type: 'equity', category: '所有者权益', parent_id: null },
        { id: '4104', name: '利润分配', type: 'equity', category: '所有者权益', parent_id: null },
        { id: '410401', name: '未分配利润', type: 'equity', category: '所有者权益', parent_id: '4104' },

        // 损益类 - 收入 (5xxx)
        { id: '5001', name: '主营业务收入', type: 'revenue', category: '营业收入', parent_id: null },
        { id: '500101', name: '氧化加工收入', type: 'revenue', category: '营业收入', parent_id: '5001' },
        { id: '5301', name: '营业外收入', type: 'revenue', category: '其他收入', parent_id: null },

        // 损益类 - 成本费用 (5xxx/6xxx)
        { id: '5401', name: '主营业务成本', type: 'cost', category: '营业成本', parent_id: null },
        { id: '540101', name: '直接材料', type: 'cost', category: '营业成本', parent_id: '5401' },
        { id: '540102', name: '直接人工', type: 'cost', category: '营业成本', parent_id: '5401' },
        { id: '540103', name: '制造费用', type: 'cost', category: '营业成本', parent_id: '5401' },
        
        { id: '6601', name: '销售费用', type: 'expense', category: '期间费用', parent_id: null },
        { id: '6602', name: '管理费用', type: 'expense', category: '期间费用', parent_id: null },
        { id: '660201', name: '办公费', type: 'expense', category: '期间费用', parent_id: '6602' },
        { id: '660202', name: '房租水电', type: 'expense', category: '期间费用', parent_id: '6602' },
        { id: '660203', name: '维修费', type: 'expense', category: '期间费用', parent_id: '6602' },
        { id: '6603', name: '财务费用', type: 'expense', category: '期间费用', parent_id: null },
        { id: '660301', name: '利息支出', type: 'expense', category: '期间费用', parent_id: '6603' },
        { id: '660302', name: '手续费', type: 'expense', category: '期间费用', parent_id: '6603' },
      ];
      const insert = db.prepare("INSERT INTO accounts (id, name, type, category, parent_id) VALUES (?, ?, ?, ?, ?)");
      defaultAccounts.forEach(a => insert.run(a.id, a.name, a.type, a.category, a.parent_id));
    }

    const methodsCount = db.prepare("SELECT COUNT(*) as count FROM payment_methods").get().count;
    if (methodsCount === 0) {
      const defaultMethods = [
        { name: "微信支付", type: "Digital" },
        { name: "支付宝", type: "Digital" },
        { name: "现金", type: "Cash" },
        { name: "银行转账", type: "Bank" },
        { name: "对公账户", type: "Bank" }
      ];
      const insert = db.prepare("INSERT INTO payment_methods (name, type) VALUES (?, ?)");
      defaultMethods.forEach(m => insert.run(m.name, m.type));
    }
  };
  initDefaults();

  // API Endpoints
  app.get("/api/journal-entries", (req, res) => {
    const entries = db.prepare("SELECT * FROM journal_entries ORDER BY date DESC, id DESC").all() as any[];
    const result = entries.map(e => {
      const lines = db.prepare("SELECT * FROM journal_entry_lines WHERE entry_id = ?").all(e.id);
      return { ...e, lines };
    });
    res.json(result);
  });

  app.post("/api/journal-entries", (req, res) => {
    const { date, voucher_no, notes, lines } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法新增凭证" });
    
    try {
      const transaction = db.transaction((data) => {
        const entryStmt = db.prepare("INSERT INTO journal_entries (date, voucher_no, notes, created_at) VALUES (?, ?, ?, ?)");
        const info = entryStmt.run(data.date, data.voucher_no, data.notes, new Date().toISOString());
        const entryId = info.lastInsertRowid;
        
        const lineStmt = db.prepare("INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)");
        for (const line of data.lines) {
          lineStmt.run(entryId, line.account_id, line.debit || 0, line.credit || 0);
        }
        return entryId;
      });
      
      const id = transaction({ date, voucher_no, notes, lines });
      res.json({ success: true, id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/vouchers", (req, res) => {
    // Generate virtual vouchers from incomes and expenses
    const incomes = db.prepare("SELECT id, date, customer as entity, amount, method, notes, '收款凭证' as type, '1122' as debit_account, '5001' as credit_account FROM incomes").all() as any[];
    const expenses = db.prepare("SELECT id, date, supplier as entity, amount, method, notes, '付款凭证' as type, account_id as debit_account, '1002' as credit_account FROM expenses").all() as any[];
    
    // Add manual journal entries to vouchers
    const manuals = db.prepare("SELECT id, date, notes, '记账凭证' as type, voucher_no as entity FROM journal_entries").all() as any[];
    const manualVouchers = manuals.map(m => {
      const lines = db.prepare("SELECT * FROM journal_entry_lines WHERE entry_id = ?").all(m.id) as any[];
      const total = lines.reduce((acc, cur) => acc + cur.debit, 0);
      return { ...m, amount: total, method: 'Manual', lines };
    });

    const vouchers = [...incomes, ...expenses, ...manualVouchers].sort((a, b) => b.date.localeCompare(a.date));
    res.json(vouchers);
  });

  app.get("/api/cash-journal", (req, res) => {
    const { method } = req.query;
    let query = "SELECT date, notes, amount, 'in' as type FROM incomes";
    const params: any[] = [];
    if (method) {
      query += " WHERE method = ?";
      params.push(method);
    }
    const incomes = db.prepare(query).all(...params) as any[];

    let exQuery = "SELECT date, notes, amount, 'out' as type FROM expenses";
    if (method) {
      exQuery += " WHERE method = ?";
    }
    const expenses = db.prepare(exQuery).all(...params) as any[];

    const journal = [...incomes, ...expenses].sort((a, b) => a.date.localeCompare(b.date));
    res.json(journal);
  });

  app.get("/api/trial-balance", (req, res) => {
    const { startDate, endDate } = req.query;
    const accounts = db.prepare("SELECT * FROM accounts").all() as any[];
    
    const result = accounts.map(acc => {
      // 核心逻辑：科目余额 = 期初 + 本期借方 - 本期贷方 (资产类)
      // 损益类科目通常在期末结转后余额为0
      
      const queryParams = startDate && endDate ? [acc.id, acc.id + '%', startDate, endDate] : [acc.id, acc.id + '%'];
      const dateFilter = startDate && endDate ? " AND e.date BETWEEN ? AND ?" : "";
      
      const manualLines = db.prepare(`
        SELECT SUM(l.debit) as d, SUM(l.credit) as c 
        FROM journal_entry_lines l
        JOIN journal_entries e ON l.entry_id = e.id
        WHERE (l.account_id = ? OR l.account_id LIKE ?) ${dateFilter}
      `).get(...queryParams) as any;

      let debit = manualLines.d || 0;
      let credit = manualLines.c || 0;

      // 兼容逻辑：处理尚未生成凭证的原始业务数据 (为了平滑过渡)
      if (!startDate) { // 仅在查询全量余额时合并未过账数据
        if (acc.id === '1122') { // 应收账款
          const unvoucheredOrders = db.prepare("SELECT SUM(total) as total FROM orders WHERE voucher_id IS NULL").get().total || 0;
          const unvoucheredIncomes = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE voucher_id IS NULL").get().total || 0;
          debit += unvoucheredOrders;
          credit += unvoucheredIncomes;
        } else if (acc.id === '5001' || acc.id === '500101') { // 收入
          const unvoucheredOrders = db.prepare("SELECT SUM(total) as total FROM orders WHERE voucher_id IS NULL").get().total || 0;
          credit += unvoucheredOrders;
        } else if (acc.id === '1001' || acc.id === '1002') { // 货币资金
          const type = acc.id === '1001' ? 'Cash' : 'Bank';
          const unvoucheredIn = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE voucher_id IS NULL AND method IN (SELECT name FROM payment_methods WHERE type = ?)").get(type).total || 0;
          const unvoucheredOut = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE voucher_id IS NULL AND method IN (SELECT name FROM payment_methods WHERE type = ?)").get(type).total || 0;
          debit += unvoucheredIn;
          credit += unvoucheredOut;
        }
      }

      const balance = (acc.type === 'asset' || acc.type === 'cost' || acc.type === 'expense') 
        ? (debit - credit) 
        : (credit - debit);

      return { ...acc, debit, credit, balance };
    });
    res.json(result);
  });

  app.get("/api/general-ledger/:accountId", (req, res) => {
    const { accountId } = req.params;
    let entries: any[] = [];
    
    if (accountId === '1122') {
      const orders = db.prepare("SELECT date, customer as entity, '销售记录' as notes, total as debit, 0 as credit FROM orders").all();
      const incomes = db.prepare("SELECT date, customer as entity, notes, 0 as debit, amount as credit FROM incomes").all();
      entries = [...orders, ...incomes];
    } else if (accountId === '1001' || accountId === '1002') {
      const type = accountId === '1001' ? 'Cash' : 'Bank';
      const incomes = db.prepare("SELECT date, customer as entity, notes, amount as debit, 0 as credit FROM incomes WHERE method IN (SELECT name FROM payment_methods WHERE type = ?)").all(type);
      const expenses = db.prepare("SELECT date, supplier as entity, notes, 0 as debit, amount as credit FROM expenses WHERE method IN (SELECT name FROM payment_methods WHERE type = ?)").all(type);
      entries = [...incomes, ...expenses];
    } else {
      entries = db.prepare("SELECT date, supplier as entity, notes, amount as debit, 0 as credit FROM expenses WHERE account_id = ? OR account_id LIKE ?").all(accountId, accountId + '%');
    }

    // Add manual entries
    const manuals = db.prepare(`
      SELECT e.date, e.voucher_no as entity, e.notes, l.debit, l.credit 
      FROM journal_entries e 
      JOIN journal_entry_lines l ON e.id = l.entry_id 
      WHERE l.account_id = ? OR l.account_id LIKE ?
    `).all(accountId, accountId + '%');
    entries = [...entries, ...manuals];

    res.json(entries.sort((a, b) => a.date.localeCompare(b.date)));
  });

  // Closing Period Endpoints
  app.get("/api/closing-periods", (req, res) => {
    const periods = db.prepare("SELECT * FROM closing_periods ORDER BY month DESC").all();
    res.json(periods);
  });

  app.post("/api/closing-periods/close", (req, res) => {
    const { month } = req.body;
    try {
      db.prepare("INSERT OR REPLACE INTO closing_periods (month, closed_at, status) VALUES (?, ?, 'closed')").run(month, new Date().toISOString());
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/closing-periods/reopen", (req, res) => {
    const { month } = req.body;
    try {
      db.prepare("UPDATE closing_periods SET status = 'open' WHERE month = ?").run(month);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Period-End Automation
  const generateVoucher = (data: { date: string, voucher_no: string, notes: string, lines: { account_id: string, debit: number, credit: number }[] }) => {
    const transaction = db.transaction(() => {
      const entryStmt = db.prepare("INSERT INTO journal_entries (date, voucher_no, notes, created_at) VALUES (?, ?, ?, ?)");
      const info = entryStmt.run(data.date, data.voucher_no, data.notes, new Date().toISOString());
      const entryId = info.lastInsertRowid;
      
      const lineStmt = db.prepare("INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)");
      for (const line of data.lines) {
        lineStmt.run(entryId, line.account_id, line.debit || 0, line.credit || 0);
      }
      return entryId;
    });
    return transaction();
  };

  app.post("/api/generate-business-vouchers", (req, res) => {
    const { type, ids } = req.body;
    let count = 0;
    try {
      if (type === 'orders') {
        const orders = db.prepare(`SELECT * FROM orders WHERE id IN (${ids.join(',')}) AND voucher_id IS NULL`).all() as any[];
        orders.forEach(order => {
          const taxAmount = order.total * (order.tax_rate / (100 + order.tax_rate));
          const netAmount = order.total - taxAmount;
          
          // 专业逻辑：自动结转主营业务成本 (COGS)
          // 查找该产品的库存单价
          const inv = db.prepare("SELECT unit_cost FROM inventory WHERE name = ?").get(order.product) as any;
          const cogsAmount = inv ? (inv.unit_cost * order.qty) : 0;

          const lines = [
            { account_id: '1122', debit: order.total, credit: 0 }, // 应收账款
            { account_id: '500101', debit: 0, credit: netAmount }, // 主营业务收入
            { account_id: '222102', debit: 0, credit: taxAmount }, // 应交增值税-销项
          ];

          if (cogsAmount > 0) {
            lines.push({ account_id: '540101', debit: cogsAmount, credit: 0 }); // 主营业务成本
            lines.push({ account_id: '1405', debit: 0, credit: cogsAmount }); // 库存商品
          }

          const voucherId = generateVoucher({
            date: order.date,
            voucher_no: `记-${order.date.replace(/-/g, '').substring(2)}-${order.id.toString().padStart(3, '0')}`,
            notes: `销售: ${order.customer} - ${order.product}`,
            lines
          });
          db.prepare("UPDATE orders SET voucher_id = ? WHERE id = ?").run(voucherId, order.id);
          count++;
        });
      } else if (type === 'incomes') {
        const incomes = db.prepare(`SELECT * FROM incomes WHERE id IN (${ids.join(',')}) AND voucher_id IS NULL`).all() as any[];
        incomes.forEach(income => {
          const bankAccount = income.bank.includes('现金') ? '1001' : '1002';
          const voucherId = generateVoucher({
            date: income.date,
            voucher_no: `收-${income.date.replace(/-/g, '').substring(2)}-${income.id.toString().padStart(3, '0')}`,
            notes: `收款: ${income.customer}`,
            lines: [
              { account_id: bankAccount, debit: income.amount, credit: 0 },
              { account_id: '1122', debit: 0, credit: income.amount }, // 冲减应收
            ]
          });
          db.prepare("UPDATE incomes SET voucher_id = ? WHERE id = ?").run(voucherId, income.id);
          count++;
        });
      } else if (type === 'expenses') {
        const expenses = db.prepare(`SELECT * FROM expenses WHERE id IN (${ids.join(',')}) AND voucher_id IS NULL`).all() as any[];
        expenses.forEach(exp => {
          const paymentAccount = exp.method.includes('现金') ? '1001' : '1002';
          const debitAccount = exp.account_id || '6602'; // 默认管理费用
          const voucherId = generateVoucher({
            date: exp.date,
            voucher_no: `支-${exp.date.replace(/-/g, '').substring(2)}-${exp.id.toString().padStart(3, '0')}`,
            notes: `支出: ${exp.supplier || ''} - ${exp.category} ${exp.notes || ''}`,
            lines: [
              { account_id: debitAccount, debit: exp.amount, credit: 0 },
              { account_id: paymentAccount, debit: 0, credit: exp.amount },
            ]
          });
          db.prepare("UPDATE expenses SET voucher_id = ? WHERE id = ?").run(voucherId, exp.id);
          count++;
        });
      } else if (type === 'supplier_bills') {
        const bills = db.prepare(`SELECT * FROM supplier_bills WHERE id IN (${ids.join(',')}) AND voucher_id IS NULL`).all() as any[];
        bills.forEach(bill => {
          const voucherId = generateVoucher({
            date: bill.date,
            voucher_no: `付-${bill.date.replace(/-/g, '').substring(2)}-${bill.id.toString().padStart(3, '0')}`,
            notes: `应付账单: ${bill.supplier} - ${bill.category}`,
            lines: [
              { account_id: '540101', debit: bill.amount, credit: 0 }, // 默认计入原材料成本
              { account_id: '2202', debit: 0, credit: bill.amount }, // 应付账款
            ]
          });
          db.prepare("UPDATE supplier_bills SET voucher_id = ? WHERE id = ?").run(voucherId, bill.id);
          count++;
        });
      }
      res.json({ success: true, count });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-closing-vouchers", (req, res) => {
    const { month } = req.body; // YYYY-MM
    if (isPeriodClosed(month)) return res.status(403).json({ error: "该月份已结账，无法生成凭证" });
    
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0).toISOString().split('T')[0];

    try {
      const transaction = db.transaction(() => {
        // 1. 获取所有损益类科目
        const accounts = db.prepare("SELECT * FROM accounts WHERE type IN ('revenue', 'cost', 'expense')").all() as any[];
        const closingLines = [];
        let netProfit = 0;

        for (const acc of accounts) {
          // 获取该科目在指定时间段内的余额
          // 借方发生额
          const debitRes = db.prepare(`
            SELECT SUM(l.debit) as total 
            FROM journal_entry_lines l
            JOIN journal_entries e ON l.entry_id = e.id
            WHERE (l.account_id = ? OR l.account_id LIKE ?) AND e.date BETWEEN ? AND ?
          `).get(acc.id, acc.id + '%', startDate, endDate) as any;
          
          // 贷方发生额
          const creditRes = db.prepare(`
            SELECT SUM(l.credit) as total 
            FROM journal_entry_lines l
            JOIN journal_entries e ON l.entry_id = e.id
            WHERE (l.account_id = ? OR l.account_id LIKE ?) AND e.date BETWEEN ? AND ?
          `).get(acc.id, acc.id + '%', startDate, endDate) as any;

          let debit = debitRes.total || 0;
          let credit = creditRes.total || 0;

          // 包含未结转的业务数据 (orders, incomes, expenses, supplier_bills)
          if (acc.id === '5001' || acc.id === '500101') {
            credit += db.prepare("SELECT SUM(total) as total FROM orders WHERE voucher_id IS NULL AND date BETWEEN ? AND ?").get(startDate, endDate).total || 0;
          } else if (acc.type === 'cost' || acc.type === 'expense') {
            debit += db.prepare("SELECT SUM(amount) as total FROM expenses WHERE voucher_id IS NULL AND (account_id = ? OR account_id LIKE ?) AND date BETWEEN ? AND ?").get(acc.id, acc.id + '%', startDate, endDate).total || 0;
            if (acc.id === '540101') {
              debit += db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE voucher_id IS NULL AND date BETWEEN ? AND ?").get(startDate, endDate).total || 0;
            }
          }

          if (acc.type === 'revenue') {
            const balance = credit - debit;
            if (Math.abs(balance) > 0.01) {
              closingLines.push({ account_id: acc.id, debit: balance, credit: 0 });
              netProfit += balance;
            }
          } else {
            const balance = debit - credit;
            if (Math.abs(balance) > 0.01) {
              closingLines.push({ account_id: acc.id, debit: 0, credit: balance });
              netProfit -= balance;
            }
          }
        }

        if (closingLines.length > 0) {
          // 结转至“本年利润”
          if (netProfit > 0) {
            closingLines.push({ account_id: '4103', debit: 0, credit: netProfit });
          } else {
            closingLines.push({ account_id: '4103', debit: Math.abs(netProfit), credit: 0 });
          }

          const entryStmt = db.prepare("INSERT INTO journal_entries (date, voucher_no, notes, created_at) VALUES (?, ?, ?, ?)");
          const info = entryStmt.run(endDate, `结-${month.replace('-', '')}-001`, `${month} 期末损益结转`, new Date().toISOString());
          const entryId = info.lastInsertRowid;

          const lineStmt = db.prepare("INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?)");
          for (const line of closingLines) {
            lineStmt.run(entryId, line.account_id, line.debit, line.credit);
          }
          return { success: true, count: closingLines.length, netProfit };
        }
        return { success: false, message: "该时段无损益发生" };
      });

      const result = transaction();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-depreciation-voucher", (req, res) => {
    const { month } = req.body;
    if (isPeriodClosed(month)) return res.status(403).json({ error: "该月份已结账，无法计提折旧" });
    
    const endDate = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0).toISOString().split('T')[0];

    try {
      const assets = db.prepare("SELECT * FROM fixed_assets WHERE status = '在用'").all() as any[];
      let totalDepreciation = 0;
      
      assets.forEach(asset => {
        const start = new Date(asset.acquisition_date);
        const current = new Date(month);
        const monthsPassed = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
        
        if (monthsPassed > 0) {
          const monthlyDep = (asset.cost - asset.salvage_value) / (asset.useful_life * 12);
          const accumulated = Math.min(monthlyDep * monthsPassed, asset.cost - asset.salvage_value);
          const previousAccumulated = Math.min(monthlyDep * (monthsPassed - 1), asset.cost - asset.salvage_value);
          const thisMonthDep = accumulated - previousAccumulated;
          if (thisMonthDep > 0.01) totalDepreciation += thisMonthDep;
        }
      });

      if (totalDepreciation > 0) {
        const transaction = db.transaction(() => {
          const voucherId = generateVoucher({
            date: endDate,
            voucher_no: `计-${month.replace('-', '')}-001`,
            notes: `${month} 固定资产计提折旧`,
            lines: [
              { account_id: '540103', debit: totalDepreciation, credit: 0 }, // 制造费用 (结转到成本)
              { account_id: '1602', debit: 0, credit: totalDepreciation }, // 累计折旧
            ]
          });
          return voucherId;
        });
        const vid = transaction();
        res.json({ success: true, voucher_id: vid, amount: totalDepreciation });
      } else {
        res.json({ success: false, message: "本月无折旧计提" });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/cash-flow", (req, res) => {
    const { startDate, endDate } = req.query;
    const params = [startDate, endDate];

    // Operating Activities
    const salesCash = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE date BETWEEN ? AND ?").get(params).total || 0;
    const costCash = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE account_id LIKE '5401%' AND date BETWEEN ? AND ?").get(params).total || 0;
    const expenseCash = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE (account_id LIKE '6601%' OR account_id LIKE '6602%') AND date BETWEEN ? AND ?").get(params).total || 0;
    
    // Investing Activities
    const assetPurchase = db.prepare("SELECT SUM(cost) as total FROM fixed_assets WHERE acquisition_date BETWEEN ? AND ?").get(params).total || 0;

    res.json({
      operating: {
        in: salesCash,
        out: costCash + expenseCash,
        net: salesCash - (costCash + expenseCash)
      },
      investing: {
        in: 0,
        out: assetPurchase,
        net: -assetPurchase
      },
      net: salesCash - (costCash + expenseCash) - assetPurchase
    });
  });

  app.get("/api/financial-statements", (req, res) => {
    try {
      const accounts = db.prepare("SELECT * FROM accounts").all() as any[];
      const balances = accounts.map(acc => {
        const manualLines = db.prepare(`
          SELECT SUM(l.debit) as d, SUM(l.credit) as c 
          FROM journal_entry_lines l
          JOIN journal_entries e ON l.entry_id = e.id
          WHERE (l.account_id = ? OR l.account_id LIKE ?)
        `).get(acc.id, acc.id + '%') as any;

        let debit = manualLines.d || 0;
        let credit = manualLines.c || 0;

        // 包含未生成凭证的数据
        if (acc.id === '1122') {
          debit += db.prepare("SELECT SUM(total) as total FROM orders WHERE voucher_id IS NULL").get().total || 0;
          credit += db.prepare("SELECT SUM(amount) as total FROM incomes WHERE voucher_id IS NULL").get().total || 0;
        } else if (acc.id === '5001' || acc.id === '500101') {
          credit += db.prepare("SELECT SUM(total) as total FROM orders WHERE voucher_id IS NULL").get().total || 0;
        } else if (acc.id === '1001' || acc.id === '1002') {
          const type = acc.id === '1001' ? 'Cash' : 'Bank';
          debit += db.prepare("SELECT SUM(amount) as total FROM incomes WHERE voucher_id IS NULL AND method IN (SELECT name FROM payment_methods WHERE type = ?)").get(type).total || 0;
          credit += db.prepare("SELECT SUM(amount) as total FROM expenses WHERE voucher_id IS NULL AND method IN (SELECT name FROM payment_methods WHERE type = ?)").get(type).total || 0;
        } else if (acc.id === '2202') {
          credit += db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE voucher_id IS NULL").get().total || 0;
          debit += db.prepare("SELECT SUM(amount) as total FROM expenses WHERE voucher_id IS NULL AND supplier IS NOT NULL").get().total || 0;
        } else if (acc.type === 'cost' || acc.type === 'expense') {
          debit += db.prepare("SELECT SUM(amount) as total FROM expenses WHERE voucher_id IS NULL AND (account_id = ? OR account_id LIKE ?)").get(acc.id, acc.id + '%').total || 0;
        }

        const balance = (acc.type === 'asset' || acc.type === 'cost' || acc.type === 'expense') ? (debit - credit) : (credit - debit);
        return { ...acc, balance };
      });

      const getBalance = (id: string) => balances.find(b => b.id === id)?.balance || 0;
      const getSumByPrefix = (prefix: string) => balances.filter(b => b.id.startsWith(prefix)).reduce((acc, cur) => acc + (cur.type === 'asset' ? cur.balance : cur.balance), 0);

      const balanceSheet = {
        assets: {
          cash: getBalance('1001') + getBalance('1002'),
          receivable: getBalance('1122'),
          inventory: getSumByPrefix('14'),
          fixedAssets: getBalance('1601') - getBalance('1602'),
          total: getSumByPrefix('1')
        },
        liabilities: {
          payable: getBalance('2202'),
          taxPayable: getSumByPrefix('2221'),
          total: getSumByPrefix('2')
        },
        equity: {
          capital: getBalance('4001'),
          retainedEarnings: getBalance('410401') + getBalance('4103'),
          total: getSumByPrefix('4')
        }
      };

      const profitLoss = {
        revenue: getSumByPrefix('50'),
        cost: getSumByPrefix('54'),
        grossProfit: getSumByPrefix('50') - getSumByPrefix('54'),
        expenses: getSumByPrefix('66'),
        netProfit: getSumByPrefix('50') - getSumByPrefix('54') - getSumByPrefix('66')
      };

      res.json({ balanceSheet, profitLoss });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/dupont-metrics", (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7) + '-01';
      
      // 1. Revenue
      const revenue = db.prepare("SELECT SUM(total) as total FROM orders WHERE date <= ?").get(today).total || 0;
      
      // 2. Net Profit (Revenue - Cost - Expense)
      const cost = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE account_id LIKE '5401%' AND date <= ?").get(today).total || 0;
      const expense = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE (account_id LIKE '6601%' OR account_id LIKE '6602%' OR account_id LIKE '6603%') AND date <= ?").get(today).total || 0;
      const netProfit = revenue - cost - expense;
      
      // 3. Total Assets (Cash + Bank + Receivables + Inventory + Fixed Assets)
      const cash = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE method IN (SELECT name FROM payment_methods WHERE type = 'Cash')").get().total || 0 - db.prepare("SELECT SUM(amount) as total FROM expenses WHERE method IN (SELECT name FROM payment_methods WHERE type = 'Cash')").get().total || 0;
      const bank = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE method IN (SELECT name FROM payment_methods WHERE type = 'Bank' OR type = 'Digital')").get().total || 0 - db.prepare("SELECT SUM(amount) as total FROM expenses WHERE method IN (SELECT name FROM payment_methods WHERE type = 'Bank' OR type = 'Digital')").get().total || 0;
      const receivables = db.prepare("SELECT SUM(total) as total FROM orders").get().total || 0 - db.prepare("SELECT SUM(amount) as total FROM incomes").get().total || 0;
      const inventoryVal = db.prepare("SELECT SUM(stock * unit_cost) as total FROM inventory").get().total || 0;
      const fixedAssets = db.prepare("SELECT SUM(cost) as total FROM fixed_assets").get().total || 0;
      const accumulatedDep = 0; // Simplified for this call
      const totalAssets = Math.max(0, cash + bank + receivables + inventoryVal + fixedAssets - accumulatedDep);
      
      // 4. Equity (Total Assets - Liabilities)
      const payables = db.prepare("SELECT SUM(amount) as total FROM supplier_bills").get().total || 0 - db.prepare("SELECT SUM(amount) as total FROM expenses WHERE supplier IS NOT NULL").get().total || 0;
      const equity = totalAssets - Math.max(0, payables);
      
      res.json({
        revenue,
        netProfit,
        totalAssets,
        equity,
        netProfitMargin: revenue > 0 ? (netProfit / revenue) : 0,
        assetTurnover: totalAssets > 0 ? (revenue / totalAssets) : 0,
        equityMultiplier: equity > 0 ? (totalAssets / equity) : 1,
        roe: equity > 0 ? (netProfit / equity) : 0
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/multi-column-ledger/:parentId", (req, res) => {
    const { parentId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Get child accounts
    const children = db.prepare("SELECT id, name FROM accounts WHERE parent_id = ?").all(parentId) as any[];
    
    // Get all transactions for these children
    const placeholders = children.map(() => '?').join(',');
    const ids = children.map(c => c.id);
    
    let query = `
      SELECT date, notes, amount, account_id 
      FROM expenses 
      WHERE account_id IN (${placeholders})
    `;
    const params = [...ids];
    
    if (startDate && endDate) {
      query += " AND date BETWEEN ? AND ?";
      params.push(startDate as string, endDate as string);
    }
    
    const transactions = db.prepare(query + " ORDER BY date ASC").all(...params) as any[];
    
    // Group by date/notes to merge entries on the same day with same notes
    const grouped: any[] = [];
    transactions.forEach(t => {
      let existing = grouped.find(g => g.date === t.date && g.notes === t.notes);
      if (!existing) {
        existing = { date: t.date, notes: t.notes, columns: {} };
        grouped.push(existing);
      }
      existing.columns[t.account_id] = (existing.columns[t.account_id] || 0) + t.amount;
    });

    res.json({
      columns: children,
      data: grouped
    });
  });

  // Tax Report (Enhanced with Voucher Integration)
  app.get("/api/tax-report", (req, res) => {
    const { startDate, endDate } = req.query;
    const params = [startDate, endDate];
    
    // 1. 专业逻辑：基于会计科目 (2221) 的税务计算
    const taxBalances = db.prepare(`
      SELECT l.account_id, SUM(l.debit) as d, SUM(l.credit) as c 
      FROM journal_entry_lines l
      JOIN journal_entries e ON l.entry_id = e.id
      WHERE l.account_id LIKE '2221%' AND e.date BETWEEN ? AND ?
      GROUP BY l.account_id
    `).all(startDate, endDate) as any[];

    const outputVoucher = taxBalances.find(b => b.account_id === '222102')?.c || 0;
    const inputVoucher = taxBalances.find(b => b.account_id === '222101')?.d || 0;
    const paidVatVoucher = taxBalances.find(b => b.account_id === '2221')?.d || 0; // 已缴增值税

    // 2. 传统逻辑：基于业务单据的税务预估 (Invoiced Orders)
    const outputVatDoc = db.prepare("SELECT SUM(total * tax_rate / (100 + tax_rate)) as total FROM orders WHERE invoiced = 1 AND date BETWEEN ? AND ?").get(params).total || 0;
    const inputVatDoc = db.prepare("SELECT SUM(amount * tax_rate / (100 + tax_rate)) as total FROM expenses WHERE date BETWEEN ? AND ?").get(params).total || 0;
    
    // 3. 利润预估 (EIT estimation)
    const totalSales = db.prepare("SELECT SUM(total) as total FROM orders WHERE date BETWEEN ? AND ?").get(params).total || 0;
    const totalCost = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN ? AND ?").get(params).total || 0;
    const estimatedProfit = totalSales - totalCost;
    
    res.json({
      vat: {
        output: outputVoucher || outputVatDoc,
        input: inputVoucher || inputVatDoc,
        payable: (outputVoucher || outputVatDoc) - (inputVoucher || inputVatDoc) - paidVatVoucher,
        audit: {
          voucherBased: !!(outputVoucher || inputVoucher),
          docBased: true
        }
      },
      eit: {
        profit: estimatedProfit,
        estimate: Math.max(0, estimatedProfit * 0.25) // Standard 25% CIT
      }
    });
  });

  // Profit Distributions
  app.get("/api/profit-distributions", (req, res) => {
    const data = db.prepare("SELECT * FROM profit_distributions ORDER BY date DESC").all();
    res.json(data);
  });

  app.post("/api/profit-distributions", (req, res) => {
    const { date, amount, type, notes } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法录入分配" });
    try {
      const info = db.prepare("INSERT INTO profit_distributions (date, amount, type, notes) VALUES (?, ?, ?, ?)").run(date, amount, type, notes);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/orders/:id/invoice", (req, res) => {
    const { invoice_no, invoice_date } = req.body;
    try {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as any;
      if (order && isPeriodClosed(order.date)) return res.status(403).json({ error: "该月份已结账，无法修改开票信息" });
      db.prepare("UPDATE orders SET invoice_no = ?, invoice_date = ? WHERE id = ?").run(invoice_no, invoice_date, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(session({
    secret: "xiaokuaiji-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true 
    }
  }));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`
  );

  // Google Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      prompt: "consent"
    });
    res.json({ url });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("google_tokens", JSON.stringify(tokens));
      
      res.send(`
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Google Drive 连接成功</title>
            <style>
              body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
              .card { background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
              h1 { color: #10b981; margin-top: 0; }
              p { color: #64748b; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>✓ 连接成功</h1>
              <p>Google Drive 已成功连接！窗口即将自动关闭。</p>
            </div>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/google/status", (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("google_tokens") as any;
    res.json({ connected: !!row });
  });

  app.post("/api/backup/google-drive", async (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("google_tokens") as any;
    if (!row) return res.status(401).json({ error: "Google Drive not connected" });

    const tokens = JSON.parse(row.value);
    oauth2Client.setCredentials(tokens);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
      const fileName = `xiaokuaiji_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const filePath = path.join(__dirname, "xiaokuaiji.db");

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: "application/x-sqlite3",
        },
        media: {
          mimeType: "application/x-sqlite3",
          body: fs.createReadStream(filePath),
        },
      });

      res.json({ success: true, fileId: response.data.id });
    } catch (error) {
      console.error("Google Drive Upload Error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  const logAction = (action: string, details: string) => {
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO audit_logs (timestamp, action, details) VALUES (?, ?, ?)").run(timestamp, action, details);
  };

  // API Routes
  app.get("/api/audit-logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  });
  app.get("/api/stats", (req, res) => {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];

    const totalIncome = db.prepare("SELECT SUM(amount) as total FROM incomes").get().total || 0;
    const totalExpense = db.prepare("SELECT SUM(amount) as total FROM expenses").get().total || 0;
    const totalOrder = db.prepare("SELECT SUM(total) as total FROM orders").get().total || 0;
    const totalSupplierBill = db.prepare("SELECT SUM(amount) as total FROM supplier_bills").get().total || 0;
    
    const profit = totalOrder - totalExpense;
    const totalReceivable = totalOrder - totalIncome;
    const totalPayable = totalSupplierBill - totalExpense;
    const currentMonthIncome = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE date >= ?").get(currentMonthStart).total || 0;
    const currentMonthExpense = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date >= ?").get(currentMonthStart).total || 0;
    const currentMonthOrder = db.prepare("SELECT SUM(total) as total FROM orders WHERE date >= ?").get(currentMonthStart).total || 0;

    // Previous Month Stats
    const prevMonthIncome = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE date >= ? AND date <= ?").get(prevMonthStart, prevMonthEnd).total || 0;
    const prevMonthExpense = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ?").get(prevMonthStart, prevMonthEnd).total || 0;
    const prevMonthOrder = db.prepare("SELECT SUM(total) as total FROM orders WHERE date >= ? AND date <= ?").get(prevMonthStart, prevMonthEnd).total || 0;

    const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders").get().count;
    const outsourceCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE outsource != '' AND outsource IS NOT NULL").get().count;
    const inventoryAlerts = db.prepare("SELECT COUNT(*) as count FROM inventory WHERE stock < low_threshold").get().count;
    
    // Unvouchered counts for audit
    const unvoucheredOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE voucher_id IS NULL").get().count;
    const unvoucheredIncomes = db.prepare("SELECT COUNT(*) as count FROM incomes WHERE voucher_id IS NULL").get().count;
    const unvoucheredExpenses = db.prepare("SELECT COUNT(*) as count FROM expenses WHERE voucher_id IS NULL").get().count;
    const unvoucheredBills = db.prepare("SELECT COUNT(*) as count FROM supplier_bills WHERE voucher_id IS NULL").get().count;
    
    // Aging calculation
    const getAgingBucket = (days: number) => {
      const date = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return date;
    };

    const d30 = getAgingBucket(30);
    const d60 = getAgingBucket(60);
    const d90 = getAgingBucket(90);

    const agingBuckets = {
      "0-30天": db.prepare("SELECT SUM(total) as total FROM orders WHERE date >= ?").get(d30).total || 0,
      "31-60天": db.prepare("SELECT SUM(total) as total FROM orders WHERE date < ? AND date >= ?").get(d30, d60).total || 0,
      "61-90天": db.prepare("SELECT SUM(total) as total FROM orders WHERE date < ? AND date >= ?").get(d60, d90).total || 0,
      "90天+": db.prepare("SELECT SUM(total) as total FROM orders WHERE date < ?").get(d90).total || 0,
    };

    // Subtract income from oldest buckets first
    let remainingIncome = totalIncome;
    const sortedBuckets = ["90天+", "61-90天", "31-60天", "0-30天"];
    const aging: any = { ...agingBuckets };
    
    for (const bucket of sortedBuckets) {
      const bucketVal = aging[bucket];
      if (remainingIncome >= bucketVal) {
        remainingIncome -= bucketVal;
        aging[bucket] = 0;
      } else {
        aging[bucket] = bucketVal - remainingIncome;
        remainingIncome = 0;
      }
    }

    res.json({
      totalIncome,
      totalExpense,
      profit,
      totalReceivable,
      totalPayable,
      orderCount,
      outsourceCount,
      inventoryAlerts,
      unvouchered: {
        orders: unvoucheredOrders,
        incomes: unvoucheredIncomes,
        expenses: unvoucheredExpenses,
        bills: unvoucheredBills,
        total: unvoucheredOrders + unvoucheredIncomes + unvoucheredExpenses + unvoucheredBills
      },
      aging,
      mom: {
        income: prevMonthIncome ? ((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100 : 0,
        expense: prevMonthExpense ? ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100 : 0,
        order: prevMonthOrder ? ((currentMonthOrder - prevMonthOrder) / prevMonthOrder) * 100 : 0,
        profit: (prevMonthOrder - prevMonthExpense) ? (((currentMonthOrder - currentMonthExpense) - (prevMonthOrder - prevMonthExpense)) / (prevMonthOrder - prevMonthExpense)) * 100 : 0
      }
    });
  });

  app.get("/api/monthly-trend", (req, res) => {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7)); // YYYY-MM
    }

    const trend = months.map(month => {
      const income = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE date LIKE ?").get(`${month}%`).total || 0;
      const expense = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date LIKE ?").get(`${month}%`).total || 0;
      const order = db.prepare("SELECT SUM(total) as total FROM orders WHERE date LIKE ?").get(`${month}%`).total || 0;
      return { month, income, expense, order };
    });

    res.json(trend);
  });

  app.get("/api/cashflow-prediction", (req, res) => {
    // Simple prediction: average income/expense of last 3 months
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().split('T')[0];
    
    const avgIncome = (db.prepare("SELECT SUM(amount) as total FROM incomes WHERE date >= ?").get(threeMonthsAgo).total || 0) / 3;
    const avgExpense = (db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date >= ?").get(threeMonthsAgo).total || 0) / 3;
    
    // Predicted receivable collection (based on aging 0-30 days)
    const d30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentReceivable = db.prepare("SELECT SUM(total) as total FROM orders WHERE date >= ?").get(d30).total || 0;
    
    res.json({
      predictedIncome: avgIncome,
      predictedExpense: avgExpense,
      predictedCollection: currentReceivable * 0.7, // Assume 70% collection rate
      netFlow: (avgIncome + currentReceivable * 0.7) - avgExpense
    });
  });

  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY name").all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { name, pinyin } = req.body;
    try {
      const info = db.prepare("INSERT OR IGNORE INTO customers (name, pinyin) VALUES (?, ?)").run(name, pinyin || null);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/suppliers", (req, res) => {
    const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY name").all();
    res.json(suppliers);
  });

  app.post("/api/suppliers", (req, res) => {
    const { name, pinyin } = req.body;
    try {
      const info = db.prepare("INSERT OR IGNORE INTO suppliers (name) VALUES (?)").run(name);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY name").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, spec, pinyin, unit, default_price } = req.body;
    try {
      const info = db.prepare("INSERT OR IGNORE INTO products (name, spec, pinyin, unit, default_price) VALUES (?, ?, ?, ?, ?)").run(name, spec || null, pinyin || null, unit, default_price);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/orders", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const orders = db.prepare("SELECT * FROM orders ORDER BY date DESC, id DESC LIMIT ? OFFSET ?").all(limit, offset);
    const total = db.prepare("SELECT COUNT(*) as count FROM orders").get().count;
    
    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  app.post("/api/orders", (req, res) => {
    const { date, customer, product, spec, qty, unit, price, total, outsource, notes, fixture_loss, attachment_url, invoiced, tax_rate } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法新增数据" });
    try {
      db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(customer);
      const info = db.prepare("INSERT INTO orders (date, customer, product, spec, qty, unit, price, total, outsource, notes, fixture_loss, attachment_url, invoiced, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(date, customer, product, spec || null, qty, unit, price, total, outsource, notes, fixture_loss || 0, attachment_url || null, invoiced || 0, tax_rate || 0);
      logAction("新增订单", `客户: ${customer}, 产品: ${product}, 金额: ${total}`);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/orders/batch", (req, res) => {
    const { date, customer, items } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法新增数据" });
    try {
      db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(customer);
      const insert = db.prepare("INSERT INTO orders (date, customer, product, spec, qty, unit, price, total, outsource, notes, fixture_loss, attachment_url, invoiced, tax_rate, status, worker) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      
      const transaction = db.transaction((orderItems) => {
        for (const item of orderItems) {
          insert.run(date, customer, item.product, item.spec || null, item.qty, item.unit, item.price, item.total, item.outsource, item.notes, item.fixture_loss || 0, item.attachment_url || null, item.invoiced || 0, item.tax_rate || 0, item.status || '待产', item.worker || null);
        }
      });
      
      transaction(items);
      logAction("批量录单", `客户: ${customer}, 笔数: ${items.length}`);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/orders/batch-update", (req, res) => {
    const { ids, updates } = req.body;
    // For batch update, we need to check if any of the orders are in closed periods
    try {
      const ordersToCheck = db.prepare(`SELECT date FROM orders WHERE id IN (${ids.map(() => '?').join(',')})`).all(ids) as any[];
      if (ordersToCheck.some(o => isPeriodClosed(o.date))) {
        return res.status(403).json({ error: "部分订单所属月份已结账，无法批量更新" });
      }

      const keys = Object.keys(updates);
      const setClause = keys.map(k => `${k} = ?`).join(", ");
      const values = keys.map(k => updates[k]);
      
      const stmt = db.prepare(`UPDATE orders SET ${setClause} WHERE id = ?`);
      const transaction = db.transaction((orderIds) => {
        for (const id of orderIds) {
          stmt.run(...values, id);
        }
      });
      transaction(ids);
      logAction("批量更新订单", `更新笔数: ${ids.length}, 字段: ${keys.join(", ")}`);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/incomes", (req, res) => {
    const incomes = db.prepare("SELECT * FROM incomes ORDER BY date DESC").all();
    res.json(incomes);
  });

  app.post("/api/incomes", (req, res) => {
    const { date, customer, amount, bank, notes } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法新增收款" });
    try {
      db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(customer);
      const info = db.prepare("INSERT INTO incomes (date, customer, amount, bank, notes) VALUES (?, ?, ?, ?, ?)").run(date, customer, amount, bank, notes);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/expenses", (req, res) => {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    res.json(expenses);
  });

  app.post("/api/expenses", (req, res) => {
    const { date, category, supplier, amount, method, notes, account_id } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法新增支出" });
    try {
      db.prepare("INSERT OR IGNORE INTO suppliers (name) VALUES (?)").run(supplier);
      const info = db.prepare("INSERT INTO expenses (date, category, supplier, amount, method, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(date, category, supplier, amount, method, notes, account_id);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete/Update Endpoints
  app.delete("/api/orders/:id", (req, res) => {
    try {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as any;
      if (order && isPeriodClosed(order.date)) return res.status(403).json({ error: "该月份已结账，无法删除数据" });
      db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
      logAction("删除订单", `ID: ${req.params.id}, 客户: ${order?.customer}, 金额: ${order?.total}`);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/orders/:id/invoiced", (req, res) => {
    const { invoiced } = req.body;
    try {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as any;
      if (order && isPeriodClosed(order.date)) return res.status(403).json({ error: "该月份已结账，无法修改数据" });
      db.prepare("UPDATE orders SET invoiced = ? WHERE id = ?").run(invoiced ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { status } = req.body;
    try {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as any;
      if (order && isPeriodClosed(order.date)) return res.status(403).json({ error: "该月份已结账，无法修改数据" });
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/orders/:id/reconciled", (req, res) => {
    const { reconciled } = req.body;
    try {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as any;
      if (order && isPeriodClosed(order.date)) return res.status(403).json({ error: "该月份已结账，无法修改数据" });
      db.prepare("UPDATE orders SET reconciled = ? WHERE id = ?").run(reconciled, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/wage-report", (req, res) => {
    const { startDate, endDate } = req.query;
    const wages = db.prepare(`
      SELECT worker, SUM(qty) as total_qty, COUNT(*) as order_count 
      FROM orders 
      WHERE date >= ? AND date <= ? AND worker IS NOT NULL AND worker != ''
      GROUP BY worker
    `).all(startDate, endDate);
    res.json(wages);
  });

  app.delete("/api/incomes/:id", (req, res) => {
    try {
      const income = db.prepare("SELECT * FROM incomes WHERE id = ?").get(req.params.id) as any;
      if (income && isPeriodClosed(income.date)) return res.status(403).json({ error: "该月份已结账，无法删除数据" });
      db.prepare("DELETE FROM incomes WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/expenses/:id", (req, res) => {
    try {
      const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id) as any;
      if (expense && isPeriodClosed(expense.date)) return res.status(403).json({ error: "该月份已结账，无法删除数据" });
      db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/customers/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/suppliers/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/low-stock", (req, res) => {
    const items = db.prepare("SELECT * FROM inventory WHERE stock < low_threshold").all();
    res.json(items);
  });

  app.get("/api/production-summary", (req, res) => {
    const summary = db.prepare(`
      SELECT status, COUNT(*) as count, SUM(qty) as total_qty 
      FROM orders 
      GROUP BY status
    `).all();
    res.json(summary);
  });

  // Basic Data Management APIs
  app.get("/api/categories", (req, res) => {
    const { type } = req.query;
    if (type) {
      res.json(db.prepare("SELECT * FROM categories WHERE type = ?").all(type));
    } else {
      res.json(db.prepare("SELECT * FROM categories").all());
    }
  });

  app.post("/api/categories", (req, res) => {
    const { name, type } = req.body;
    try {
      db.prepare("INSERT INTO categories (name, type) VALUES (?, ?)").run(name, type);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/categories/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/payment-methods", (req, res) => {
    res.json(db.prepare("SELECT * FROM payment_methods").all());
  });

  app.post("/api/payment-methods", (req, res) => {
    const { name } = req.body;
    try {
      db.prepare("INSERT INTO payment_methods (name) VALUES (?)").run(name);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/payment-methods/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM payment_methods WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Accounts Endpoints
  app.get("/api/accounts", (req, res) => {
    const accounts = db.prepare("SELECT * FROM accounts ORDER BY id").all();
    res.json(accounts);
  });

  app.post("/api/accounts", (req, res) => {
    const { id, name, type, category, parent_id } = req.body;
    try {
      db.prepare("INSERT INTO accounts (id, name, type, category, parent_id) VALUES (?, ?, ?, ?, ?)").run(id, name, type, category, parent_id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/accounts/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM accounts WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/supplier-bills", (req, res) => {
    const bills = db.prepare("SELECT * FROM supplier_bills ORDER BY date DESC").all();
    res.json(bills);
  });

  app.post("/api/supplier-bills", (req, res) => {
    const { date, supplier, category, amount, notes } = req.body;
    if (isPeriodClosed(date)) return res.status(403).json({ error: "该月份已结账，无法新增供应商账单" });
    try {
      db.prepare("INSERT OR IGNORE INTO suppliers (name) VALUES (?)").run(supplier);
      const info = db.prepare("INSERT INTO supplier_bills (date, supplier, category, amount, notes) VALUES (?, ?, ?, ?, ?)").run(date, supplier, category, amount, notes);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/supplier-bills/:id", (req, res) => {
    try {
      const bill = db.prepare("SELECT * FROM supplier_bills WHERE id = ?").get(req.params.id) as any;
      if (bill && isPeriodClosed(bill.date)) return res.status(403).json({ error: "该月份已结账，无法删除供应商账单" });
      db.prepare("DELETE FROM supplier_bills WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Inventory Endpoints
  app.get("/api/inventory", (req, res) => {
    const items = db.prepare("SELECT * FROM inventory ORDER BY name").all();
    res.json(items);
  });

  app.get("/api/inventory-valuation", (req, res) => {
    const data = db.prepare("SELECT SUM(stock * unit_cost) as totalValue FROM inventory").get();
    res.json({ totalValue: data.totalValue || 0 });
  });

  app.get("/api/inventory/transactions", (req, res) => {
    const transactions = db.prepare("SELECT * FROM inventory_transactions ORDER BY timestamp DESC LIMIT 200").all();
    res.json(transactions);
  });

  app.get("/api/yearly-summary", (req, res) => {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear().toString();
    
    const monthlyData = db.prepare(`
      WITH months AS (
        SELECT '01' as m UNION SELECT '02' UNION SELECT '03' UNION SELECT '04' UNION 
        SELECT '05' UNION SELECT '06' UNION SELECT '07' UNION SELECT '08' UNION 
        SELECT '09' UNION SELECT '10' UNION SELECT '11' UNION SELECT '12'
      )
      SELECT 
        m.m as month,
        COALESCE((SELECT SUM(total) FROM orders WHERE strftime('%Y-%m', date) = ? || '-' || m.m), 0) as sales,
        COALESCE((SELECT SUM(amount) FROM incomes WHERE strftime('%Y-%m', date) = ? || '-' || m.m), 0) as income,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE strftime('%Y-%m', date) = ? || '-' || m.m), 0) as expense
      FROM months m
      ORDER BY m.m
    `).all(targetYear, targetYear, targetYear);
    
    res.json(monthlyData);
  });

  app.get("/api/pl-statement", (req, res) => {
    const { startDate, endDate } = req.query;
    
    const calculatePL = (start: string, end: string) => {
      const income = db.prepare("SELECT SUM(total) as total FROM orders WHERE date BETWEEN ? AND ?").get(start, end).total || 0;
      const cost = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE account_id LIKE '5401%' AND date BETWEEN ? AND ?").get(start, end).total || 0;
      const expense = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE (account_id LIKE '6601%' OR account_id LIKE '6602%') AND date BETWEEN ? AND ?").get(start, end).total || 0;
      return { income, cost, expense, profit: income - cost - expense };
    };

    const current = calculatePL(startDate as string, endDate as string);
    
    // Compare with same period last month
    const curStart = new Date(startDate as string);
    const curEnd = new Date(endDate as string);
    const prevStart = new Date(curStart.getFullYear(), curStart.getMonth() - 1, curStart.getDate()).toISOString().split('T')[0];
    const prevEnd = new Date(curEnd.getFullYear(), curEnd.getMonth() - 1, curEnd.getDate()).toISOString().split('T')[0];
    const previous = calculatePL(prevStart, prevEnd);

    res.json({ current, previous });
  });

  app.post("/api/inventory", (req, res) => {
    const { name, stock, unit, low_threshold, unit_cost } = req.body;
    try {
      const info = db.prepare("INSERT OR REPLACE INTO inventory (name, stock, unit, low_threshold, unit_cost) VALUES (?, ?, ?, ?, ?)").run(name, stock, unit, low_threshold, unit_cost || 0);
      db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, ?, ?, ?)").run(name, new Date().toISOString(), "盘点", stock, "初始入库/手动调整");
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/inventory/:id/stock", (req, res) => {
    const { delta, type, notes } = req.body;
    try {
      const item = db.prepare("SELECT name FROM inventory WHERE id = ?").get(req.params.id);
      db.prepare("UPDATE inventory SET stock = stock + ? WHERE id = ?").run(delta, req.params.id);
      db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, ?, ?, ?)").run(item.name, new Date().toISOString(), type || (delta > 0 ? "入库" : "出库"), delta, notes || "");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Backup & Import
  app.get("/api/backup", (req, res) => {
    const data = {
      customers: db.prepare("SELECT * FROM customers").all(),
      suppliers: db.prepare("SELECT * FROM suppliers").all(),
      products: db.prepare("SELECT * FROM products").all(),
      orders: db.prepare("SELECT * FROM orders").all(),
      incomes: db.prepare("SELECT * FROM incomes").all(),
      expenses: db.prepare("SELECT * FROM expenses").all(),
      supplier_bills: db.prepare("SELECT * FROM supplier_bills").all(),
      inventory: db.prepare("SELECT * FROM inventory").all(),
      inventory_transactions: db.prepare("SELECT * FROM inventory_transactions").all(),
      audit_logs: db.prepare("SELECT * FROM audit_logs").all(),
    };
    res.json(data);
  });

  app.post("/api/import", (req, res) => {
    const { type, data } = req.body;
    try {
      if (type === "products") {
        const insert = db.prepare("INSERT OR REPLACE INTO products (name, unit, default_price) VALUES (?, ?, ?)");
        const transaction = db.transaction((items) => {
          for (const item of items) {
            insert.run(item.name, item.unit, item.default_price);
          }
        });
        transaction(data);
        logAction("批量导入产品", `导入数量: ${data.length}`);
      } else if (type === "inventory") {
        const insert = db.prepare("INSERT OR REPLACE INTO inventory (name, stock, unit, low_threshold) VALUES (?, ?, ?, ?)");
        const log = db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, ?, ?, ?)");
        const transaction = db.transaction((items) => {
          for (const item of items) {
            insert.run(item.name, item.stock, item.unit, item.low_threshold);
            log.run(item.name, new Date().toISOString(), "入库", item.stock, "Excel 批量导入");
          }
        });
        transaction(data);
        logAction("批量导入库存", `导入数量: ${data.length}`);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Archive Endpoints
  app.get("/api/archives", (req, res) => {
    const archives = db.prepare("SELECT * FROM archives ORDER BY month DESC").all();
    res.json(archives);
  });

  app.post("/api/archives", (req, res) => {
    const { month } = req.body;
    const archived_at = new Date().toISOString();
    try {
      db.prepare("INSERT INTO archives (month, archived_at) VALUES (?, ?)").run(month, archived_at);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/customers/:name/balance", (req, res) => {
    const { name } = req.params;
    const row = db.prepare(`
      SELECT 
        (SELECT credit_limit FROM customers WHERE name = ?) as credit_limit,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer = ?) - 
        (SELECT COALESCE(SUM(amount), 0) FROM incomes WHERE customer = ?) as balance
    `).get(name, name, name) as any;
    res.json(row || { credit_limit: 0, balance: 0 });
  });

  app.get("/api/credit-alerts", (req, res) => {
    const alerts = db.prepare(`
      SELECT c.id, c.name, c.credit_limit, 
             (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer = c.name) - 
             (SELECT COALESCE(SUM(amount), 0) FROM incomes WHERE customer = c.name) as balance
      FROM customers c
      WHERE c.credit_limit > 0 AND balance > c.credit_limit
    `).all();
    res.json(alerts);
  });

  app.get("/api/bank-balances", (req, res) => {
    const balances = db.prepare(`
      SELECT bank, SUM(amount) as balance 
      FROM (
        SELECT bank, amount FROM incomes
        UNION ALL
        SELECT method as bank, -amount FROM expenses
      )
      GROUP BY bank
    `).all();
    res.json(balances);
  });

  app.get("/api/overdue", (req, res) => {
    const overdue = db.prepare(`
      SELECT customer, (SUM(total) - COALESCE((SELECT SUM(amount) FROM incomes i WHERE i.customer = orders.customer), 0)) as debt
      FROM orders
      GROUP BY customer
      HAVING debt > 5000
    `).all();
    res.json(overdue);
  });

  app.get("/api/top-products", (req, res) => {
    const top = db.prepare(`
      SELECT product, SUM(total) as total
      FROM orders
      GROUP BY product
      ORDER BY total DESC
      LIMIT 5
    `).all();
    res.json(top);
  });

  app.get("/api/last-price", (req, res) => {
    const { customer, product } = req.query;
    if (!customer || !product) return res.status(400).json({ error: "Missing params" });
    
    const lastOrder = db.prepare(`
      SELECT price, unit, date 
      FROM orders 
      WHERE customer = ? AND product = ? 
      ORDER BY date DESC, id DESC 
      LIMIT 1
    `).get(customer, product);
    
    res.json(lastOrder || null);
  });

  app.get("/api/price-history", (req, res) => {
    const { product } = req.query;
    if (!product) return res.status(400).json({ error: "Missing product" });
    
    const history = db.prepare(`
      SELECT date, price, customer
      FROM orders 
      WHERE product = ? 
      ORDER BY date DESC 
      LIMIT 20
    `).all(product);
    
    res.json(history);
  });

  app.post("/api/bulk-price-update", (req, res) => {
    const { percentage } = req.body;
    if (typeof percentage !== "number") return res.status(400).json({ error: "Invalid percentage" });
    
    try {
      const factor = 1 + (percentage / 100);
      db.prepare("UPDATE products SET default_price = ROUND(default_price * ?, 2)").run(factor);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/mock-data", (req, res) => {
    try {
      db.exec("DELETE FROM orders; DELETE FROM incomes; DELETE FROM expenses; DELETE FROM customers; DELETE FROM suppliers; DELETE FROM products;");
      
      const custs = ["佛山精工铝业", "南海五金加工厂", "顺德型材贸易公司", "中山汽配制造", "江门灯饰配件厂"];
      const sups = ["东莞三酸化工", "佛山片碱贸易", "顺德挂具模具厂", "外发喷砂抛光中心"];
      custs.forEach(c => db.prepare("INSERT INTO customers (name) VALUES (?)").run(c));
      sups.forEach(s => db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(s));
      
      const prod_list = [
        ["铝型材黑氧化", "米长", 2.5], ["五金阳极氧化", "件", 0.8], ["铝板拉丝氧化", "平方米", 45.0],
        ["汽配彩色氧化", "只", 1.5], ["挂具氧化", "个", 0.5], ["型材抛光氧化", "条", 12.0], ["铝型材米重氧化", "公斤", 3.5]
      ];
      prod_list.forEach(p => db.prepare("INSERT INTO products (name, unit, default_price) VALUES (?, ?, ?)").run(...p));
      
      const units = ["件", "条", "只", "个", "米长", "米重", "公斤", "平方米"];
      const cats = ["三酸", "片碱", "亚钠", "色粉", "除油剂", "挂具", "外发加工", "房租", "水电", "工资", "日常"];
      const banks = ["G银行（有票）", "N银行（现金）", "微信（现金）"];

      const inv_list = [
        ["三酸", 1200, "kg", 300],
        ["片碱", 450, "kg", 100],
        ["亚钠", 680, "kg", 150],
        ["色粉", 320, "kg", 80]
      ];
      inv_list.forEach(i => db.prepare("INSERT INTO inventory (name, stock, unit, low_threshold) VALUES (?, ?, ?, ?)").run(...i));
      
      const today = new Date();
      for (let i = 0; i < 150; i++) {
        const cust = custs[i % 5];
        const unit = units[i % 7];
        const qty = parseFloat((Math.random() * 1195 + 5).toFixed(1));
        const price = parseFloat((Math.random() * 196 + 4).toFixed(1));
        const total = parseFloat((qty * price).toFixed(2));
        const outsource = ["喷砂", "拉丝", "抛光", "", ""][Math.floor(Math.random() * 5)];
        const dateStr = new Date(today.getTime() - Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        db.prepare("INSERT INTO orders (date, customer, product, qty, unit, price, total, outsource, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(dateStr, cust, `产品${i % 8}`, qty, unit, price, total, outsource, "测试");
      }
      
      for (let i = 0; i < 50; i++) {
        const dateStr = new Date(today.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        db.prepare("INSERT INTO incomes (date, customer, amount, bank, notes) VALUES (?, ?, ?, ?, ?)").run(dateStr, custs[i % 5], parseFloat((Math.random() * 14500 + 500).toFixed(2)), banks[i % 3], "批量加工费");
      }
      
      for (let i = 0; i < 40; i++) {
        const dateStr = new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        db.prepare("INSERT INTO expenses (date, category, supplier, amount, method, notes) VALUES (?, ?, ?, ?, ?, ?)").run(dateStr, cats[i % 11], sups[i % 4], parseFloat((Math.random() * 6800 + 200).toFixed(2)), "转账", "正常支出");
      }

      for (let i = 0; i < 30; i++) {
        const dateStr = new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        db.prepare("INSERT INTO supplier_bills (date, supplier, category, amount, notes) VALUES (?, ?, ?, ?, ?)").run(dateStr, sups[i % 4], cats[i % 7], parseFloat((Math.random() * 8000 + 500).toFixed(2)), "采购入库");
      }
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fixed Assets Endpoints
  app.get("/api/fixed-assets", (req, res) => {
    const assets = db.prepare("SELECT * FROM fixed_assets ORDER BY acquisition_date DESC").all();
    res.json(assets);
  });

  app.post("/api/fixed-assets", (req, res) => {
    const { name, acquisition_date, cost, depreciation_method, useful_life, salvage_value } = req.body;
    if (isPeriodClosed(acquisition_date)) return res.status(403).json({ error: "该月份已结账，无法录入固定资产" });
    try {
      const info = db.prepare("INSERT INTO fixed_assets (name, acquisition_date, cost, depreciation_method, useful_life, salvage_value) VALUES (?, ?, ?, ?, ?, ?)").run(name, acquisition_date, cost, depreciation_method, useful_life, salvage_value);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/fixed-assets/:id", (req, res) => {
    try {
      const asset = db.prepare("SELECT * FROM fixed_assets WHERE id = ?").get(req.params.id) as any;
      if (asset && isPeriodClosed(asset.acquisition_date)) return res.status(403).json({ error: "该月份已结账，无法删除固定资产" });
      db.prepare("DELETE FROM fixed_assets WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/balance-sheet", (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];
    
    const calculateBS = (endDate: string) => {
      // Assets
      const cash = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE date <= ?").get(endDate).total || 0;
      const expenseTotal = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date <= ?").get(endDate).total || 0;
      const currentCash = cash - expenseTotal;
      
      const totalOrder = db.prepare("SELECT SUM(total) as total FROM orders WHERE date <= ?").get(endDate).total || 0;
      const accountsReceivable = totalOrder - cash;
      const inventoryValue = db.prepare("SELECT SUM(stock * unit_cost) as total FROM inventory").get().total || 0;
      
      const assetsList = db.prepare("SELECT * FROM fixed_assets WHERE acquisition_date <= ?").all(endDate) as any[];
      const today = new Date(endDate);
      let fixedAssetsNetValue = 0;
      
      assetsList.forEach(asset => {
        const start = new Date(asset.acquisition_date);
        const monthsPassed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
        if (monthsPassed <= 0) {
          fixedAssetsNetValue += asset.cost;
        } else {
          const monthlyDepreciation = (asset.cost - asset.salvage_value) / (asset.useful_life * 12);
          const accumulatedDepreciation = Math.min(monthlyDepreciation * monthsPassed, asset.cost - asset.salvage_value);
          fixedAssetsNetValue += (asset.cost - accumulatedDepreciation);
        }
      });

      // Liabilities
      const totalSupplierBill = db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE date <= ?").get(endDate).total || 0;
      const paidToSuppliers = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE supplier IS NOT NULL AND supplier != '' AND date <= ?").get(endDate).total || 0;
      const accountsPayable = totalSupplierBill - paidToSuppliers;

      return {
        assets: {
          cash: currentCash,
          receivable: accountsReceivable,
          inventory: inventoryValue,
          fixedAssets: fixedAssetsNetValue,
          total: currentCash + accountsReceivable + inventoryValue + fixedAssetsNetValue
        },
        liabilities: {
          payable: accountsPayable,
          total: accountsPayable
        },
        equity: {
          total: (currentCash + accountsReceivable + inventoryValue + fixedAssetsNetValue) - accountsPayable
        }
      };
    };

    const current = calculateBS(targetDate);
    // Previous period (last month end)
    const d = new Date(targetDate);
    const prevDate = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
    const previous = calculateBS(prevDate);

    res.json({ current, previous });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.get("/api/expense-breakdown", (req, res) => {
    const data = db.prepare("SELECT category as name, SUM(amount) as value FROM expenses GROUP BY category").all();
    res.json(data);
  });

  app.get("/api/health-check", (req, res) => {
    const negativeInventory = db.prepare("SELECT COUNT(*) as count FROM inventory WHERE stock < 0").get().count;
    const zeroPriceOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE total = 0").get().count;
    const overdueReceivables = db.prepare("SELECT COUNT(*) as count FROM orders WHERE date < date('now', '-90 days') AND invoiced = 0").get().count;
    res.json({ negativeInventory, zeroPriceOrders, overdueReceivables });
  });

  app.get("/api/worker-leaderboard", (req, res) => {
    const data = db.prepare(`
      SELECT worker as name, SUM(qty) as totalQty, COUNT(*) as orderCount 
      FROM orders 
      WHERE worker IS NOT NULL AND worker != '' 
      GROUP BY worker 
      ORDER BY totalQty DESC 
      LIMIT 5
    `).all();
    res.json(data);
  });

  app.get("/api/payable-aging", (req, res) => {
    const today = new Date();
    const getAgingBucket = (days: number) => {
      const date = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return date;
    };

    const d30 = getAgingBucket(30);
    const d60 = getAgingBucket(60);
    const d90 = getAgingBucket(90);

    const totalPaid = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE supplier IS NOT NULL AND supplier != ''").get().total || 0;
    
    const buckets = {
      "0-30天": db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE date >= ?").get(d30).total || 0,
      "31-60天": db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE date < ? AND date >= ?").get(d30, d60).total || 0,
      "61-90天": db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE date < ? AND date >= ?").get(d60, d90).total || 0,
      "90天+": db.prepare("SELECT SUM(amount) as total FROM supplier_bills WHERE date < ?").get(d90).total || 0,
    };

    let remainingPaid = totalPaid;
    const sortedBuckets = ["90天+", "61-90天", "31-60天", "0-30天"];
    const aging: any = { ...buckets };
    
    for (const bucket of sortedBuckets) {
      const bucketVal = aging[bucket];
      if (remainingPaid >= bucketVal) {
        remainingPaid -= bucketVal;
        aging[bucket] = 0;
      } else {
        aging[bucket] -= remainingPaid;
        remainingPaid = 0;
      }
    }

    const chartData = Object.entries(aging).map(([name, value]) => ({ name, value }));
    res.json(chartData);
  });

  app.get("/api/receivable-aging", (req, res) => {
    const today = new Date();
    const getAgingBucket = (days: number) => {
      const date = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return date;
    };

    const d30 = getAgingBucket(30);
    const d60 = getAgingBucket(60);
    const d90 = getAgingBucket(90);

    const totalReceived = db.prepare("SELECT SUM(amount) as total FROM incomes WHERE customer IS NOT NULL AND customer != ''").get().total || 0;
    
    const buckets = {
      "0-30天": db.prepare("SELECT SUM(total) as total FROM orders WHERE date >= ?").get(d30).total || 0,
      "31-60天": db.prepare("SELECT SUM(total) as total FROM orders WHERE date < ? AND date >= ?").get(d30, d60).total || 0,
      "61-90天": db.prepare("SELECT SUM(total) as total FROM orders WHERE date < ? AND date >= ?").get(d60, d90).total || 0,
      "90天+": db.prepare("SELECT SUM(total) as total FROM orders WHERE date < ?").get(d90).total || 0,
    };

    let remainingReceived = totalReceived;
    const sortedBuckets = ["90天+", "61-90天", "31-60天", "0-30天"];
    const aging: any = { ...buckets };

    for (const bucket of sortedBuckets) {
      const bucketVal = aging[bucket];
      if (remainingReceived >= bucketVal) {
        remainingReceived -= bucketVal;
        aging[bucket] = 0;
      } else {
        aging[bucket] -= remainingReceived;
        remainingReceived = 0;
      }
    }

    const chartData = Object.entries(aging).map(([name, value]) => ({ name, value }));
    res.json(chartData);
  });

  app.get("/api/search", (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json({ orders: [], customers: [], products: [] });
    const pattern = `%${q}%`;
    const orders = db.prepare("SELECT * FROM orders WHERE customer LIKE ? OR product LIKE ? OR notes LIKE ? ORDER BY date DESC LIMIT 10").all(pattern, pattern, pattern);
    const customers = db.prepare("SELECT * FROM customers WHERE name LIKE ? LIMIT 10").all(pattern);
    const products = db.prepare("SELECT * FROM products WHERE name LIKE ? LIMIT 10").all(pattern);
    res.json({ orders, customers, products });
  });

  app.get("/api/material-requisitions", (req, res) => {
    const data = db.prepare("SELECT * FROM material_requisitions ORDER BY date DESC").all();
    res.json(data);
  });

  app.post("/api/material-requisitions", (req, res) => {
    const { date, item_name, qty, worker, notes } = req.body;
    db.prepare("INSERT INTO material_requisitions (date, item_name, qty, worker, notes) VALUES (?, ?, ?, ?, ?)").run(date, item_name, qty, worker, notes);
    // Deduct from inventory
    db.prepare("UPDATE inventory SET stock = stock - ? WHERE name = ?").run(qty, item_name);
    db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, '领料', ?, ?)")
      .run(item_name, new Date().toISOString(), -qty, `领料人: ${worker}, 备注: ${notes}`);
    logAction("领料录入", `领料项目: ${item_name}, 数量: ${qty}, 领料人: ${worker}`);
    res.json({ success: true });
  });

  app.patch("/api/customers/:id/credit-limit", (req, res) => {
    const { id } = req.params;
    const { credit_limit } = req.body;
    db.prepare("UPDATE customers SET credit_limit = ? WHERE id = ?").run(credit_limit, id);
    res.json({ success: true });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
