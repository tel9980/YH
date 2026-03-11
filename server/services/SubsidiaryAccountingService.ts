import Database from "better-sqlite3";
import { SubsidiaryLedger, AuxiliaryData } from "../../src/types.js";

/**
 * 辅助核算服务
 * 负责辅助核算明细账查询和往来对账单生成
 */
export class SubsidiaryAccountingService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 获取辅助核算明细账
   * 属性34: 辅助核算明细账查询准确性
   * 
   * @param account_id 科目编码
   * @param auxiliary_type 辅助核算类型（customer, supplier, department, project, inventory）
   * @param auxiliary_id 辅助核算实体ID
   * @param start_date 开始日期 (YYYY-MM-DD)
   * @param end_date 结束日期 (YYYY-MM-DD)
   * @returns 辅助核算明细账
   */
  getSubsidiaryLedger(
    account_id: string,
    auxiliary_type: 'customer' | 'supplier' | 'department' | 'project' | 'inventory',
    auxiliary_id: number,
    start_date: string,
    end_date: string
  ): SubsidiaryLedger {
    // 获取辅助实体名称
    const auxiliary_name = this.getAuxiliaryName(auxiliary_type, auxiliary_id);

    // 计算期初余额（start_date 之前的余额）
    const opening_balance = this.calculateOpeningBalance(
      account_id,
      auxiliary_type,
      auxiliary_id,
      start_date
    );

    // 获取期间内的交易记录
    const transactions = this.getTransactions(
      account_id,
      auxiliary_type,
      auxiliary_id,
      start_date,
      end_date
    );

    // 计算每笔交易后的余额
    let running_balance = opening_balance;
    const transactions_with_balance = transactions.map(tx => {
      running_balance += tx.debit - tx.credit;
      return {
        ...tx,
        balance: running_balance
      };
    });

    // 计算期末余额
    const closing_balance = running_balance;

    return {
      account_id,
      auxiliary_type,
      auxiliary_id,
      auxiliary_name,
      period: `${start_date} 至 ${end_date}`,
      opening_balance,
      transactions: transactions_with_balance,
      closing_balance
    };
  }

  /**
   * 获取辅助实体名称
   */
  private getAuxiliaryName(
    auxiliary_type: string,
    auxiliary_id: number
  ): string {
    let table: string;
    let nameField: string;

    switch (auxiliary_type) {
      case 'customer':
        table = 'customers';
        nameField = 'name';
        break;
      case 'supplier':
        table = 'suppliers';
        nameField = 'name';
        break;
      case 'department':
        table = 'departments';
        nameField = 'name';
        break;
      case 'project':
        table = 'projects';
        nameField = 'name';
        break;
      case 'inventory':
        table = 'inventory';
        nameField = 'name';
        break;
      default:
        return '未知';
    }

    try {
      const result = this.db
        .prepare(`SELECT ${nameField} as name FROM ${table} WHERE id = ?`)
        .get(auxiliary_id) as { name: string } | undefined;

      return result?.name || '未知';
    } catch (error) {
      // 如果表不存在或查询失败，返回默认值
      return `${auxiliary_type}_${auxiliary_id}`;
    }
  }

  /**
   * 计算期初余额
   */
  private calculateOpeningBalance(
    account_id: string,
    auxiliary_type: string,
    auxiliary_id: number,
    start_date: string
  ): number {
    const auxiliary_field = `${auxiliary_type}_id`;

    const result = this.db.prepare(`
      SELECT 
        COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) as balance
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_id = ?
        AND v.date < ?
        AND v.status = 'approved'
        AND json_extract(vl.auxiliary_data, '$.${auxiliary_field}') = ?
    `).get(account_id, start_date, auxiliary_id) as { balance: number };

    return result.balance || 0;
  }

  /**
   * 获取期间内的交易记录
   */
  private getTransactions(
    account_id: string,
    auxiliary_type: string,
    auxiliary_id: number,
    start_date: string,
    end_date: string
  ): Array<{
    date: string;
    voucher_no: string;
    notes: string;
    debit: number;
    credit: number;
  }> {
    const auxiliary_field = `${auxiliary_type}_id`;

    const transactions = this.db.prepare(`
      SELECT 
        v.date,
        v.voucher_no,
        COALESCE(vl.notes, v.notes) as notes,
        vl.debit,
        vl.credit
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_id = ?
        AND v.date >= ?
        AND v.date <= ?
        AND v.status = 'approved'
        AND json_extract(vl.auxiliary_data, '$.${auxiliary_field}') = ?
      ORDER BY v.date, v.voucher_no
    `).all(account_id, start_date, end_date, auxiliary_id) as any[];

    return transactions.map(tx => ({
      date: tx.date,
      voucher_no: tx.voucher_no,
      notes: tx.notes || '',
      debit: tx.debit || 0,
      credit: tx.credit || 0
    }));
  }

  /**
   * 按客户查询应收账款明细账
   * 便捷方法，封装了常用的客户往来查询
   */
  getCustomerLedger(
    customer_id: number,
    start_date: string,
    end_date: string
  ): SubsidiaryLedger {
    return this.getSubsidiaryLedger(
      '1122', // 应收账款科目
      'customer',
      customer_id,
      start_date,
      end_date
    );
  }

  /**
   * 按供应商查询应付账款明细账
   * 便捷方法，封装了常用的供应商往来查询
   */
  getSupplierLedger(
    supplier_id: number,
    start_date: string,
    end_date: string
  ): SubsidiaryLedger {
    return this.getSubsidiaryLedger(
      '2202', // 应付账款科目
      'supplier',
      supplier_id,
      start_date,
      end_date
    );
  }

  /**
   * 按存货查询库存商品明细账
   * 便捷方法，封装了常用的存货核算查询
   */
  getInventoryLedger(
    inventory_id: number,
    start_date: string,
    end_date: string
  ): SubsidiaryLedger {
    return this.getSubsidiaryLedger(
      '1405', // 库存商品科目
      'inventory',
      inventory_id,
      start_date,
      end_date
    );
  }

  /**
   * 获取所有客户的应收账款汇总
   * 用于生成客户往来汇总表
   */
  getAllCustomerBalances(as_of_date: string): Array<{
    customer_id: number;
    customer_name: string;
    balance: number;
  }> {
    const results = this.db.prepare(`
      SELECT 
        json_extract(vl.auxiliary_data, '$.customer_id') as customer_id,
        COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) as balance
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_id = '1122'
        AND v.date <= ?
        AND v.status = 'approved'
        AND json_extract(vl.auxiliary_data, '$.customer_id') IS NOT NULL
      GROUP BY json_extract(vl.auxiliary_data, '$.customer_id')
      HAVING ABS(balance) > 0.01
      ORDER BY balance DESC
    `).all(as_of_date) as any[];

    return results.map(r => ({
      customer_id: r.customer_id,
      customer_name: this.getAuxiliaryName('customer', r.customer_id),
      balance: r.balance
    }));
  }

  /**
   * 获取所有供应商的应付账款汇总
   * 用于生成供应商往来汇总表
   */
  getAllSupplierBalances(as_of_date: string): Array<{
    supplier_id: number;
    supplier_name: string;
    balance: number;
  }> {
    const results = this.db.prepare(`
      SELECT 
        json_extract(vl.auxiliary_data, '$.supplier_id') as supplier_id,
        COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) as balance
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_id = '2202'
        AND v.date <= ?
        AND v.status = 'approved'
        AND json_extract(vl.auxiliary_data, '$.supplier_id') IS NOT NULL
      GROUP BY json_extract(vl.auxiliary_data, '$.supplier_id')
      HAVING ABS(balance) > 0.01
      ORDER BY balance DESC
    `).all(as_of_date) as any[];

    return results.map(r => ({
      supplier_id: r.supplier_id,
      supplier_name: this.getAuxiliaryName('supplier', r.supplier_id),
      balance: r.balance
    }));
  }

  /**
   * 生成往来对账单
   * 属性35: 往来对账单数据准确性
   * 
   * 对于客户：显示销售订单（借方）和收款记录（贷方）
   * 对于供应商：显示采购账单（贷方）和付款记录（借方）
   * 
   * @param type 对账单类型（customer 或 supplier）
   * @param entity_id 客户或供应商ID
   * @param start_date 开始日期 (YYYY-MM-DD)
   * @param end_date 结束日期 (YYYY-MM-DD)
   * @returns 往来对账单
   */
  generateReconciliationStatement(
    type: 'customer' | 'supplier',
    entity_id: number,
    start_date: string,
    end_date: string
  ): any {
    // 确定科目和辅助核算类型
    const account_id = type === 'customer' ? '1122' : '2202'; // 应收账款 or 应付账款
    const auxiliary_type = type;

    // 获取实体名称
    const entity_name = this.getAuxiliaryName(auxiliary_type, entity_id);

    // 计算期初余额
    const opening_balance = this.calculateOpeningBalance(
      account_id,
      auxiliary_type,
      entity_id,
      start_date
    );

    // 获取期间内的交易记录，包含源单据信息
    const transactions = this.getReconciliationTransactions(
      account_id,
      auxiliary_type,
      entity_id,
      start_date,
      end_date
    );

    // 计算每笔交易后的余额
    let running_balance = opening_balance;
    const transactions_with_balance = transactions.map(tx => {
      running_balance += tx.debit - tx.credit;
      return {
        date: tx.date,
        type: tx.type,
        reference_no: tx.reference_no,
        debit: tx.debit,
        credit: tx.credit,
        balance: running_balance
      };
    });

    // 计算期末余额
    const closing_balance = running_balance;

    return {
      type,
      entity_id,
      entity_name,
      period: `${start_date} 至 ${end_date}`,
      opening_balance,
      transactions: transactions_with_balance,
      closing_balance
    };
  }

  /**
   * 获取往来对账单的交易记录
   * 包含业务类型和源单据编号信息
   */
  private getReconciliationTransactions(
    account_id: string,
    auxiliary_type: string,
    auxiliary_id: number,
    start_date: string,
    end_date: string
  ): Array<{
    date: string;
    type: string;
    reference_no: string;
    debit: number;
    credit: number;
  }> {
    const auxiliary_field = `${auxiliary_type}_id`;

    const transactions = this.db.prepare(`
      SELECT 
        v.date,
        v.voucher_type,
        v.source_type,
        v.source_id,
        v.voucher_no,
        COALESCE(vl.notes, v.notes) as notes,
        vl.debit,
        vl.credit
      FROM voucher_lines vl
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE vl.account_id = ?
        AND v.date >= ?
        AND v.date <= ?
        AND v.status = 'approved'
        AND json_extract(vl.auxiliary_data, '$.${auxiliary_field}') = ?
      ORDER BY v.date, v.voucher_no
    `).all(account_id, start_date, end_date, auxiliary_id) as any[];

    return transactions.map(tx => {
      // 确定交易类型描述
      let type_description = this.getTransactionTypeDescription(
        tx.voucher_type,
        tx.source_type,
        auxiliary_type
      );

      // 确定参考单号
      let reference_no = tx.voucher_no;
      if (tx.source_type && tx.source_id) {
        const source_no = this.getSourceDocumentNo(tx.source_type, tx.source_id);
        if (source_no) {
          reference_no = `${source_no} (${tx.voucher_no})`;
        }
      }

      return {
        date: tx.date,
        type: type_description,
        reference_no,
        debit: tx.debit || 0,
        credit: tx.credit || 0
      };
    });
  }

  /**
   * 获取交易类型描述
   */
  private getTransactionTypeDescription(
    voucher_type: string,
    source_type: string | null,
    auxiliary_type: string
  ): string {
    // 如果有源单据类型，优先使用源单据类型
    if (source_type) {
      const typeMap: Record<string, string> = {
        'order': '销售订单',
        'income': '收款',
        'expense': '付款',
        'supplier_bill': '采购账单'
      };
      return typeMap[source_type] || source_type;
    }

    // 否则根据凭证类型判断
    if (auxiliary_type === 'customer') {
      // 客户往来：借方是销售，贷方是收款
      const typeMap: Record<string, string> = {
        'sales': '销售',
        'receipt': '收款',
        'manual': '手工凭证',
        'closing': '结账凭证'
      };
      return typeMap[voucher_type] || voucher_type;
    } else {
      // 供应商往来：贷方是采购，借方是付款
      const typeMap: Record<string, string> = {
        'purchase': '采购',
        'payment': '付款',
        'manual': '手工凭证',
        'closing': '结账凭证'
      };
      return typeMap[voucher_type] || voucher_type;
    }
  }

  /**
   * 获取源单据编号
   */
  private getSourceDocumentNo(
    source_type: string,
    source_id: number
  ): string | null {
    try {
      let table: string;
      let field: string;

      switch (source_type) {
        case 'order':
          table = 'orders';
          field = 'order_no';
          break;
        case 'income':
          table = 'incomes';
          field = 'income_no';
          break;
        case 'expense':
          table = 'expenses';
          field = 'expense_no';
          break;
        case 'supplier_bill':
          table = 'supplier_bills';
          field = 'bill_no';
          break;
        default:
          return null;
      }

      const result = this.db
        .prepare(`SELECT ${field} as doc_no FROM ${table} WHERE id = ?`)
        .get(source_id) as { doc_no: string } | undefined;

      return result?.doc_no || null;
    } catch (error) {
      // 如果表不存在或查询失败，返回 null
      return null;
    }
  }
}
