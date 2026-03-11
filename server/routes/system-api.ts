import express from "express";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置存储逻辑
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

/**
 * 系统级 API 路由
 */
export function createSystemRoutes(db: Database.Database, dbPath?: string) {
  const router = express.Router();

  // ============================================================================
  // 文件上传 (Uploads)
  // ============================================================================

  router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "未上传文件" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  });

  // ============================================================================
  // 仪表盘统计 (Stats)
  // ============================================================================

  router.get("/stats", (req, res) => {
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
    const inventoryAlerts = db.prepare("SELECT COUNT(*) as count FROM inventory WHERE stock < low_threshold").get().count;
    
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
      totalIncome, totalExpense, profit, totalReceivable, totalPayable,
      orderCount, inventoryAlerts, aging,
      mom: {
        income: prevMonthIncome ? ((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100 : 0,
        expense: prevMonthExpense ? ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100 : 0,
        order: prevMonthOrder ? ((currentMonthOrder - prevMonthOrder) / prevMonthOrder) * 100 : 0,
      }
    });
  });

  router.get("/monthly-trend", (req, res) => {
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

  router.get("/health-check", (req, res) => {
    const negativeInventory = db.prepare("SELECT COUNT(*) as count FROM inventory WHERE stock < 0").get().count;
    const zeroPriceOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE total = 0").get().count;
    const overdueReceivables = db.prepare("SELECT COUNT(*) as count FROM orders WHERE date < date('now', '-90 days') AND invoiced = 0").get().count;
    res.json({ negativeInventory, zeroPriceOrders, overdueReceivables });
  });

  router.get("/worker-leaderboard", (req, res) => {
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

  router.get("/expense-breakdown", (req, res) => {
    const data = db.prepare("SELECT category as name, SUM(amount) as value FROM expenses GROUP BY category").all();
    res.json(data);
  });

  router.get("/receivable-aging", (req, res) => {
    const today = new Date();
    const getAgingBucket = (days: number) => {
      const date = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return date;
    };

    const d30 = getAgingBucket(30);
    const d60 = getAgingBucket(60);
    const d90 = getAgingBucket(90);

    const totalReceived = db.prepare("SELECT SUM(amount) as total FROM incomes").get().total || 0;
    
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

  router.get("/payable-aging", (req, res) => {
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

  // ============================================================================
  // 审计日志 (Audit Logs)
  // ============================================================================

  router.get("/audit-logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  });

  // ============================================================================
  // 数据备份 (Backup)
  // ============================================================================

  router.get("/backup/export", (req, res) => {
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
      accounts: db.prepare("SELECT * FROM accounts").all(),
      vouchers: db.prepare("SELECT * FROM vouchers").all(),
      voucher_lines: db.prepare("SELECT * FROM voucher_lines").all()
    };
    res.json(data);
  });

  // ============================================================================
  // 系统设置 (Settings)
  // ============================================================================

  router.get("/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const result: any = {};
    settings.forEach((s: any) => result[s.key] = s.value);
    res.json(result);
  });

  router.post("/settings", (req, res) => {
    const { key, value } = req.body;
    try {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, typeof value === 'string' ? value : JSON.stringify(value));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
