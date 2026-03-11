import Database from "better-sqlite3";
import { CostAccountingService } from "../CostAccountingService.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("CostAccountingService - Production Order Cost Allocation", () => {
  let db: Database.Database;
  let service: CostAccountingService;

  beforeEach(() => {
    // 创建内存数据库用于测试
    db = new Database(":memory:");

    // 创建必要的表结构
    db.exec(`
      CREATE TABLE production_orders (
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        total_quantity REAL DEFAULT 0
      );

      CREATE TABLE inventory_transactions (
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT
      );
    `);

    service = new CostAccountingService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("createProductionOrder", () => {
    it("应该成功创建生产订单", () => {
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-001",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      expect(orderId).toBeGreaterThan(0);

      const order = service.getProductionOrder(orderId);
      expect(order).toBeDefined();
      expect(order?.order_no).toBe("PO-2024-001");
      expect(order?.quantity).toBe(100);
    });
  });

  describe("allocateMaterialCost", () => {
    it("应该成功归集材料成本到生产订单", () => {
      // 创建生产订单
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-001",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      // 创建库存项目
      const itemResult = db.prepare(`
        INSERT INTO inventory (name, quantity, total_cost, total_quantity)
        VALUES (?, ?, ?, ?)
      `).run("原材料A", 1000, 10000, 1000);
      const itemId = itemResult.lastInsertRowid as number;

      // 归集材料成本
      service.allocateMaterialCost(orderId, itemId, 50, 10);

      // 验证生产订单成本更新
      const order = service.getProductionOrder(orderId);
      expect(order?.actual_material_cost).toBe(500); // 50 * 10
      expect(order?.actual_total_cost).toBe(500);

      // 验证库存减少
      const inventory = db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
      expect(inventory.quantity).toBe(950); // 1000 - 50
      expect(inventory.total_cost).toBe(9500); // 10000 - 500

      // 验证库存事务记录
      const transactions = db.prepare(`
        SELECT * FROM inventory_transactions 
        WHERE reference_type = 'production_order' AND reference_id = ?
      `).all(orderId);
      expect(transactions).toHaveLength(1);
    });

    it("应该在库存不足时抛出错误", () => {
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-002",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      const itemResult = db.prepare(`
        INSERT INTO inventory (name, quantity, total_cost, total_quantity)
        VALUES (?, ?, ?, ?)
      `).run("原材料B", 10, 100, 10);
      const itemId = itemResult.lastInsertRowid as number;

      // 尝试领用超过库存的数量
      expect(() => {
        service.allocateMaterialCost(orderId, itemId, 50, 10);
      }).toThrow("库存数量不足");
    });

    it("应该在订单已关闭时抛出错误", () => {
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-003",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "closed",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      const itemResult = db.prepare(`
        INSERT INTO inventory (name, quantity, total_cost, total_quantity)
        VALUES (?, ?, ?, ?)
      `).run("原材料C", 100, 1000, 100);
      const itemId = itemResult.lastInsertRowid as number;

      expect(() => {
        service.allocateMaterialCost(orderId, itemId, 10, 10);
      }).toThrow("生产订单已关闭");
    });
  });

  describe("allocateLaborCost", () => {
    it("应该成功归集人工成本到生产订单", () => {
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-004",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      // 归集人工成本
      service.allocateLaborCost(orderId, 2000, "计件工资");

      // 验证生产订单成本更新
      const order = service.getProductionOrder(orderId);
      expect(order?.actual_labor_cost).toBe(2000);
      expect(order?.actual_total_cost).toBe(2000);

      // 验证审计日志
      const logs = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE action = 'labor_cost_allocated'
      `).all();
      expect(logs).toHaveLength(1);
    });

    it("应该支持多次归集人工成本", () => {
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-005",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      // 第一次归集
      service.allocateLaborCost(orderId, 1000, "第一批工资");
      // 第二次归集
      service.allocateLaborCost(orderId, 1500, "第二批工资");

      // 验证累计成本
      const order = service.getProductionOrder(orderId);
      expect(order?.actual_labor_cost).toBe(2500); // 1000 + 1500
      expect(order?.actual_total_cost).toBe(2500);
    });

    it("应该在人工成本为负数或零时抛出错误", () => {
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-006",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      expect(() => {
        service.allocateLaborCost(orderId, 0);
      }).toThrow("人工成本必须大于0");

      expect(() => {
        service.allocateLaborCost(orderId, -100);
      }).toThrow("人工成本必须大于0");
    });
  });

  describe("getProductionOrderCostDetails", () => {
    it("应该返回生产订单的完整成本明细", () => {
      // 创建生产订单
      const orderId = service.createProductionOrder({
        order_no: "PO-2024-007",
        product_id: 1,
        quantity: 100,
        start_date: "2024-01-01",
        status: "in_progress",
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_overhead_cost: 0,
        actual_total_cost: 0
      });

      // 创建库存并归集材料
      const itemResult = db.prepare(`
        INSERT INTO inventory (name, quantity, total_cost, total_quantity)
        VALUES (?, ?, ?, ?)
      `).run("原材料D", 1000, 10000, 1000);
      const itemId = itemResult.lastInsertRowid as number;
      service.allocateMaterialCost(orderId, itemId, 50, 10);

      // 归集人工成本
      service.allocateLaborCost(orderId, 2000, "计件工资");

      // 获取成本明细
      const details = service.getProductionOrderCostDetails(orderId);

      expect(details).toBeDefined();
      expect(details?.order.actual_material_cost).toBe(500);
      expect(details?.order.actual_labor_cost).toBe(2000);
      expect(details?.order.actual_total_cost).toBe(2500);
      expect(details?.materialTransactions).toHaveLength(1);
      expect(details?.laborAllocations).toHaveLength(1);
    });
  });
});
