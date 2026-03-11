import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SubsidiaryAccountingService } from '../SubsidiaryAccountingService.js';

describe('SubsidiaryAccountingService', () => {
  let db: Database.Database;
  let service: SubsidiaryAccountingService;

  beforeEach(() => {
    // 创建内存数据库用于测试
    db = new Database(':memory:');
    
    // 创建必要的表结构
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        parent_id TEXT,
        level INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        auxiliary_types TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        voucher_no TEXT UNIQUE NOT NULL,
        voucher_type TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'draft',
        source_type TEXT,
        source_id INTEGER,
        created_by TEXT,
        approved_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT
      );

      CREATE TABLE voucher_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        line_no INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        auxiliary_data TEXT,
        notes TEXT,
        FOREIGN KEY(voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
        FOREIGN KEY(account_id) REFERENCES accounts(id)
      );

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        credit_limit REAL DEFAULT 0
      );

      CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        stock REAL DEFAULT 0,
        unit TEXT,
        low_threshold REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0
      );
    `);

    // 插入测试数据
    db.prepare("INSERT INTO accounts (id, name, type, category, level) VALUES (?, ?, ?, ?, ?)").run(
      '1122', '应收账款', 'asset', '资产类', 1
    );
    db.prepare("INSERT INTO accounts (id, name, type, category, level) VALUES (?, ?, ?, ?, ?)").run(
      '2202', '应付账款', 'liability', '负债类', 1
    );
    db.prepare("INSERT INTO accounts (id, name, type, category, level) VALUES (?, ?, ?, ?, ?)").run(
      '1405', '库存商品', 'asset', '资产类', 1
    );

    db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(1, '客户A');
    db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(2, '客户B');
    db.prepare("INSERT INTO suppliers (id, name) VALUES (?, ?)").run(1, '供应商A');
    db.prepare("INSERT INTO inventory (id, name, unit) VALUES (?, ?, ?)").run(1, '产品A', '件');

    service = new SubsidiaryAccountingService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getSubsidiaryLedger', () => {
    it('应该返回空的辅助核算明细账（无交易）', () => {
      const ledger = service.getSubsidiaryLedger(
        '1122',
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(ledger).toBeDefined();
      expect(ledger.account_id).toBe('1122');
      expect(ledger.auxiliary_type).toBe('customer');
      expect(ledger.auxiliary_id).toBe(1);
      expect(ledger.auxiliary_name).toBe('客户A');
      expect(ledger.opening_balance).toBe(0);
      expect(ledger.closing_balance).toBe(0);
      expect(ledger.transactions).toHaveLength(0);
    });

    it('应该正确计算客户应收账款明细账', () => {
      // 创建测试凭证
      const voucherId = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'sales', '销售凭证', 'approved').lastInsertRowid;

      // 添加凭证分录（借：应收账款 1000）
      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      const ledger = service.getSubsidiaryLedger(
        '1122',
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(ledger.opening_balance).toBe(0);
      expect(ledger.transactions).toHaveLength(1);
      expect(ledger.transactions[0].debit).toBe(1000);
      expect(ledger.transactions[0].credit).toBe(0);
      expect(ledger.transactions[0].balance).toBe(1000);
      expect(ledger.closing_balance).toBe(1000);
    });

    it('应该正确计算期初余额', () => {
      // 创建期初凭证（2023-12-15）
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2023-12-15', 'V-001', 'sales', '期初销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '1122', 500, 0, JSON.stringify({ customer_id: 1 }));

      // 创建期间内凭证（2024-01-15）
      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-002', 'sales', '本期销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      const ledger = service.getSubsidiaryLedger(
        '1122',
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(ledger.opening_balance).toBe(500); // 期初余额
      expect(ledger.transactions).toHaveLength(1); // 只包含期间内交易
      expect(ledger.closing_balance).toBe(1500); // 期初 + 本期
    });

    it('应该正确处理借贷方向', () => {
      // 创建销售凭证（借方）
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-10', 'V-001', 'sales', '销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      // 创建收款凭证（贷方）
      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-20', 'V-002', 'receipt', '收款', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '1122', 0, 600, JSON.stringify({ customer_id: 1 }));

      const ledger = service.getSubsidiaryLedger(
        '1122',
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(ledger.transactions).toHaveLength(2);
      expect(ledger.transactions[0].balance).toBe(1000); // 第一笔后余额
      expect(ledger.transactions[1].balance).toBe(400);  // 第二笔后余额（1000 - 600）
      expect(ledger.closing_balance).toBe(400);
    });
  });

  describe('getCustomerLedger', () => {
    it('应该返回客户应收账款明细账', () => {
      const voucherId = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'sales', '销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      const ledger = service.getCustomerLedger(1, '2024-01-01', '2024-01-31');

      expect(ledger.account_id).toBe('1122');
      expect(ledger.auxiliary_type).toBe('customer');
      expect(ledger.auxiliary_id).toBe(1);
      expect(ledger.transactions).toHaveLength(1);
    });
  });

  describe('getSupplierLedger', () => {
    it('应该返回供应商应付账款明细账', () => {
      const voucherId = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'purchase', '采购', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId, 1, '2202', 0, 2000, JSON.stringify({ supplier_id: 1 }));

      const ledger = service.getSupplierLedger(1, '2024-01-01', '2024-01-31');

      expect(ledger.account_id).toBe('2202');
      expect(ledger.auxiliary_type).toBe('supplier');
      expect(ledger.auxiliary_id).toBe(1);
      expect(ledger.transactions).toHaveLength(1);
    });
  });

  describe('getAllCustomerBalances', () => {
    it('应该返回所有客户的应收账款汇总', () => {
      // 客户A的凭证
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'sales', '销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      // 客户B的凭证
      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-20', 'V-002', 'sales', '销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '1122', 500, 0, JSON.stringify({ customer_id: 2 }));

      const balances = service.getAllCustomerBalances('2024-01-31');

      expect(balances).toHaveLength(2);
      expect(balances[0].customer_id).toBe(1);
      expect(balances[0].balance).toBe(1000);
      expect(balances[1].customer_id).toBe(2);
      expect(balances[1].balance).toBe(500);
    });

    it('应该排除余额为零的客户', () => {
      // 客户A：借1000，贷1000，余额为0
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'sales', '销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-20', 'V-002', 'receipt', '收款', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '1122', 0, 1000, JSON.stringify({ customer_id: 1 }));

      const balances = service.getAllCustomerBalances('2024-01-31');

      expect(balances).toHaveLength(0); // 余额为0的客户不显示
    });
  });

  describe('generateReconciliationStatement', () => {
    beforeEach(() => {
      // 创建测试用的业务单据表
      db.exec(`
        CREATE TABLE orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_no TEXT UNIQUE NOT NULL,
          customer_id INTEGER,
          total REAL,
          voucher_id INTEGER
        );

        CREATE TABLE incomes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          income_no TEXT UNIQUE NOT NULL,
          customer_id INTEGER,
          amount REAL,
          voucher_id INTEGER
        );

        CREATE TABLE supplier_bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bill_no TEXT UNIQUE NOT NULL,
          supplier_id INTEGER,
          amount REAL,
          voucher_id INTEGER
        );

        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_no TEXT UNIQUE NOT NULL,
          supplier_id INTEGER,
          amount REAL,
          voucher_id INTEGER
        );
      `);
    });

    it('应该生成客户往来对账单', () => {
      // 创建销售订单
      db.prepare("INSERT INTO orders (id, order_no, customer_id, total) VALUES (?, ?, ?, ?)").run(
        1, 'SO-001', 1, 1000
      );

      // 创建销售凭证
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'sales', '销售', 'approved', 'order', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      // 创建收款记录
      db.prepare("INSERT INTO incomes (id, income_no, customer_id, amount) VALUES (?, ?, ?, ?)").run(
        1, 'IN-001', 1, 600
      );

      // 创建收款凭证
      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('2024-01-20', 'V-002', 'receipt', '收款', 'approved', 'income', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '1122', 0, 600, JSON.stringify({ customer_id: 1 }));

      const statement = service.generateReconciliationStatement(
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(statement.type).toBe('customer');
      expect(statement.entity_id).toBe(1);
      expect(statement.entity_name).toBe('客户A');
      expect(statement.opening_balance).toBe(0);
      expect(statement.transactions).toHaveLength(2);
      
      // 第一笔：销售订单
      expect(statement.transactions[0].type).toBe('销售订单');
      expect(statement.transactions[0].reference_no).toContain('SO-001');
      expect(statement.transactions[0].debit).toBe(1000);
      expect(statement.transactions[0].credit).toBe(0);
      expect(statement.transactions[0].balance).toBe(1000);
      
      // 第二笔：收款
      expect(statement.transactions[1].type).toBe('收款');
      expect(statement.transactions[1].reference_no).toContain('IN-001');
      expect(statement.transactions[1].debit).toBe(0);
      expect(statement.transactions[1].credit).toBe(600);
      expect(statement.transactions[1].balance).toBe(400);
      
      // 验证属性35：期末余额 = 期初余额 + 借方 - 贷方
      expect(statement.closing_balance).toBe(400);
      expect(statement.closing_balance).toBe(
        statement.opening_balance + 1000 - 600
      );
    });

    it('应该生成供应商往来对账单', () => {
      // 创建采购账单
      db.prepare("INSERT INTO supplier_bills (id, bill_no, supplier_id, amount) VALUES (?, ?, ?, ?)").run(
        1, 'PB-001', 1, 2000
      );

      // 创建采购凭证
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('2024-01-10', 'V-001', 'purchase', '采购', 'approved', 'supplier_bill', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '2202', 0, 2000, JSON.stringify({ supplier_id: 1 }));

      // 创建付款记录
      db.prepare("INSERT INTO expenses (id, expense_no, supplier_id, amount) VALUES (?, ?, ?, ?)").run(
        1, 'EX-001', 1, 1200
      );

      // 创建付款凭证
      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('2024-01-25', 'V-002', 'payment', '付款', 'approved', 'expense', 1).lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '2202', 1200, 0, JSON.stringify({ supplier_id: 1 }));

      const statement = service.generateReconciliationStatement(
        'supplier',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(statement.type).toBe('supplier');
      expect(statement.entity_id).toBe(1);
      expect(statement.entity_name).toBe('供应商A');
      expect(statement.opening_balance).toBe(0);
      expect(statement.transactions).toHaveLength(2);
      
      // 第一笔：采购账单（贷方，增加应付）
      expect(statement.transactions[0].type).toBe('采购账单');
      expect(statement.transactions[0].reference_no).toContain('PB-001');
      expect(statement.transactions[0].debit).toBe(0);
      expect(statement.transactions[0].credit).toBe(2000);
      expect(statement.transactions[0].balance).toBe(-2000); // 应付账款贷方余额为负
      
      // 第二笔：付款（借方，减少应付）
      expect(statement.transactions[1].type).toBe('付款');
      expect(statement.transactions[1].reference_no).toContain('EX-001');
      expect(statement.transactions[1].debit).toBe(1200);
      expect(statement.transactions[1].credit).toBe(0);
      expect(statement.transactions[1].balance).toBe(-800); // 剩余应付 800
      
      // 验证属性35：期末余额 = 期初余额 + 借方 - 贷方
      expect(statement.closing_balance).toBe(-800);
      expect(statement.closing_balance).toBe(
        statement.opening_balance + 1200 - 2000
      );
    });

    it('应该正确计算期初余额', () => {
      // 创建期初销售（2023-12-15）
      const voucherId1 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2023-12-15', 'V-001', 'sales', '期初销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId1, 1, '1122', 500, 0, JSON.stringify({ customer_id: 1 }));

      // 创建本期销售（2024-01-15）
      const voucherId2 = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-002', 'sales', '本期销售', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId2, 1, '1122', 1000, 0, JSON.stringify({ customer_id: 1 }));

      const statement = service.generateReconciliationStatement(
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(statement.opening_balance).toBe(500);
      expect(statement.transactions).toHaveLength(1); // 只包含本期交易
      expect(statement.closing_balance).toBe(1500);
    });

    it('应该处理无源单据的手工凭证', () => {
      // 创建手工凭证（无源单据）
      const voucherId = db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('2024-01-15', 'V-001', 'manual', '手工调整', 'approved').lastInsertRowid;

      db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(voucherId, 1, '1122', 100, 0, JSON.stringify({ customer_id: 1 }));

      const statement = service.generateReconciliationStatement(
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(statement.transactions).toHaveLength(1);
      expect(statement.transactions[0].type).toBe('手工凭证');
      expect(statement.transactions[0].reference_no).toBe('V-001'); // 只显示凭证号
    });

    it('应该验证属性35：期末余额计算准确性', () => {
      // 创建多笔交易
      const transactions = [
        { date: '2024-01-05', debit: 1000, credit: 0 },
        { date: '2024-01-10', debit: 0, credit: 300 },
        { date: '2024-01-15', debit: 500, credit: 0 },
        { date: '2024-01-20', debit: 0, credit: 400 },
        { date: '2024-01-25', debit: 200, credit: 0 }
      ];

      transactions.forEach((tx, index) => {
        const voucherId = db.prepare(`
          INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(tx.date, `V-${String(index + 1).padStart(3, '0')}`, 'sales', '交易', 'approved').lastInsertRowid;

        db.prepare(`
          INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(voucherId, 1, '1122', tx.debit, tx.credit, JSON.stringify({ customer_id: 1 }));
      });

      const statement = service.generateReconciliationStatement(
        'customer',
        1,
        '2024-01-01',
        '2024-01-31'
      );

      // 计算总借方和总贷方
      const total_debit = transactions.reduce((sum, tx) => sum + tx.debit, 0);
      const total_credit = transactions.reduce((sum, tx) => sum + tx.credit, 0);

      // 验证属性35：期末余额 = 期初余额 + 借方 - 贷方
      expect(statement.closing_balance).toBe(
        statement.opening_balance + total_debit - total_credit
      );
      expect(statement.closing_balance).toBe(1000); // 0 + 1700 - 700
    });
  });
});
