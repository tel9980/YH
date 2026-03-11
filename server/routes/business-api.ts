import express from "express";
import Database from "better-sqlite3";
import { createPeriodLockMiddleware } from "../middleware/periodLock.js";

/**
 * 核心业务 API 路由
 * 处理客户、供应商、产品、订单、收支及库存
 */
export function createBusinessRoutes(db: Database.Database) {
  const router = express.Router();
  
  // 挂载期间锁定中间件，保护业务数据
  router.use(createPeriodLockMiddleware(db));

  // ============================================================================
  // 客户与供应商管理 (Contacts)
  // ============================================================================

  router.get("/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY name").all();
    res.json(customers);
  });

  router.post("/customers", (req, res) => {
    const { name, pinyin } = req.body;
    try {
      const info = db.prepare("INSERT OR IGNORE INTO customers (name, pinyin) VALUES (?, ?)").run(name, pinyin || null);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/customers/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/suppliers", (req, res) => {
    const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY name").all();
    res.json(suppliers);
  });

  router.post("/suppliers", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT OR IGNORE INTO suppliers (name) VALUES (?)").run(name);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/suppliers/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================================
  // 产品管理 (Products)
  // ============================================================================

  router.get("/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY name").all();
    res.json(products);
  });

  router.post("/products", (req, res) => {
    const { name, spec, pinyin, unit, default_price } = req.body;
    try {
      const info = db.prepare("INSERT OR IGNORE INTO products (name, spec, pinyin, unit, default_price) VALUES (?, ?, ?, ?, ?)").run(name, spec || null, pinyin || null, unit, default_price);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/products/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================================
  // 订单管理 (Orders)
  // ============================================================================

  router.get("/orders", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const orders = db.prepare("SELECT * FROM orders ORDER BY date DESC, id DESC LIMIT ? OFFSET ?").all(limit, offset);
    const total = db.prepare("SELECT COUNT(*) as count FROM orders").get().count;
    
    res.json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  });

  router.post("/orders", (req, res) => {
    const { date, customer, product, spec, qty, unit, price, total, outsource, notes, tax_rate } = req.body;
    try {
      db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(customer);
      const info = db.prepare(`
        INSERT INTO orders (date, customer, product, spec, qty, unit, price, total, outsource, notes, tax_rate) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(date, customer, product, spec || null, qty, unit, price, total, outsource, notes, tax_rate || 0);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/orders/batch", (req, res) => {
    const { date, customer, items } = req.body;
    try {
      db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(customer);
      const insert = db.prepare(`
        INSERT INTO orders (date, customer, product, spec, qty, unit, price, total, outsource, notes, tax_rate, status, worker) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const transaction = db.transaction((orderItems) => {
        for (const item of orderItems) {
          insert.run(date, customer, item.product, item.spec || null, item.qty, item.unit, item.price, item.total, item.outsource, item.notes, item.tax_rate || 0, item.status || '待产', item.worker || null);
        }
      });
      
      transaction(items);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/orders/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/orders/:id/status", (req, res) => {
    const { status } = req.body;
    try {
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================================
  // 收支管理 (Incomes & Expenses)
  // ============================================================================

  router.get("/incomes", (req, res) => {
    const incomes = db.prepare("SELECT * FROM incomes ORDER BY date DESC").all();
    res.json(incomes);
  });

  router.post("/incomes", (req, res) => {
    const { date, customer, amount, bank, notes } = req.body;
    try {
      db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)").run(customer);
      const info = db.prepare("INSERT INTO incomes (date, customer, amount, bank, notes) VALUES (?, ?, ?, ?, ?)").run(date, customer, amount, bank, notes);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/incomes/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM incomes WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/expenses", (req, res) => {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    res.json(expenses);
  });

  router.post("/expenses", (req, res) => {
    const { date, category, supplier, amount, method, notes, account_id } = req.body;
    try {
      db.prepare("INSERT OR IGNORE INTO suppliers (name) VALUES (?)").run(supplier);
      const info = db.prepare("INSERT INTO expenses (date, category, supplier, amount, method, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(date, category, supplier, amount, method, notes, account_id);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/expenses/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================================
  // 库存管理 (Inventory)
  // ============================================================================

  router.get("/inventory", (req, res) => {
    const items = db.prepare("SELECT * FROM inventory ORDER BY name").all();
    res.json(items);
  });

  router.post("/inventory", (req, res) => {
    const { name, stock, unit, low_threshold, unit_cost } = req.body;
    try {
      const info = db.prepare("INSERT OR REPLACE INTO inventory (name, stock, unit, low_threshold, unit_cost) VALUES (?, ?, ?, ?, ?)").run(name, stock, unit, low_threshold, unit_cost || 0);
      db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, ?, ?, ?)").run(name, new Date().toISOString(), "盘点", stock, "初始入库/手动调整");
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/inventory/:id/stock", (req, res) => {
    const { delta, type, notes } = req.body;
    try {
      const item = db.prepare("SELECT name FROM inventory WHERE id = ?").get(req.params.id) as any;
      db.prepare("UPDATE inventory SET stock = stock + ? WHERE id = ?").run(delta, req.params.id);
      db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, ?, ?, ?)").run(item.name, new Date().toISOString(), type || (delta > 0 ? "入库" : "出库"), delta, notes || "");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/inventory/transactions", (req, res) => {
    const transactions = db.prepare("SELECT * FROM inventory_transactions ORDER BY timestamp DESC LIMIT 200").all();
    res.json(transactions);
  });

  // ============================================================================
  // 领料管理 (Material Requisitions)
  // ============================================================================

  router.get("/material-requisitions", (req, res) => {
    const data = db.prepare("SELECT * FROM material_requisitions ORDER BY date DESC").all();
    res.json(data);
  });

  router.post("/material-requisitions", (req, res) => {
    const { date, item_name, qty, worker, notes } = req.body;
    try {
      const transaction = db.transaction(() => {
        db.prepare("INSERT INTO material_requisitions (date, item_name, qty, worker, notes) VALUES (?, ?, ?, ?, ?)").run(date, item_name, qty, worker, notes);
        // 从库存扣除
        db.prepare("UPDATE inventory SET stock = stock - ? WHERE name = ?").run(qty, item_name);
        db.prepare("INSERT INTO inventory_transactions (item_name, timestamp, type, delta, notes) VALUES (?, ?, '领料', ?, ?)")
          .run(item_name, new Date().toISOString(), -qty, `领料人: ${worker}, 备注: ${notes}`);
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================================
  // 全局搜索 (Search)
  // ============================================================================

  router.get("/search", (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json({ orders: [], customers: [], products: [] });
    const pattern = `%${q}%`;
    const orders = db.prepare("SELECT * FROM orders WHERE customer LIKE ? OR product LIKE ? OR notes LIKE ? ORDER BY date DESC LIMIT 10").all(pattern, pattern, pattern);
    const customers = db.prepare("SELECT * FROM customers WHERE name LIKE ? LIMIT 10").all(pattern);
    const products = db.prepare("SELECT * FROM products WHERE name LIKE ? LIMIT 10").all(pattern);
    res.json({ orders, customers, products });
  });

  return router;
}
