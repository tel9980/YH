import Database from "better-sqlite3";
import { CostAccountingService } from "../CostAccountingService.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";

/**
 * 测试在产品成本计算（约当产量法）
 * 属性23: 在产品成本计算准确性
 * 需求: 6.6
 */
describe("CostAccountingService - calculateWIPCost (约当产量法)", () => {
  let db: Database.Database;
  let service: CostAccountingService;
  const testDbPath = "./test-wip-cost.db";

  beforeEach(() => {
    // 创建测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);

    // 创建必要的表
    db.exec(`
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS product_costs (
        product_id INTEGER PRIMARY KEY,
        costing_method TEXT DEFAULT 'actual',
        standard_material_cost REAL DEFAULT 0,
        standard_labor_cost REAL DEFAULT 0,
        standard_overhead_cost REAL DEFAULT 0,
        standard_total_cost REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
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
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it("应该正确计算完工产品和在产品成本（材料一次投入，人工和制造费用陆续投入）", () => {
    // 创建生产订单
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-001",
      product_id: 1,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 10000, // 材料成本
      actual_labor_cost: 5000,     // 人工成本
      actual_overhead_cost: 3000,  // 制造费用
      actual_total_cost: 18000     // 总成本
    });

    // 完工产品: 80件
    // 在产品: 20件
    // 完工程度: 材料100%（一次投入），人工50%，制造费用50%
    const result = service.calculateWIPCost(
      orderId,
      80,  // 完工数量
      20,  // 在产品数量
      {
        material: 1.0,  // 材料完工率100%
        labor: 0.5,     // 人工完工率50%
        overhead: 0.5   // 制造费用完工率50%
      }
    );

    // 验证属性23: 完工成本 + 在产品成本 = 总投入成本
    expect(result.finishedCost + result.wipCost).toBeCloseTo(result.totalCost, 2);
    expect(result.totalCost).toBe(18000);

    // 验证材料成本分配
    // 约当产量 = 80 + 20*1.0 = 100
    // 单位材料成本 = 10000 / 100 = 100
    // 完工产品材料成本 = 80 * 100 = 8000
    // 在产品材料成本 = 20 * 100 = 2000
    expect(result.breakdown.material.finished).toBe(8000);
    expect(result.breakdown.material.wip).toBe(2000);
    expect(result.breakdown.material.total).toBe(10000);

    // 验证人工成本分配
    // 约当产量 = 80 + 20*0.5 = 90
    // 单位人工成本 = 5000 / 90 = 55.56
    // 完工产品人工成本 = 80 * 55.56 = 4444.44
    // 在产品人工成本 = 10 * 55.56 = 555.56
    expect(result.breakdown.labor.finished).toBeCloseTo(4444.44, 2);
    expect(result.breakdown.labor.wip).toBeCloseTo(555.56, 2);
    expect(result.breakdown.labor.total).toBe(5000);

    // 验证制造费用分配
    // 约当产量 = 80 + 20*0.5 = 90
    // 单位制造费用 = 3000 / 90 = 33.33
    // 完工产品制造费用 = 80 * 33.33 = 2666.67
    // 在产品制造费用 = 10 * 33.33 = 333.33
    expect(result.breakdown.overhead.finished).toBeCloseTo(2666.67, 2);
    expect(result.breakdown.overhead.wip).toBeCloseTo(333.33, 2);
    expect(result.breakdown.overhead.total).toBe(3000);

    // 验证总成本
    expect(result.finishedCost).toBeCloseTo(15111.11, 2);
    expect(result.wipCost).toBeCloseTo(2888.89, 2);
  });

  it("应该正确处理全部完工的情况", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-002",
      product_id: 2,
      quantity: 100,
      start_date: "2024-01-01",
      status: "completed",
      actual_material_cost: 5000,
      actual_labor_cost: 3000,
      actual_overhead_cost: 2000,
      actual_total_cost: 10000
    });

    // 全部完工，无在产品
    const result = service.calculateWIPCost(
      orderId,
      100,  // 完工数量
      0,    // 在产品数量
      {
        material: 1.0,
        labor: 1.0,
        overhead: 1.0
      }
    );

    // 全部成本应归集到完工产品
    expect(result.finishedCost).toBe(10000);
    expect(result.wipCost).toBe(0);
    expect(result.totalCost).toBe(10000);
  });

  it("应该正确处理全部在产的情况", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-003",
      product_id: 3,
      quantity: 50,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 3000,
      actual_labor_cost: 1500,
      actual_overhead_cost: 1000,
      actual_total_cost: 5500
    });

    // 全部在产，无完工产品
    const result = service.calculateWIPCost(
      orderId,
      0,   // 完工数量
      50,  // 在产品数量
      {
        material: 0.8,  // 材料完工率80%
        labor: 0.6,     // 人工完工率60%
        overhead: 0.6   // 制造费用完工率60%
      }
    );

    // 全部成本应归集到在产品
    expect(result.finishedCost).toBe(0);
    expect(result.wipCost).toBe(5500);
    expect(result.totalCost).toBe(5500);
  });

  it("应该正确处理不同完工率的情况", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-004",
      product_id: 4,
      quantity: 200,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 20000,
      actual_labor_cost: 10000,
      actual_overhead_cost: 8000,
      actual_total_cost: 38000
    });

    // 完工150件，在产50件
    // 材料一次投入100%，人工和制造费用完工率不同
    const result = service.calculateWIPCost(
      orderId,
      150,  // 完工数量
      50,   // 在产品数量
      {
        material: 1.0,  // 材料完工率100%
        labor: 0.4,     // 人工完工率40%
        overhead: 0.3   // 制造费用完工率30%
      }
    );

    // 验证属性23
    expect(result.finishedCost + result.wipCost).toBeCloseTo(result.totalCost, 2);

    // 材料成本分配
    // 约当产量 = 150 + 50*1.0 = 200
    // 单位成本 = 20000 / 200 = 100
    // 完工 = 150 * 100 = 15000
    // 在产 = 50 * 100 = 5000
    expect(result.breakdown.material.finished).toBe(15000);
    expect(result.breakdown.material.wip).toBe(5000);

    // 人工成本分配
    // 约当产量 = 150 + 50*0.4 = 170
    // 单位成本 = 10000 / 170 = 58.82
    // 完工 = 150 * 58.82 = 8823.53
    // 在产 = 20 * 58.82 = 1176.47
    expect(result.breakdown.labor.finished).toBeCloseTo(8823.53, 2);
    expect(result.breakdown.labor.wip).toBeCloseTo(1176.47, 2);

    // 制造费用分配
    // 约当产量 = 150 + 50*0.3 = 165
    // 单位成本 = 8000 / 165 = 48.48
    // 完工 = 150 * 48.48 = 7272.73
    // 在产 = 15 * 48.48 = 727.27
    expect(result.breakdown.overhead.finished).toBeCloseTo(7272.73, 2);
    expect(result.breakdown.overhead.wip).toBeCloseTo(727.27, 2);
  });

  it("应该拒绝负数的完工数量或在产品数量", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-005",
      product_id: 5,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 5000,
      actual_labor_cost: 3000,
      actual_overhead_cost: 2000,
      actual_total_cost: 10000
    });

    expect(() => {
      service.calculateWIPCost(orderId, -10, 50, {
        material: 1.0,
        labor: 0.5,
        overhead: 0.5
      });
    }).toThrow("完工数量和在产品数量必须为非负数");

    expect(() => {
      service.calculateWIPCost(orderId, 50, -10, {
        material: 1.0,
        labor: 0.5,
        overhead: 0.5
      });
    }).toThrow("完工数量和在产品数量必须为非负数");
  });

  it("应该拒绝完工数量和在产品数量同时为0", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-006",
      product_id: 6,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 5000,
      actual_labor_cost: 3000,
      actual_overhead_cost: 2000,
      actual_total_cost: 10000
    });

    expect(() => {
      service.calculateWIPCost(orderId, 0, 0, {
        material: 1.0,
        labor: 0.5,
        overhead: 0.5
      });
    }).toThrow("完工数量和在产品数量不能同时为0");
  });

  it("应该拒绝无效的完工率（小于0或大于1）", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-007",
      product_id: 7,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 5000,
      actual_labor_cost: 3000,
      actual_overhead_cost: 2000,
      actual_total_cost: 10000
    });

    expect(() => {
      service.calculateWIPCost(orderId, 80, 20, {
        material: 1.5,  // 无效：大于1
        labor: 0.5,
        overhead: 0.5
      });
    }).toThrow("完工率必须在 0 到 1 之间");

    expect(() => {
      service.calculateWIPCost(orderId, 80, 20, {
        material: 1.0,
        labor: -0.2,  // 无效：小于0
        overhead: 0.5
      });
    }).toThrow("完工率必须在 0 到 1 之间");
  });

  it("应该拒绝不存在的生产订单", () => {
    expect(() => {
      service.calculateWIPCost(99999, 80, 20, {
        material: 1.0,
        labor: 0.5,
        overhead: 0.5
      });
    }).toThrow("生产订单不存在");
  });

  it("应该正确处理零成本的情况", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-008",
      product_id: 8,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 0,
      actual_labor_cost: 0,
      actual_overhead_cost: 0,
      actual_total_cost: 0
    });

    const result = service.calculateWIPCost(
      orderId,
      80,
      20,
      {
        material: 1.0,
        labor: 0.5,
        overhead: 0.5
      }
    );

    expect(result.finishedCost).toBe(0);
    expect(result.wipCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("应该正确处理完工率为0的情况", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-009",
      product_id: 9,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 10000,
      actual_labor_cost: 5000,
      actual_overhead_cost: 3000,
      actual_total_cost: 18000
    });

    // 在产品人工和制造费用完工率为0（刚开始投料）
    const result = service.calculateWIPCost(
      orderId,
      80,
      20,
      {
        material: 1.0,  // 材料已全部投入
        labor: 0.0,     // 人工尚未开始
        overhead: 0.0   // 制造费用尚未发生
      }
    );

    // 验证属性23
    expect(result.finishedCost + result.wipCost).toBeCloseTo(result.totalCost, 2);

    // 材料成本应按数量分配
    expect(result.breakdown.material.finished).toBe(8000);
    expect(result.breakdown.material.wip).toBe(2000);

    // 人工和制造费用应全部归集到完工产品
    expect(result.breakdown.labor.finished).toBe(5000);
    expect(result.breakdown.labor.wip).toBe(0);
    expect(result.breakdown.overhead.finished).toBe(3000);
    expect(result.breakdown.overhead.wip).toBe(0);
  });

  it("应该正确处理完工率为100%的情况", () => {
    const orderId = service.createProductionOrder({
      order_no: "PO-2024-010",
      product_id: 10,
      quantity: 100,
      start_date: "2024-01-01",
      status: "in_progress",
      actual_material_cost: 10000,
      actual_labor_cost: 5000,
      actual_overhead_cost: 3000,
      actual_total_cost: 18000
    });

    // 在产品各项完工率都是100%（即将完工）
    const result = service.calculateWIPCost(
      orderId,
      80,
      20,
      {
        material: 1.0,
        labor: 1.0,
        overhead: 1.0
      }
    );

    // 验证属性23
    expect(result.finishedCost + result.wipCost).toBeCloseTo(result.totalCost, 2);

    // 所有成本应按数量比例分配（80:20）
    const expectedFinishedCost = 18000 * 0.8;  // 14400
    const expectedWIPCost = 18000 * 0.2;       // 3600

    expect(result.finishedCost).toBeCloseTo(expectedFinishedCost, 2);
    expect(result.wipCost).toBeCloseTo(expectedWIPCost, 2);
  });
});
