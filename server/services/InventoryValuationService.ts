import Database from "better-sqlite3";
import { InventoryValuationConfig, InventoryTransactionV7 } from "../../src/types.js";

/**
 * 库存计价服务
 * 支持FIFO、加权平均、移动加权平均、个别计价法
 */
export class InventoryValuationService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 获取库存计价配置
   */
  getValuationConfig(): InventoryValuationConfig {
    const config = this.db.prepare("SELECT * FROM inventory_valuation_config WHERE id = 1").get() as InventoryValuationConfig;
    return config || { id: 1, method: 'weighted_average' };
  }

  /**
   * 更新库存计价方法
   * 属性24: 库存计价方法全局应用
   * 属性27: 库存计价方法变更记录日志
   */
  updateValuationConfig(method: InventoryValuationConfig['method'], userId: string): void {
    const oldConfig = this.getValuationConfig();
    
    this.db.prepare(`
      UPDATE inventory_valuation_config 
      SET method = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = 1
    `).run(method, userId);

    // 记录变更日志
    this.db.prepare(`
      INSERT INTO audit_logs (timestamp, action, details)
      VALUES (?, 'inventory_valuation_method_changed', ?)
    `).run(
      new Date().toISOString(),
      JSON.stringify({
        old_method: oldConfig.method,
        new_method: method,
        changed_by: userId
      })
    );
  }

  /**
   * 记录库存变动
   * 属性26: 库存变动记录完整性
   */
  recordTransaction(transaction: Omit<InventoryTransactionV7, 'id' | 'created_at'>): number {
    const result = this.db.prepare(`
      INSERT INTO inventory_transactions 
      (item_id, transaction_date, transaction_type, quantity, unit_cost, total_cost, 
       balance_quantity, balance_cost, reference_type, reference_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      transaction.item_id,
      transaction.transaction_date,
      transaction.transaction_type,
      transaction.quantity,
      transaction.unit_cost,
      transaction.total_cost,
      transaction.balance_quantity,
      transaction.balance_cost,
      transaction.reference_type,
      transaction.reference_id,
      transaction.notes
    );

    return result.lastInsertRowid as number;
  }

  /**
   * 先进先出法 (FIFO)
   * 属性25: FIFO 出库成本计算
   */
  calculateFIFO(itemId: number, outQuantity: number): number {
    // 获取该商品的所有入库记录（按日期排序）
    const inboundRecords = this.db.prepare(`
      SELECT * FROM inventory_transactions 
      WHERE item_id = ? AND transaction_type = 'in' AND balance_quantity > 0
      ORDER BY transaction_date ASC, id ASC
    `).all(itemId) as InventoryTransactionV7[];

    let remainingQty = outQuantity;
    let totalCost = 0;

    for (const record of inboundRecords) {
      if (remainingQty <= 0) break;

      const availableQty = record.balance_quantity;
      const qtyToUse = Math.min(remainingQty, availableQty);
      
      totalCost += qtyToUse * record.unit_cost;
      remainingQty -= qtyToUse;

      // 更新入库记录的剩余数量
      this.db.prepare(`
        UPDATE inventory_transactions 
        SET balance_quantity = balance_quantity - ?
        WHERE id = ?
      `).run(qtyToUse, record.id);
    }

    if (remainingQty > 0) {
      throw new Error(`库存不足，缺少 ${remainingQty} 单位`);
    }

    return totalCost;
  }

  /**
   * 加权平均法
   */
  calculateWeightedAverage(itemId: number, outQuantity: number): number {
    const inventory = this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
    if (!inventory) throw new Error('库存项目不存在');

    if (inventory.total_quantity < outQuantity) {
      throw new Error('库存数量不足');
    }

    // 加权平均单价 = 库存总金额 / 库存总数量
    const avgUnitCost = inventory.total_cost / inventory.total_quantity;
    return outQuantity * avgUnitCost;
  }

  /**
   * 移动加权平均法
   */
  calculateMovingAverage(itemId: number, inQuantity: number, inCost: number): number {
    const inventory = this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
    if (!inventory) throw new Error('库存项目不存在');

    // 新的加权平均单价 = (原库存金额 + 新入库金额) / (原库存数量 + 新入库数量)
    const newTotalCost = inventory.total_cost + inCost;
    const newTotalQty = inventory.total_quantity + inQuantity;
    const newAvgUnitCost = newTotalCost / newTotalQty;

    // 更新库存单价
    this.db.prepare(`
      UPDATE inventory 
      SET unit_cost = ?, total_cost = ?, total_quantity = ?
      WHERE id = ?
    `).run(newAvgUnitCost, newTotalCost, newTotalQty, itemId);

    return newAvgUnitCost;
  }

  /**
   * 处理出库
   */
  processOutbound(itemId: number, quantity: number, referenceType?: string, referenceId?: number): number {
    const config = this.getValuationConfig();
    const inventory = this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
    
    if (!inventory) throw new Error('库存项目不存在');
    if (inventory.stock < quantity) throw new Error('库存数量不足');

    let totalCost = 0;

    switch (config.method) {
      case 'fifo':
        totalCost = this.calculateFIFO(itemId, quantity);
        break;
      case 'weighted_average':
        totalCost = this.calculateWeightedAverage(itemId, quantity);
        break;
      case 'moving_average':
        totalCost = this.calculateWeightedAverage(itemId, quantity);
        break;
      default:
        throw new Error(`不支持的计价方法: ${config.method}`);
    }

    const unitCost = totalCost / quantity;
    const newStock = inventory.stock - quantity;
    const newTotalCost = inventory.total_cost - totalCost;

    // 更新库存
    this.db.prepare(`
      UPDATE inventory 
      SET stock = ?, total_cost = ?
      WHERE id = ?
    `).run(newStock, newTotalCost, itemId);

    // 记录库存变动
    this.recordTransaction({
      item_id: itemId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'out',
      quantity: -quantity,
      unit_cost: unitCost,
      total_cost: -totalCost,
      balance_quantity: newStock,
      balance_cost: newTotalCost,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: '出库'
    });

    return totalCost;
  }

  /**
   * 处理入库
   */
  processInbound(itemId: number, quantity: number, unitCost: number, referenceType?: string, referenceId?: number): void {
    const inventory = this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
    if (!inventory) throw new Error('库存项目不存在');

    const config = this.getValuationConfig();
    const totalCost = quantity * unitCost;
    const newStock = inventory.stock + quantity;
    const newTotalCost = inventory.total_cost + totalCost;

    // 如果是移动加权平均法，重新计算平均单价
    if (config.method === 'moving_average') {
      this.calculateMovingAverage(itemId, quantity, totalCost);
    } else {
      this.db.prepare(`
        UPDATE inventory 
        SET stock = ?, total_cost = ?
        WHERE id = ?
      `).run(newStock, newTotalCost, itemId);
    }

    // 记录库存变动
    this.recordTransaction({
      item_id: itemId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'in',
      quantity: quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      balance_quantity: newStock,
      balance_cost: newTotalCost,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: '入库'
    });
  }

  /**
   * 库存成本调整
   */
  adjustInventoryCost(itemId: number, adjustmentAmount: number, notes: string): void {
    const inventory = this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(itemId) as any;
    if (!inventory) throw new Error('库存项目不存在');

    const newTotalCost = inventory.total_cost + adjustmentAmount;
    const newUnitCost = inventory.stock > 0 ? newTotalCost / inventory.stock : 0;

    this.db.prepare(`
      UPDATE inventory 
      SET total_cost = ?, unit_cost = ?
      WHERE id = ?
    `).run(newTotalCost, newUnitCost, itemId);

    // 记录调整
    this.recordTransaction({
      item_id: itemId,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'adjustment',
      quantity: 0,
      unit_cost: newUnitCost,
      total_cost: adjustmentAmount,
      balance_quantity: inventory.stock,
      balance_cost: newTotalCost,
      notes: notes
    });
  }

  /**
   * 获取库存明细账
   */
  getInventoryLedger(itemId: number, startDate?: string, endDate?: string): InventoryTransactionV7[] {
    let query = "SELECT * FROM inventory_transactions WHERE item_id = ?";
    const params: any[] = [itemId];

    if (startDate) {
      query += " AND transaction_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND transaction_date <= ?";
      params.push(endDate);
    }

    query += " ORDER BY transaction_date ASC, id ASC";

    return this.db.prepare(query).all(...params) as InventoryTransactionV7[];
  }
}
