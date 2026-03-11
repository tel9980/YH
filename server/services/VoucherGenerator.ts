import Database from "better-sqlite3";
import { Voucher, VoucherLine } from "../../src/types.js";

/**
 * 凭证自动生成引擎
 * 根据业务单据自动生成符合会计准则的记账凭证
 */
export class VoucherGenerator {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 根据业务单据生成凭证
   * 属性5: 销售订单凭证自动生成完整性
   * 属性6: 收款方式与货币资金科目匹配
   * 属性7: 凭证与源单据双向关联
   */
  async generateVoucher(sourceType: string, sourceId: number): Promise<number | null> {
    try {
      switch (sourceType) {
        case 'order':
          return await this.generateSalesVoucher(sourceId);
        case 'income':
          return await this.generateReceiptVoucher(sourceId);
        case 'expense':
          return await this.generateExpenseVoucher(sourceId);
        case 'supplier_bill':
          return await this.generatePurchaseVoucher(sourceId);
        default:
          throw new Error(`不支持的单据类型: ${sourceType}`);
      }
    } catch (error) {
      console.error(`凭证生成失败 [${sourceType}:${sourceId}]:`, error);
      // 属性8: 凭证生成失败记录日志
      this.logError(sourceType, sourceId, error);
      return null;
    }
  }

  /**
   * 生成销售订单凭证
   * 同时生成销售收入凭证和成本结转凭证
   */
  private async generateSalesVoucher(orderId: number): Promise<number> {
    const order = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
    if (!order) throw new Error('订单不存在');

    const lines: VoucherLine[] = [];
    
    // 计算税额
    const taxAmount = order.total * (order.tax_rate / (100 + order.tax_rate));
    const netAmount = order.total - taxAmount;

    // 借：应收账款
    lines.push({
      line_no: 1,
      account_id: '1122',
      debit: order.total,
      credit: 0,
      auxiliary_data: { customer_id: this.getCustomerId(order.customer) },
      notes: `销售：${order.product}`
    });

    // 贷：主营业务收入
    lines.push({
      line_no: 2,
      account_id: '500101',
      debit: 0,
      credit: netAmount,
      notes: `销售：${order.product}`
    });

    // 贷：应交税费-销项税额
    if (taxAmount > 0) {
      lines.push({
        line_no: 3,
        account_id: '222102',
        debit: 0,
        credit: taxAmount,
        notes: '销项税额'
      });
    }

    // 结转成本
    const costLines = await this.generateCostTransferLines(order);
    costLines.forEach((line, index) => {
      lines.push({ ...line, line_no: lines.length + 1 });
    });

    // 创建凭证
    const voucherId = this.createVoucher({
      date: order.date,
      voucher_no: this.generateVoucherNo('sales', order.date, orderId),
      voucher_type: 'sales',
      notes: `销售：${order.customer} - ${order.product}`,
      status: 'approved',
      source_type: 'order',
      source_id: orderId,
      lines
    });

    // 更新订单的凭证ID（双向关联）
    this.db.prepare("UPDATE orders SET voucher_id = ? WHERE id = ?").run(voucherId, orderId);

    return voucherId;
  }

  /**
   * 生成成本结转分录
   */
  private async generateCostTransferLines(order: any): Promise<VoucherLine[]> {
    const lines: VoucherLine[] = [];

    // 查询产品成本
    const product = this.db.prepare("SELECT * FROM products WHERE name = ?").get(order.product) as any;
    if (!product) return lines;

    const productCost = this.db.prepare("SELECT * FROM product_costs WHERE product_id = ?").get(product.id) as any;
    const inventory = this.db.prepare("SELECT * FROM inventory WHERE name = ?").get(order.product) as any;

    let unitCost = 0;
    
    if (productCost && productCost.costing_method === 'standard') {
      // 标准成本法
      unitCost = productCost.standard_total_cost || 0;
    } else if (inventory) {
      // 实际成本法
      unitCost = inventory.unit_cost || 0;
    }

    if (unitCost > 0) {
      const totalCost = unitCost * order.qty;

      // 借：主营业务成本
      lines.push({
        line_no: 0,
        account_id: '5401',
        debit: totalCost,
        credit: 0,
        notes: '结转成本'
      });

      // 贷：库存商品
      lines.push({
        line_no: 0,
        account_id: '1405',
        debit: 0,
        credit: totalCost,
        auxiliary_data: { inventory_id: inventory?.id },
        notes: '结转成本'
      });
    }

    return lines;
  }

  /**
   * 生成收款凭证
   * 属性6: 收款方式与货币资金科目匹配
   */
  private async generateReceiptVoucher(incomeId: number): Promise<number> {
    const income = this.db.prepare("SELECT * FROM incomes WHERE id = ?").get(incomeId) as any;
    if (!income) throw new Error('收款记录不存在');

    // 根据收款方式匹配货币资金科目
    const cashAccount = this.getCashAccountByMethod(income.bank);

    const lines: VoucherLine[] = [
      {
        line_no: 1,
        account_id: cashAccount,
        debit: income.amount,
        credit: 0,
        notes: `收款：${income.customer}`
      },
      {
        line_no: 2,
        account_id: '1122',
        debit: 0,
        credit: income.amount,
        auxiliary_data: { customer_id: this.getCustomerId(income.customer) },
        notes: `收款：${income.customer}`
      }
    ];

    const voucherId = this.createVoucher({
      date: income.date,
      voucher_no: this.generateVoucherNo('receipt', income.date, incomeId),
      voucher_type: 'receipt',
      notes: `收款：${income.customer}`,
      status: 'approved',
      source_type: 'income',
      source_id: incomeId,
      lines
    });

    this.db.prepare("UPDATE incomes SET voucher_id = ? WHERE id = ?").run(voucherId, incomeId);

    return voucherId;
  }

  /**
   * 生成费用支出凭证
   */
  private async generateExpenseVoucher(expenseId: number): Promise<number> {
    const expense = this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId) as any;
    if (!expense) throw new Error('费用记录不存在');

    const paymentAccount = this.getCashAccountByMethod(expense.method);
    const debitAccount = expense.account_id || '6602'; // 默认管理费用

    const lines: VoucherLine[] = [
      {
        line_no: 1,
        account_id: debitAccount,
        debit: expense.amount,
        credit: 0,
        notes: `${expense.category} - ${expense.notes || ''}`
      },
      {
        line_no: 2,
        account_id: paymentAccount,
        debit: 0,
        credit: expense.amount,
        notes: `支付：${expense.supplier || expense.category}`
      }
    ];

    const voucherId = this.createVoucher({
      date: expense.date,
      voucher_no: this.generateVoucherNo('payment', expense.date, expenseId),
      voucher_type: 'payment',
      notes: `支出：${expense.category}`,
      status: 'approved',
      source_type: 'expense',
      source_id: expenseId,
      lines
    });

    this.db.prepare("UPDATE expenses SET voucher_id = ? WHERE id = ?").run(voucherId, expenseId);

    return voucherId;
  }

  /**
   * 生成采购凭证
   */
  private async generatePurchaseVoucher(billId: number): Promise<number> {
    const bill = this.db.prepare("SELECT * FROM supplier_bills WHERE id = ?").get(billId) as any;
    if (!bill) throw new Error('供应商账单不存在');

    const lines: VoucherLine[] = [
      {
        line_no: 1,
        account_id: '1403', // 原材料
        debit: bill.amount,
        credit: 0,
        notes: `采购：${bill.category}`
      },
      {
        line_no: 2,
        account_id: '2202', // 应付账款
        debit: 0,
        credit: bill.amount,
        auxiliary_data: { supplier_id: this.getSupplierId(bill.supplier) },
        notes: `应付：${bill.supplier}`
      }
    ];

    const voucherId = this.createVoucher({
      date: bill.date,
      voucher_no: this.generateVoucherNo('purchase', bill.date, billId),
      voucher_type: 'purchase',
      notes: `采购：${bill.supplier} - ${bill.category}`,
      status: 'approved',
      source_type: 'supplier_bill',
      source_id: billId,
      lines
    });

    this.db.prepare("UPDATE supplier_bills SET voucher_id = ? WHERE id = ?").run(voucherId, billId);

    return voucherId;
  }

  /**
   * 创建凭证
   */
  private createVoucher(voucher: Omit<Voucher, 'id'>): number {
    const transaction = this.db.transaction(() => {
      const result = this.db.prepare(`
        INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, source_type, source_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        voucher.date,
        voucher.voucher_no,
        voucher.voucher_type,
        voucher.notes,
        voucher.status || 'draft',
        voucher.source_type,
        voucher.source_id
      );

      const voucherId = result.lastInsertRowid as number;

      const lineStmt = this.db.prepare(`
        INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, auxiliary_data, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      voucher.lines.forEach(line => {
        lineStmt.run(
          voucherId,
          line.line_no,
          line.account_id,
          line.debit,
          line.credit,
          line.auxiliary_data ? JSON.stringify(line.auxiliary_data) : null,
          line.notes
        );
      });

      return voucherId;
    });

    return transaction();
  }

  /**
   * 生成凭证号
   */
  private generateVoucherNo(type: string, date: string, id: number): string {
    const prefix = {
      'sales': '销',
      'receipt': '收',
      'payment': '付',
      'purchase': '购',
      'closing': '结'
    }[type] || '记';

    const dateStr = date.replace(/-/g, '').substring(2); // YYMMDD
    const idStr = id.toString().padStart(4, '0');
    
    return `${prefix}-${dateStr}-${idStr}`;
  }

  /**
   * 根据收款方式获取货币资金科目
   */
  private getCashAccountByMethod(method: string): string {
    const paymentMethod = this.db.prepare(
      "SELECT type FROM payment_methods WHERE name = ?"
    ).get(method) as any;

    if (!paymentMethod) return '1002'; // 默认银行存款

    switch (paymentMethod.type) {
      case 'Cash':
        return '1001'; // 库存现金
      case 'Bank':
      case 'Digital':
        return '1002'; // 银行存款
      default:
        return '1002';
    }
  }

  /**
   * 获取客户ID
   */
  private getCustomerId(customerName: string): number | undefined {
    const customer = this.db.prepare("SELECT id FROM customers WHERE name = ?").get(customerName) as any;
    return customer?.id;
  }

  /**
   * 获取供应商ID
   */
  private getSupplierId(supplierName: string): number | undefined {
    const supplier = this.db.prepare("SELECT id FROM suppliers WHERE name = ?").get(supplierName) as any;
    return supplier?.id;
  }

  /**
   * 记录错误日志
   */
  private logError(sourceType: string, sourceId: number, error: any) {
    this.db.prepare(`
      INSERT INTO audit_logs (timestamp, action, details)
      VALUES (?, ?, ?)
    `).run(
      new Date().toISOString(),
      'voucher_generation_failed',
      JSON.stringify({
        source_type: sourceType,
        source_id: sourceId,
        error: error.message
      })
    );
  }

  /**
   * 批量生成凭证
   * 性能优化: 使用事务批量处理
   */
  async batchGenerateVouchers(sourceType: string, ids: number[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 使用事务批量处理
    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        try {
          const voucherId = this.generateVoucherSync(sourceType, id);
          if (voucherId) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`批量生成凭证失败 [${sourceType}:${id}]:`, error);
          failed++;
        }
      }
    });

    transaction();

    return { success, failed };
  }

  /**
   * 同步生成凭证（用于事务内部）
   */
  private generateVoucherSync(sourceType: string, sourceId: number): number | null {
    try {
      switch (sourceType) {
        case 'order':
          return this.generateSalesVoucher(sourceId);
        case 'income':
          return this.generateReceiptVoucher(sourceId);
        case 'expense':
          return this.generateExpenseVoucher(sourceId);
        case 'supplier_bill':
          return this.generatePurchaseVoucher(sourceId);
        default:
          throw new Error(`不支持的单据类型: ${sourceType}`);
      }
    } catch (error) {
      console.error(`凭证生成失败 [${sourceType}:${sourceId}]:`, error);
      this.logError(sourceType, sourceId, error);
      return null;
    }
  }
}
