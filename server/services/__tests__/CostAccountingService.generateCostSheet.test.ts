import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CostAccountingService } from "../CostAccountingService.js";
import fs from "fs";

describe("CostAccountingService - generateCostSheet", () => {
  let db: Database.Database;
  let service: CostAccountingService;

  beforeEach(() => {
    // 创建内存数据库用于测试
    db = new Database(":memory:");

    // 创建必要的表结构
    db.exec(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT,
        price REAL
      );

      CREATE TABLE product_costs (
        product_id INTEGER PRIMARY KEY,
        costing_method TEXT DEFAULT 'actual',
        standard_material_cost REAL DEFAULT 0,
        standard_labor_cost REAL DEFAULT 0,
        standard_overhead_cost REAL DEFAULT 0,
        standard_total_cost REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

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
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
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

      CREATE TABLE overhead_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        method TEXT NOT NULL,
        total_overhead REAL NOT NULL,
        allocation_details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE cost_variances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        material_price_variance REAL DEFAULT 0,
        material_quantity_variance REAL DEFAULT 0,
        labor_efficiency_variance REAL DEFAULT 0,
        overhead_variance REAL DEFAULT 0,
        total_variance REAL DEFAULT 0,
        variance_rate REAL DEFAULT 0,
        processed BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 插入测试数据
    db.prepare("INSERT INTO products (id, name, unit, price) VALUES (?, ?, ?, ?)").run(
      1,
      "测试产品A",
      "件",
      100
    );

    db.prepare("INSERT INTO inventory (id, name, quantity, unit_cost, total_cost, total_quantity) VALUES (?, ?, ?, ?, ?, ?)").run(
      1,
      "原材料A",
      1000,
      10,
      10000,
      1000
    );

    service = new CostAccountingService(db);
  });

  afterEach(() => {
    db.close();
  });

  it("应该生成完整的生产成本计算单", () => {
    // 1. 创建生产订单
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-001",
      product_id: 1,
      quantity: 100,
      start_date: "2024-01-15",
      status: "in_progress",
      actual_material_cost: 0,
      actual_labor_cost: 0,
      actual_overhead_cost: 0,
      actual_total_cost: 0
    });

    // 2. 归集材料成本
    service.allocateMaterialCost(orderId, 1, 50, 10);

    // 3. 归集人工成本
    service.allocateLaborCost(orderId, 2000, "计件工资");

    // 4. 更新制造费用
    service.updateProductionOrderCost(orderId, { overhead: 1000 });

    // 5. 生成成本计算单
    const costSheet = service.generateCostSheet(orderId);

    // 验证基本信息
    expect(costSheet.order).toBeDefined();
    expect(costSheet.order.order_no).toBe("PO-2024-001");
    expect(costSheet.product).toBeDefined();
    expect(costSheet.product.name).toBe("测试产品A");

    // 验证成本归集
    expect(costSheet.costAccumulation.material.total).toBe(500); // 50 * 10
    expect(costSheet.costAccumulation.material.transactions).toHaveLength(1);
    expect(costSheet.costAccumulation.material.transactions[0].itemName).toBe("原材料A");
    expect(costSheet.costAccumulation.material.transactions[0].quantity).toBe(50);
    expect(costSheet.costAccumulation.material.transactions[0].unitCost).toBe(10);
    expect(costSheet.costAccumulation.material.transactions[0].totalCost).toBe(500);

    expect(costSheet.costAccumulation.labor.total).toBe(2000);
    expect(costSheet.costAccumulation.labor.allocations).toHaveLength(1);
    expect(costSheet.costAccumulation.labor.allocations[0].amount).toBe(2000);

    expect(costSheet.costAccumulation.overhead.total).toBe(1000);

    // 验证成本汇总
    expect(costSheet.costSummary.totalMaterialCost).toBe(500);
    expect(costSheet.costSummary.totalLaborCost).toBe(2000);
    expect(costSheet.costSummary.totalOverheadCost).toBe(1000);
    expect(costSheet.costSummary.totalCost).toBe(3500);
    expect(costSheet.costSummary.unitCost).toBe(35); // 3500 / 100

    // 验证生成时间
    expect(costSheet.generatedAt).toBeDefined();
    expect(new Date(costSheet.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("应该在成本计算单中包含标准成本对比（使用标准成本法）", () => {
    // 1. 设置产品标准成本
    service.setProductCost(1, {
      costing_method: "standard",
      standard_material_cost: 6,
      standard_labor_cost: 15,
      standard_overhead_cost: 9,
      standard_total_cost: 30
    });

    // 2. 创建生产订单
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-002",
      product_id: 1,
      quantity: 100,
      start_date: "2024-01-15",
      status: "in_progress",
      actual_material_cost: 0,
      actual_labor_cost: 0,
      actual_overhead_cost: 0,
      actual_total_cost: 0
    });

    // 3. 归集实际成本
    service.allocateMaterialCost(orderId, 1, 50, 10); // 实际材料成本 500
    service.allocateLaborCost(orderId, 2000); // 实际人工成本 2000
    service.updateProductionOrderCost(orderId, { overhead: 1000 }); // 实际制造费用 1000

    // 4. 生成成本计算单
    const costSheet = service.generateCostSheet(orderId);

    // 验证标准成本信息
    expect(costSheet.standardCost).toBeDefined();
    expect(costSheet.standardCost!.standardMaterialCost).toBe(600); // 6 * 100
    expect(costSheet.standardCost!.standardLaborCost).toBe(1500); // 15 * 100
    expect(costSheet.standardCost!.standardOverheadCost).toBe(900); // 9 * 100
    expect(costSheet.standardCost!.standardTotalCost).toBe(3000); // 30 * 100

    // 验证成本差异
    expect(costSheet.standardCost!.variance).toBeDefined();
    expect(costSheet.standardCost!.variance!.materialVariance).toBe(-100); // 500 - 600
    expect(costSheet.standardCost!.variance!.laborVariance).toBe(500); // 2000 - 1500
    expect(costSheet.standardCost!.variance!.overheadVariance).toBe(100); // 1000 - 900
    expect(costSheet.standardCost!.variance!.totalVariance).toBe(500); // 3500 - 3000
    expect(costSheet.standardCost!.variance!.varianceRate).toBeCloseTo(16.67, 1); // (500 / 3000) * 100
  });

  it("应该在成本计算单中包含多次材料领用记录", () => {
    // 1. 创建生产订单
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-003",
      product_id: 1,
      quantity: 100,
      start_date: "2024-01-15",
      status: "in_progress",
      actual_material_cost: 0,
      actual_labor_cost: 0,
      actual_overhead_cost: 0,
      actual_total_cost: 0
    });

    // 2. 多次归集材料成本
    service.allocateMaterialCost(orderId, 1, 30, 10);
    service.allocateMaterialCost(orderId, 1, 20, 10);

    // 3. 生成成本计算单
    const costSheet = service.generateCostSheet(orderId);

    // 验证材料领用记录
    expect(costSheet.costAccumulation.material.transactions).toHaveLength(2);
    expect(costSheet.costAccumulation.material.total).toBe(500); // (30 + 20) * 10

    const transactions = costSheet.costAccumulation.material.transactions;
    expect(transactions[0].quantity).toBe(30);
    expect(transactions[0].totalCost).toBe(300);
    expect(transactions[1].quantity).toBe(20);
    expect(transactions[1].totalCost).toBe(200);
  });

  it("应该在成本计算单中包含多次人工成本归集记录", () => {
    // 1. 创建生产订单
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-004",
      product_id: 1,
      quantity: 100,
      start_date: "2024-01-15",
      status: "in_progress",
      actual_material_cost: 0,
      actual_labor_cost: 0,
      actual_overhead_cost: 0,
      actual_total_cost: 0
    });

    // 2. 多次归集人工成本
    service.allocateLaborCost(orderId, 1000, "第一批计件工资");
    service.allocateLaborCost(orderId, 1500, "第二批计件工资");

    // 3. 生成成本计算单
    const costSheet = service.generateCostSheet(orderId);

    // 验证人工成本归集记录
    expect(costSheet.costAccumulation.labor.allocations).toHaveLength(2);
    expect(costSheet.costAccumulation.labor.total).toBe(2500);

    const allocations = costSheet.costAccumulation.labor.allocations;
    expect(allocations[0].amount).toBe(1000);
    expect(allocations[0].notes).toBe("第一批计件工资");
    expect(allocations[1].amount).toBe(1500);
    expect(allocations[1].notes).toBe("第二批计件工资");
  });

  it("应该在生产订单不存在时抛出错误", () => {
    expect(() => {
      service.generateCostSheet(99999);
    }).toThrow("生产订单不存在");
  });

  it("应该正确处理没有材料和人工成本的订单", () => {
    // 1. 创建生产订单（只有制造费用）
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-005",
      product_id: 1,
      quantity: 100,
      start_date: "2024-01-15",
      status: "in_progress",
      actual_material_cost: 0,
      actual_labor_cost: 0,
      actual_overhead_cost: 500,
      actual_total_cost: 500
    });

    // 2. 生成成本计算单
    const costSheet = service.generateCostSheet(orderId);

    // 验证成本归集
    expect(costSheet.costAccumulation.material.total).toBe(0);
    expect(costSheet.costAccumulation.material.transactions).toHaveLength(0);
    expect(costSheet.costAccumulation.labor.total).toBe(0);
    expect(costSheet.costAccumulation.labor.allocations).toHaveLength(0);
    expect(costSheet.costAccumulation.overhead.total).toBe(500);

    // 验证成本汇总
    expect(costSheet.costSummary.totalCost).toBe(500);
    expect(costSheet.costSummary.unitCost).toBe(5);
  });
});
