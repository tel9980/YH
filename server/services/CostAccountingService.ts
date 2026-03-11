import Database from "better-sqlite3";
import { ProductCost, CostVariance, ProductionOrder } from "../../src/types.js";

/**
 * 成本核算服务
 * 支持标准成本法和实际成本法，计算成本差异
 */
export class CostAccountingService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 设置产品标准成本
   */
  setProductCost(productId: number, cost: Omit<ProductCost, 'product_id' | 'updated_at'>): void {
    const totalCost = (cost.standard_material_cost || 0) + 
                     (cost.standard_labor_cost || 0) + 
                     (cost.standard_overhead_cost || 0);

    this.db.prepare(`
      INSERT OR REPLACE INTO product_costs 
      (product_id, costing_method, standard_material_cost, standard_labor_cost, standard_overhead_cost, standard_total_cost, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      productId,
      cost.costing_method,
      cost.standard_material_cost || 0,
      cost.standard_labor_cost || 0,
      cost.standard_overhead_cost || 0,
      totalCost
    );
  }

  /**
   * 获取产品成本设置
   */
  getProductCost(productId: number): ProductCost | null {
    return this.db.prepare("SELECT * FROM product_costs WHERE product_id = ?").get(productId) as ProductCost | null;
  }

  /**
   * 创建生产订单
   */
  createProductionOrder(order: Omit<ProductionOrder, 'id' | 'created_at'>): number {
    const result = this.db.prepare(`
      INSERT INTO production_orders 
      (order_no, product_id, quantity, start_date, completion_date, status, 
       actual_material_cost, actual_labor_cost, actual_overhead_cost, actual_total_cost, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      order.order_no,
      order.product_id,
      order.quantity,
      order.start_date,
      order.completion_date,
      order.status,
      order.actual_material_cost,
      order.actual_labor_cost,
      order.actual_overhead_cost,
      order.actual_total_cost
    );

    return result.lastInsertRowid as number;
  }

  /**
   * 更新生产订单成本
   */
  updateProductionOrderCost(orderId: number, costs: {
    material?: number;
    labor?: number;
    overhead?: number;
  }): void {
    const order = this.db.prepare("SELECT * FROM production_orders WHERE id = ?").get(orderId) as any;
    if (!order) throw new Error('生产订单不存在');

    const materialCost = costs.material !== undefined ? costs.material : order.actual_material_cost;
    const laborCost = costs.labor !== undefined ? costs.labor : order.actual_labor_cost;
    const overheadCost = costs.overhead !== undefined ? costs.overhead : order.actual_overhead_cost;
    const totalCost = materialCost + laborCost + overheadCost;

    this.db.prepare(`
      UPDATE production_orders 
      SET actual_material_cost = ?, actual_labor_cost = ?, actual_overhead_cost = ?, actual_total_cost = ?
      WHERE id = ?
    `).run(materialCost, laborCost, overheadCost, totalCost, orderId);
  }

  /**
   * 计算成本差异
   * 属性10: 成本差异计算准确性
   */
  calculateVariances(period: string, productId: number): CostVariance {
    const productCost = this.getProductCost(productId);
    if (!productCost || productCost.costing_method !== 'standard') {
      throw new Error('产品未设置标准成本或未使用标准成本法');
    }

    // 获取本期完工的生产订单
    const orders = this.db.prepare(`
      SELECT * FROM production_orders 
      WHERE product_id = ? 
      AND status = 'completed'
      AND strftime('%Y-%m', completion_date) = ?
    `).all(productId, period) as ProductionOrder[];

    let totalActualMaterial = 0;
    let totalActualLabor = 0;
    let totalActualOverhead = 0;
    let totalQuantity = 0;

    orders.forEach(order => {
      totalActualMaterial += order.actual_material_cost;
      totalActualLabor += order.actual_labor_cost;
      totalActualOverhead += order.actual_overhead_cost;
      totalQuantity += order.quantity;
    });

    // 标准成本总额
    const totalStandardMaterial = (productCost.standard_material_cost || 0) * totalQuantity;
    const totalStandardLabor = (productCost.standard_labor_cost || 0) * totalQuantity;
    const totalStandardOverhead = (productCost.standard_overhead_cost || 0) * totalQuantity;

    // 计算差异
    const materialVariance = totalActualMaterial - totalStandardMaterial;
    const laborVariance = totalActualLabor - totalStandardLabor;
    const overheadVariance = totalActualOverhead - totalStandardOverhead;
    const totalVariance = materialVariance + laborVariance + overheadVariance;

    // 计算差异率
    const totalStandardCost = totalStandardMaterial + totalStandardLabor + totalStandardOverhead;
    const varianceRate = totalStandardCost > 0 ? (totalVariance / totalStandardCost) * 100 : 0;

    const variance: CostVariance = {
      period,
      product_id: productId,
      material_price_variance: materialVariance,
      material_quantity_variance: 0, // 简化处理
      labor_efficiency_variance: laborVariance,
      overhead_variance: overheadVariance,
      total_variance: totalVariance,
      variance_rate: varianceRate,
      processed: false
    };

    // 保存差异记录
    this.db.prepare(`
      INSERT INTO cost_variances 
      (period, product_id, material_price_variance, material_quantity_variance, 
       labor_efficiency_variance, overhead_variance, total_variance, variance_rate, processed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(
      variance.period,
      variance.product_id,
      variance.material_price_variance,
      variance.material_quantity_variance,
      variance.labor_efficiency_variance,
      variance.overhead_variance,
      variance.total_variance,
      variance.variance_rate
    );

    return variance;
  }

  /**
   * 检查成本差异是否超过阈值
   * 属性11: 成本差异超阈值预警
   */
  checkVarianceThreshold(variance: CostVariance, threshold: number = 10): boolean {
    return Math.abs(variance.variance_rate) > threshold;
  }

  /**
   * 处理成本差异（结转至主营业务成本）
   */
  processVariance(varianceId: number): number {
    const variance = this.db.prepare("SELECT * FROM cost_variances WHERE id = ?").get(varianceId) as CostVariance;
    if (!variance) throw new Error('成本差异记录不存在');

    const lines: any[] = [];

    if (variance.total_variance > 0) {
      // 实际成本 > 标准成本，借方差异
      lines.push({
        line_no: 1,
        account_id: '5401', // 主营业务成本
        debit: variance.total_variance,
        credit: 0,
        notes: '成本差异结转'
      });
      lines.push({
        line_no: 2,
        account_id: '1405', // 库存商品（冲减）
        debit: 0,
        credit: variance.total_variance,
        notes: '成本差异结转'
      });
    } else {
      // 实际成本 < 标准成本，贷方差异
      const absVariance = Math.abs(variance.total_variance);
      lines.push({
        line_no: 1,
        account_id: '1405', // 库存商品（增加）
        debit: absVariance,
        credit: 0,
        notes: '成本差异结转'
      });
      lines.push({
        line_no: 2,
        account_id: '5401', // 主营业务成本（冲减）
        debit: 0,
        credit: absVariance,
        notes: '成本差异结转'
      });
    }

    // 创建凭证
    const voucherId = this.createVarianceVoucher(variance, lines);

    // 标记差异已处理
    this.db.prepare("UPDATE cost_variances SET processed = 1 WHERE id = ?").run(varianceId);

    return voucherId;
  }

  /**
   * 创建成本差异凭证
   */
  private createVarianceVoucher(variance: CostVariance, lines: any[]): number {
    const lastDay = this.getLastDayOfMonth(variance.period);
    
    const result = this.db.prepare(`
      INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, created_at)
      VALUES (?, ?, 'closing', ?, 'approved', CURRENT_TIMESTAMP)
    `).run(
      `${variance.period}-${lastDay}`,
      `结-${variance.period.replace(/-/g, '')}-${variance.product_id}`,
      `${variance.period} 成本差异结转`
    );

    const voucherId = result.lastInsertRowid as number;

    const lineStmt = this.db.prepare(`
      INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    lines.forEach(line => {
      lineStmt.run(voucherId, line.line_no, line.account_id, line.debit, line.credit, line.notes);
    });

    return voucherId;
  }

  /**
   * 获取月份最后一天
   */
  private getLastDayOfMonth(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return lastDay.toString().padStart(2, '0');
  }

  /**
   * 获取产品的所有成本差异
   */
  getProductVariances(productId: number, startPeriod?: string, endPeriod?: string): CostVariance[] {
    let query = "SELECT * FROM cost_variances WHERE product_id = ?";
    const params: any[] = [productId];

    if (startPeriod) {
      query += " AND period >= ?";
      params.push(startPeriod);
    }
    if (endPeriod) {
      query += " AND period <= ?";
      params.push(endPeriod);
    }

    query += " ORDER BY period DESC";

    return this.db.prepare(query).all(...params) as CostVariance[];
  }
  /**
   * 获取所有成本差异
   */
  getAllCostVariances(): CostVariance[] {
    return this.db.prepare(`
      SELECT * FROM cost_variances ORDER BY period DESC, product_id
    `).all() as CostVariance[];
  }


  /**
   * 切换成本核算方法
   * 属性12: 成本核算方法可切换
   */
  switchCostingMethod(productId: number, method: 'standard' | 'actual'): void {
    this.db.prepare(`
      UPDATE product_costs SET costing_method = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?
    `).run(method, productId);

    // 记录日志
    this.db.prepare(`
      INSERT INTO audit_logs (timestamp, action, details)
      VALUES (?, 'costing_method_changed', ?)
    `).run(
      new Date().toISOString(),
      JSON.stringify({ product_id: productId, new_method: method })
    );
  }

  /**
   * 领用原材料自动归集到生产订单
   * 属性21: 成本按订单归集
   * 需求: 6.2
   */
  allocateMaterialCost(orderId: number, itemId: number, quantity: number, unitCost: number): void {
    // 验证生产订单存在
    const order = this.db.prepare("SELECT * FROM production_orders WHERE id = ?").get(orderId) as ProductionOrder | undefined;
    if (!order) {
      throw new Error('生产订单不存在');
    }

    // 验证订单状态
    if (order.status === 'closed') {
      throw new Error('生产订单已关闭，无法归集成本');
    }

    // 计算材料成本
    const materialCost = quantity * unitCost;

    // 记录库存事务（出库）
    const inventoryItem = this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
    if (!inventoryItem) {
      throw new Error('库存项目不存在');
    }

    // 检查库存数量是否足够
    if (inventoryItem.quantity < quantity) {
      throw new Error(`库存数量不足。当前库存: ${inventoryItem.quantity}, 需要: ${quantity}`);
    }

    // 更新库存数量和金额
    const newQuantity = inventoryItem.quantity - quantity;
    const newInventoryTotalCost = inventoryItem.total_cost - materialCost;

    this.db.prepare(`
      UPDATE inventory 
      SET quantity = ?, total_cost = ?, total_quantity = ?
      WHERE id = ?
    `).run(newQuantity, newInventoryTotalCost, newQuantity, itemId);

    // 记录库存事务
    this.db.prepare(`
      INSERT INTO inventory_transactions 
      (item_id, transaction_date, transaction_type, quantity, unit_cost, total_cost, 
       balance_quantity, balance_cost, reference_type, reference_id, notes, created_at)
      VALUES (?, ?, 'out', ?, ?, ?, ?, ?, 'production_order', ?, ?, CURRENT_TIMESTAMP)
    `).run(
      itemId,
      new Date().toISOString().split('T')[0],
      quantity,
      unitCost,
      materialCost,
      newQuantity,
      newInventoryTotalCost,
      orderId,
      `生产订单 ${order.order_no} 领用原材料`
    );

    // 更新生产订单的材料成本
    const newMaterialCost = order.actual_material_cost + materialCost;
    const newOrderTotalCost = newMaterialCost + order.actual_labor_cost + order.actual_overhead_cost;

    this.db.prepare(`
      UPDATE production_orders 
      SET actual_material_cost = ?, actual_total_cost = ?
      WHERE id = ?
    `).run(newMaterialCost, newOrderTotalCost, orderId);
  }

  /**
   * 计件工资自动归集到生产订单
   * 属性21: 成本按订单归集
   * 需求: 6.3
   */
  allocateLaborCost(orderId: number, laborCost: number, notes?: string): void {
    // 验证生产订单存在
    const order = this.db.prepare("SELECT * FROM production_orders WHERE id = ?").get(orderId) as ProductionOrder | undefined;
    if (!order) {
      throw new Error('生产订单不存在');
    }

    // 验证订单状态
    if (order.status === 'closed') {
      throw new Error('生产订单已关闭，无法归集成本');
    }

    // 验证人工成本为正数
    if (laborCost <= 0) {
      throw new Error('人工成本必须大于0');
    }

    // 更新生产订单的人工成本
    const newLaborCost = order.actual_labor_cost + laborCost;
    const newOrderTotalCost = order.actual_material_cost + newLaborCost + order.actual_overhead_cost;

    this.db.prepare(`
      UPDATE production_orders 
      SET actual_labor_cost = ?, actual_total_cost = ?
      WHERE id = ?
    `).run(newLaborCost, newOrderTotalCost, orderId);

    // 记录审计日志
    this.db.prepare(`
      INSERT INTO audit_logs (timestamp, action, details)
      VALUES (?, 'labor_cost_allocated', ?)
    `).run(
      new Date().toISOString(),
      JSON.stringify({ 
        production_order_id: orderId, 
        order_no: order.order_no,
        labor_cost: laborCost,
        notes: notes || '计件工资归集'
      })
    );
  }

  /**
   * 获取生产订单详细信息
   */
  getProductionOrder(orderId: number): ProductionOrder | null {
    return this.db.prepare("SELECT * FROM production_orders WHERE id = ?").get(orderId) as ProductionOrder | null;
  }

  /**
   * 获取所有生产订单
   */
  getAllProductionOrders(): ProductionOrder[] {
    return this.db.prepare("SELECT * FROM production_orders ORDER BY start_date DESC").all() as ProductionOrder[];
  }

  /**
   * 获取生产订单的成本明细
   */
  getProductionOrderCostDetails(orderId: number): {
    order: ProductionOrder;
    materialTransactions: any[];
    laborAllocations: any[];
  } | null {
    const order = this.getProductionOrder(orderId);
    if (!order) return null;

    // 获取材料领用记录
    const materialTransactions = this.db.prepare(`
      SELECT it.*, i.name as item_name
      FROM inventory_transactions it
      JOIN inventory i ON it.item_id = i.id
      WHERE it.reference_type = 'production_order' 
      AND it.reference_id = ?
      AND it.transaction_type = 'out'
      ORDER BY it.transaction_date DESC
    `).all(orderId);

    // 获取人工成本归集记录
    const laborAllocations = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE action = 'labor_cost_allocated'
      AND json_extract(details, '$.production_order_id') = ?
      ORDER BY timestamp DESC
    `).all(orderId);

    return {
      order,
      materialTransactions,
      laborAllocations
    };
  }


    /**
     * 计算在产品成本（约当产量法）
     * 属性23: 在产品成本计算准确性
     * 需求: 6.6
     *
     * @param orderId 生产订单ID
     * @param finishedQuantity 完工产品数量
     * @param wipQuantity 在产品数量
     * @param completionPercentages 完工程度 { material: 材料完工率, labor: 人工完工率, overhead: 制造费用完工率 }
     * @returns { finishedCost: 完工产品成本, wipCost: 在产品成本, totalCost: 总投入成本 }
     */
    calculateWIPCost(
      orderId: number,
      finishedQuantity: number,
      wipQuantity: number,
      completionPercentages: {
        material: number;  // 材料完工率 (0-1)
        labor: number;     // 人工完工率 (0-1)
        overhead: number;  // 制造费用完工率 (0-1)
      }
    ): {
      finishedCost: number;
      wipCost: number;
      totalCost: number;
      breakdown: {
        material: { finished: number; wip: number; total: number };
        labor: { finished: number; wip: number; total: number };
        overhead: { finished: number; wip: number; total: number };
      };
    } {
      // 验证输入参数
      if (finishedQuantity < 0 || wipQuantity < 0) {
        throw new Error('完工数量和在产品数量必须为非负数');
      }

      if (finishedQuantity === 0 && wipQuantity === 0) {
        throw new Error('完工数量和在产品数量不能同时为0');
      }

      // 验证完工率在 0-1 之间
      if (completionPercentages.material < 0 || completionPercentages.material > 1 ||
          completionPercentages.labor < 0 || completionPercentages.labor > 1 ||
          completionPercentages.overhead < 0 || completionPercentages.overhead > 1) {
        throw new Error('完工率必须在 0 到 1 之间');
      }

      // 获取生产订单
      const order = this.getProductionOrder(orderId);
      if (!order) {
        throw new Error('生产订单不存在');
      }

      // 获取总投入成本
      const totalMaterialCost = order.actual_material_cost;
      const totalLaborCost = order.actual_labor_cost;
      const totalOverheadCost = order.actual_overhead_cost;
      const totalCost = order.actual_total_cost;

      // 计算约当产量（等效完工产品数量）
      // 约当产量 = 在产品数量 × 完工率
      const equivalentMaterial = wipQuantity * completionPercentages.material;
      const equivalentLabor = wipQuantity * completionPercentages.labor;
      const equivalentOverhead = wipQuantity * completionPercentages.overhead;

      // 计算总约当产量（完工产品 + 在产品约当产量）
      const totalEquivalentMaterial = finishedQuantity + equivalentMaterial;
      const totalEquivalentLabor = finishedQuantity + equivalentLabor;
      const totalEquivalentOverhead = finishedQuantity + equivalentOverhead;

      // 计算单位成本
      const unitMaterialCost = totalEquivalentMaterial > 0 ? totalMaterialCost / totalEquivalentMaterial : 0;
      const unitLaborCost = totalEquivalentLabor > 0 ? totalLaborCost / totalEquivalentLabor : 0;
      const unitOverheadCost = totalEquivalentOverhead > 0 ? totalOverheadCost / totalEquivalentOverhead : 0;

      // 计算完工产品成本
      const finishedMaterialCost = finishedQuantity * unitMaterialCost;
      const finishedLaborCost = finishedQuantity * unitLaborCost;
      const finishedOverheadCost = finishedQuantity * unitOverheadCost;
      const finishedCost = finishedMaterialCost + finishedLaborCost + finishedOverheadCost;

      // 计算在产品成本
      const wipMaterialCost = equivalentMaterial * unitMaterialCost;
      const wipLaborCost = equivalentLabor * unitLaborCost;
      const wipOverheadCost = equivalentOverhead * unitOverheadCost;
      const wipCost = wipMaterialCost + wipLaborCost + wipOverheadCost;

      // 验证属性23: 完工成本 + 在产品成本 = 总投入成本
      const calculatedTotal = finishedCost + wipCost;
      const tolerance = 0.01; // 允许0.01的浮点数误差
      if (Math.abs(calculatedTotal - totalCost) > tolerance) {
        console.warn(
          `成本分配验证警告: 完工成本(${finishedCost.toFixed(2)}) + 在产品成本(${wipCost.toFixed(2)}) = ${calculatedTotal.toFixed(2)}, ` +
          `但总投入成本为 ${totalCost.toFixed(2)}, 差异: ${(calculatedTotal - totalCost).toFixed(2)}`
        );
      }

      return {
        finishedCost: Math.round(finishedCost * 100) / 100,
        wipCost: Math.round(wipCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        breakdown: {
          material: {
            finished: Math.round(finishedMaterialCost * 100) / 100,
            wip: Math.round(wipMaterialCost * 100) / 100,
            total: Math.round(totalMaterialCost * 100) / 100
          },
          labor: {
            finished: Math.round(finishedLaborCost * 100) / 100,
            wip: Math.round(wipLaborCost * 100) / 100,
            total: Math.round(totalLaborCost * 100) / 100
          },
          overhead: {
            finished: Math.round(finishedOverheadCost * 100) / 100,
            wip: Math.round(wipOverheadCost * 100) / 100,
            total: Math.round(totalOverheadCost * 100) / 100
          }
        }
      };
    }


    /**
     * 生成生产成本计算单
     * 需求: 6.7
     * 详细列示各成本项目的归集和分配过程
     *
     * @param orderId 生产订单ID
     * @returns 生产成本计算单，包含完整的成本归集和分配明细
     */
    generateCostSheet(orderId: number): {
      order: ProductionOrder;
      product: any;
      costAccumulation: {
        material: {
          total: number;
          transactions: Array<{
            date: string;
            itemName: string;
            quantity: number;
            unitCost: number;
            totalCost: number;
            notes: string;
          }>;
        };
        labor: {
          total: number;
          allocations: Array<{
            date: string;
            amount: number;
            notes: string;
          }>;
        };
        overhead: {
          total: number;
          allocationMethod?: string;
          allocationBase?: number;
          allocationRate?: number;
        };
      };
      costSummary: {
        totalMaterialCost: number;
        totalLaborCost: number;
        totalOverheadCost: number;
        totalCost: number;
        unitCost: number;
      };
      wipCalculation?: {
        finishedQuantity: number;
        wipQuantity: number;
        finishedCost: number;
        wipCost: number;
        breakdown: {
          material: { finished: number; wip: number; total: number };
          labor: { finished: number; wip: number; total: number };
          overhead: { finished: number; wip: number; total: number };
        };
      };
      standardCost?: {
        standardMaterialCost: number;
        standardLaborCost: number;
        standardOverheadCost: number;
        standardTotalCost: number;
        variance?: {
          materialVariance: number;
          laborVariance: number;
          overheadVariance: number;
          totalVariance: number;
          varianceRate: number;
        };
      };
      generatedAt: string;
    } {
      // 获取生产订单
      const order = this.getProductionOrder(orderId);
      if (!order) {
        throw new Error('生产订单不存在');
      }

      // 获取产品信息
      const product = this.db.prepare("SELECT * FROM products WHERE id = ?").get(order.product_id) as any;
      if (!product) {
        throw new Error('产品不存在');
      }

      // 1. 归集材料成本明细
      const materialTransactions = this.db.prepare(`
        SELECT
          it.transaction_date as date,
          i.name as itemName,
          it.quantity,
          it.unit_cost as unitCost,
          it.total_cost as totalCost,
          it.notes
        FROM inventory_transactions it
        JOIN inventory i ON it.item_id = i.id
        WHERE it.reference_type = 'production_order'
        AND it.reference_id = ?
        AND it.transaction_type = 'out'
        ORDER BY it.transaction_date ASC
      `).all(orderId) as Array<{
        date: string;
        itemName: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
        notes: string;
      }>;

      // 2. 归集人工成本明细
      const laborAllocations = this.db.prepare(`
        SELECT
          timestamp as date,
          json_extract(details, '$.labor_cost') as amount,
          json_extract(details, '$.notes') as notes
        FROM audit_logs
        WHERE action = 'labor_cost_allocated'
        AND json_extract(details, '$.production_order_id') = ?
        ORDER BY timestamp ASC
      `).all(orderId) as Array<{
        date: string;
        amount: number;
        notes: string;
      }>;

      // 3. 制造费用分配信息
      const overheadAllocation = this.db.prepare(`
        SELECT
          method,
          json_extract(allocation_details, '$') as details
        FROM overhead_allocations
        WHERE period = strftime('%Y-%m', ?)
        ORDER BY created_at DESC
        LIMIT 1
      `).get(order.start_date) as any;

      let overheadInfo: {
        total: number;
        allocationMethod?: string;
        allocationBase?: number;
        allocationRate?: number;
      } = {
        total: order.actual_overhead_cost
      };

      if (overheadAllocation) {
        try {
          const details = JSON.parse(overheadAllocation.details);
          const orderAllocation = details.find((d: any) => d.production_order_id === orderId);
          if (orderAllocation) {
            overheadInfo = {
              total: order.actual_overhead_cost,
              allocationMethod: overheadAllocation.method,
              allocationBase: orderAllocation.allocation_base,
              allocationRate: orderAllocation.allocation_base > 0
                ? order.actual_overhead_cost / orderAllocation.allocation_base
                : 0
            };
          }
        } catch (e) {
          // 如果解析失败，使用默认值
        }
      }

      // 4. 成本汇总
      const costSummary = {
        totalMaterialCost: order.actual_material_cost,
        totalLaborCost: order.actual_labor_cost,
        totalOverheadCost: order.actual_overhead_cost,
        totalCost: order.actual_total_cost,
        unitCost: order.quantity > 0 ? order.actual_total_cost / order.quantity : 0
      };

      // 5. 标准成本对比（如果使用标准成本法）
      const productCost = this.getProductCost(order.product_id);
      let standardCostInfo: {
        standardMaterialCost: number;
        standardLaborCost: number;
        standardOverheadCost: number;
        standardTotalCost: number;
        variance?: {
          materialVariance: number;
          laborVariance: number;
          overheadVariance: number;
          totalVariance: number;
          varianceRate: number;
        };
      } | undefined;

      if (productCost && productCost.costing_method === 'standard') {
        const standardMaterialCost = (productCost.standard_material_cost || 0) * order.quantity;
        const standardLaborCost = (productCost.standard_labor_cost || 0) * order.quantity;
        const standardOverheadCost = (productCost.standard_overhead_cost || 0) * order.quantity;
        const standardTotalCost = standardMaterialCost + standardLaborCost + standardOverheadCost;

        const materialVariance = order.actual_material_cost - standardMaterialCost;
        const laborVariance = order.actual_labor_cost - standardLaborCost;
        const overheadVariance = order.actual_overhead_cost - standardOverheadCost;
        const totalVariance = materialVariance + laborVariance + overheadVariance;
        const varianceRate = standardTotalCost > 0 ? (totalVariance / standardTotalCost) * 100 : 0;

        standardCostInfo = {
          standardMaterialCost,
          standardLaborCost,
          standardOverheadCost,
          standardTotalCost,
          variance: {
            materialVariance,
            laborVariance,
            overheadVariance,
            totalVariance,
            varianceRate
          }
        };
      }

      // 6. 构建成本计算单
      const costSheet = {
        order,
        product,
        costAccumulation: {
          material: {
            total: order.actual_material_cost,
            transactions: materialTransactions
          },
          labor: {
            total: order.actual_labor_cost,
            allocations: laborAllocations
          },
          overhead: overheadInfo
        },
        costSummary,
        standardCost: standardCostInfo,
        generatedAt: new Date().toISOString()
      };

      return costSheet;
    }


}
