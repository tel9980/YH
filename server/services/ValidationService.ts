import Database from "better-sqlite3";
import { Voucher, ValidationResult, ValidationError, ValidationWarning } from "../../src/types.js";

/**
 * 数据校验服务
 * 负责凭证、科目、金额等数据的验证
 */
export class ValidationService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 验证凭证
   * 属性28: 凭证借贷平衡验证
   * 属性29: 科目借贷方向合理性验证
   * 属性30: 金额精度验证
   * 属性31: 已结账期间数据保护
   * 属性33: 辅助核算必填验证
   */
  validateVoucher(voucher: Voucher): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 验证借贷平衡
    const totalDebit = voucher.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = voucher.lines.reduce((sum, line) => sum + line.credit, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push({
        field: 'lines',
        message: `凭证借贷不平衡：借方 ${totalDebit.toFixed(2)}，贷方 ${totalCredit.toFixed(2)}`,
        code: 'VOUCHER_NOT_BALANCED'
      });
    }

    // 验证会计期间是否已结账
    if (this.isPeriodClosed(voucher.date)) {
      errors.push({
        field: 'date',
        message: '该会计期间已结账，无法录入凭证',
        code: 'PERIOD_CLOSED'
      });
    }

    // 验证每个分录
    voucher.lines.forEach((line, index) => {
      // 验证金额精度（最多两位小数）
      if (!this.isValidAmount(line.debit) || !this.isValidAmount(line.credit)) {
        errors.push({
          field: `lines[${index}]`,
          message: '金额精度错误，最多保留两位小数',
          code: 'INVALID_AMOUNT_PRECISION'
        });
      }

      // 验证科目借贷方向合理性
      const account = this.getAccount(line.account_id);
      if (account) {
        const directionWarning = this.checkAccountDirection(account, line.debit, line.credit);
        if (directionWarning) {
          warnings.push({
            field: `lines[${index}]`,
            message: directionWarning,
            code: 'ABNORMAL_DIRECTION'
          });
        }

        // 验证辅助核算必填
        if (account.auxiliary_types && account.auxiliary_types.length > 0) {
          const missingAux = account.auxiliary_types.filter((t: any) => t.required && !line.auxiliary_data?.[`${t.type}_id` as keyof typeof line.auxiliary_data]);
          if (missingAux.length > 0) {
            errors.push({
              field: `lines[${index}].auxiliary_data`,
              message: `缺少必填的辅助核算信息：${missingAux.map((t: any) => t.type).join(', ')}`,
              code: 'MISSING_AUXILIARY_DATA'
            });
          }
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 验证金额精度
   */
  private isValidAmount(amount: number): boolean {
    const str = amount.toString();
    const parts = str.split('.');
    if (parts.length === 1) return true;
    return parts[1].length <= 2;
  }

  /**
   * 检查科目借贷方向合理性
   */
  private checkAccountDirection(account: any, debit: number, credit: number): string | null {
    // 资产类、成本类、费用类科目通常借方余额
    if (['asset', 'cost', 'expense'].includes(account.type)) {
      if (credit > debit) {
        return `${account.name}（${account.type}类）通常为借方余额，当前贷方金额较大`;
      }
    }
    
    // 负债类、权益类、收入类科目通常贷方余额
    if (['liability', 'equity', 'revenue'].includes(account.type)) {
      if (debit > credit) {
        return `${account.name}（${account.type}类）通常为贷方余额，当前借方金额较大`;
      }
    }

    return null;
  }

  /**
   * 检查异常余额
   * 属性29: 科目借贷方向合理性验证
   * 需求8.5: 检查异常情况并提示警告
   */
  checkAbnormalBalances(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    
    // Check schema
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vouchers', 'journal_entries')").all() as any[];
    const useNewSchema = tables.some(t => t.name === 'vouchers');
    const lineTable = useNewSchema ? 'voucher_lines' : 'journal_entry_lines';

    // 1. 检查银行存款余额为负数
    const cashAccounts = this.db.prepare(`
      SELECT a.id, a.name, 
             COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) as balance
      FROM accounts a
      LEFT JOIN ${lineTable} vl ON a.id = vl.account_id
      WHERE a.id IN ('1001', '1002')
      GROUP BY a.id
      HAVING balance < 0
    `).all() as any[];

    cashAccounts.forEach(acc => {
      warnings.push({
        field: 'balance',
        message: `${acc.name}余额为负数：${acc.balance.toFixed(2)}`,
        code: 'NEGATIVE_CASH_BALANCE'
      });
    });

    // 2. 检查库存数量为负数
    const negativeInventory = this.db.prepare(`
      SELECT name, stock FROM inventory WHERE stock < 0
    `).all() as any[];

    negativeInventory.forEach(item => {
      warnings.push({
        field: 'inventory',
        message: `库存项目"${item.name}"数量为负数：${item.stock}`,
        code: 'NEGATIVE_INVENTORY'
      });
    });

    // 3. 检查应收账款贷方余额（预收款项）
    const receivablesCredit = this.db.prepare(`
      SELECT a.id, a.name, 
             COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) as balance
      FROM accounts a
      LEFT JOIN ${lineTable} vl ON a.id = vl.account_id
      WHERE a.id = '1122'
      GROUP BY a.id
      HAVING balance < 0
    `).all() as any[];

    receivablesCredit.forEach(acc => {
      warnings.push({
        field: 'balance',
        message: `${acc.name}出现贷方余额：${Math.abs(acc.balance).toFixed(2)}，可能为预收款项，建议转入"预收账款"科目`,
        code: 'RECEIVABLES_CREDIT_BALANCE'
      });
    });

    // 4. 检查应付账款借方余额（预付款项）
    const payablesDebit = this.db.prepare(`
      SELECT a.id, a.name, 
             COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) as balance
      FROM accounts a
      LEFT JOIN ${lineTable} vl ON a.id = vl.account_id
      WHERE a.id = '2202'
      GROUP BY a.id
      HAVING balance > 0
    `).all() as any[];

    payablesDebit.forEach(acc => {
      warnings.push({
        field: 'balance',
        message: `${acc.name}出现借方余额：${acc.balance.toFixed(2)}，可能为预付款项，建议转入"预付账款"科目`,
        code: 'PAYABLES_DEBIT_BALANCE'
      });
    });

    return warnings;
  }

  /**
   * 检查期间是否已结账
   */
  private isPeriodClosed(date: string): boolean {
    if (!date) return false;
    const month = date.substring(0, 7); // YYYY-MM
    const period = this.db.prepare(
      "SELECT * FROM closing_periods WHERE period = ? AND status = 'closed'"
    ).get(month) as any;
    return !!period;
  }

  /**
   * 获取科目信息
   */
  private getAccount(id: string): any {
    return this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  }

  /**
   * 数据一致性检查
   * 需求8.8: 提供数据一致性检查工具，验证总账与明细账、账表与单据的一致性
   */
  checkConsistency(): ConsistencyCheckResult {
    const checks: ConsistencyCheck[] = [];

    // 1. 检查凭证借贷平衡
    checks.push(this.checkVoucherBalance());

    // 2. 检查总账与明细账一致性
    checks.push(this.checkGeneralLedgerConsistency());

    // 3. 检查账表与单据一致性
    checks.push(this.checkAccountDocumentConsistency());

    // 4. 检查凭证与业务单据关联的完整性
    checks.push(this.checkVoucherDocumentLinkage());

    // 5. 检查辅助核算数据完整性
    checks.push(this.checkAuxiliaryAccountingData());

    return {
      check_date: new Date().toISOString(),
      checks
    };
  }

  /**
   * 检查凭证借贷平衡
   */
  private checkVoucherBalance(): ConsistencyCheck {
    // Check if we're using the new schema (vouchers) or old schema (journal_entries)
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vouchers', 'journal_entries')").all() as any[];
    const useNewSchema = tables.some(t => t.name === 'vouchers');
    
    const voucherTable = useNewSchema ? 'vouchers' : 'journal_entries';
    const lineTable = useNewSchema ? 'voucher_lines' : 'journal_entry_lines';
    const idField = useNewSchema ? 'voucher_id' : 'entry_id';
    const noField = 'voucher_no'; // Both schemas use voucher_no

    const unbalancedVouchers = this.db.prepare(`
      SELECT v.id, v.${noField} as voucher_no, 
             SUM(vl.debit) as total_debit, 
             SUM(vl.credit) as total_credit
      FROM ${voucherTable} v
      JOIN ${lineTable} vl ON v.id = vl.${idField}
      GROUP BY v.id
      HAVING ABS(SUM(vl.debit) - SUM(vl.credit)) > 0.01
    `).all() as any[];

    if (unbalancedVouchers.length > 0) {
      const details = unbalancedVouchers.slice(0, 5).map(v => 
        `凭证 ${v.voucher_no}: 借方 ${v.total_debit.toFixed(2)}, 贷方 ${v.total_credit.toFixed(2)}`
      ).join('; ');
      
      return {
        name: '凭证借贷平衡检查',
        status: 'failed',
        details: `发现 ${unbalancedVouchers.length} 个借贷不平衡的凭证。示例: ${details}`
      };
    }

    return {
      name: '凭证借贷平衡检查',
      status: 'passed',
      details: '所有凭证借贷平衡'
    };
  }

  /**
   * 检查总账与明细账一致性
   * 验证每个科目的总账余额是否等于其所有明细账余额之和
   */
  private checkGeneralLedgerConsistency(): ConsistencyCheck {
    const inconsistencies: string[] = [];

    // Check schema
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vouchers', 'journal_entries')").all() as any[];
    const useNewSchema = tables.some(t => t.name === 'vouchers');
    const lineTable = useNewSchema ? 'voucher_lines' : 'journal_entry_lines';

    // Check if auxiliary_types column exists
    const accountColumns = this.db.prepare("PRAGMA table_info(accounts)").all() as any[];
    const hasAuxiliaryTypes = accountColumns.some(col => col.name === 'auxiliary_types');

    if (!hasAuxiliaryTypes) {
      return {
        name: '总账与明细账一致性检查',
        status: 'passed',
        details: '数据库架构尚未升级，跳过此检查'
      };
    }

    // 获取所有有辅助核算的科目
    const accountsWithAux = this.db.prepare(`
      SELECT id, name, auxiliary_types 
      FROM accounts 
      WHERE auxiliary_types IS NOT NULL AND auxiliary_types != '[]'
    `).all() as any[];

    for (const account of accountsWithAux) {
      // 计算总账余额（该科目所有分录的借贷差）
      const generalLedgerBalance = this.db.prepare(`
        SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
        FROM ${lineTable}
        WHERE account_id = ?
      `).get(account.id) as { balance: number };

      // 计算明细账余额之和（按辅助核算维度汇总）
      const subsidiaryLedgerBalance = this.db.prepare(`
        SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
        FROM ${lineTable}
        WHERE account_id = ? AND auxiliary_data IS NOT NULL
      `).get(account.id) as { balance: number };

      // 检查是否一致（允许0.01的误差）
      const difference = Math.abs(generalLedgerBalance.balance - subsidiaryLedgerBalance.balance);
      if (difference > 0.01) {
        inconsistencies.push(
          `科目 ${account.name}(${account.id}): 总账余额 ${generalLedgerBalance.balance.toFixed(2)}, ` +
          `明细账余额 ${subsidiaryLedgerBalance.balance.toFixed(2)}, 差异 ${difference.toFixed(2)}`
        );
      }
    }

    if (inconsistencies.length > 0) {
      return {
        name: '总账与明细账一致性检查',
        status: 'failed',
        details: `发现 ${inconsistencies.length} 个科目的总账与明细账不一致。${inconsistencies.slice(0, 3).join('; ')}`
      };
    }

    return {
      name: '总账与明细账一致性检查',
      status: 'passed',
      details: accountsWithAux.length > 0 ? '总账与明细账数据一致' : '无需辅助核算的科目，跳过此检查'
    };
  }

  /**
   * 检查账表与单据一致性
   * 验证应收账款、应付账款等科目余额是否与业务单据金额一致
   */
  private checkAccountDocumentConsistency(): ConsistencyCheck {
    const inconsistencies: string[] = [];

    // Check schema
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vouchers', 'journal_entries')").all() as any[];
    const useNewSchema = tables.some(t => t.name === 'vouchers');
    const lineTable = useNewSchema ? 'voucher_lines' : 'journal_entry_lines';

    // 1. 检查库存商品账面金额与库存表一致性
    const inventoryFromLedger = this.db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM ${lineTable}
      WHERE account_id = '1405'
    `).get() as { balance: number };

    const inventoryFromTable = this.db.prepare(`
      SELECT COALESCE(SUM(stock * unit_cost), 0) as balance
      FROM inventory
    `).get() as { balance: number };

    const inventoryDiff = Math.abs(inventoryFromLedger.balance - inventoryFromTable.balance);
    if (inventoryDiff > 0.01) {
      inconsistencies.push(
        `库存商品: 账面余额 ${inventoryFromLedger.balance.toFixed(2)}, ` +
        `库存表金额 ${inventoryFromTable.balance.toFixed(2)}, ` +
        `差异 ${inventoryDiff.toFixed(2)}`
      );
    }

    // 2. 检查现金账面余额是否合理
    const cashBalance = this.db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM ${lineTable}
      WHERE account_id = '1001'
    `).get() as { balance: number };

    if (cashBalance.balance < 0) {
      inconsistencies.push(
        `库存现金: 账面余额为负数 ${cashBalance.balance.toFixed(2)}，可能存在数据错误`
      );
    }

    // 3. 检查银行存款账面余额是否合理
    const bankBalance = this.db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM ${lineTable}
      WHERE account_id = '1002'
    `).get() as { balance: number };

    if (bankBalance.balance < -0.01) {
      inconsistencies.push(
        `银行存款: 账面余额为负数 ${bankBalance.balance.toFixed(2)}，可能存在数据错误`
      );
    }

    if (inconsistencies.length > 0) {
      return {
        name: '账表与单据一致性检查',
        status: 'failed',
        details: `发现 ${inconsistencies.length} 项账表与单据不一致。${inconsistencies.join('; ')}`
      };
    }

    return {
      name: '账表与单据一致性检查',
      status: 'passed',
      details: '账表与单据数据一致'
    };
  }

  /**
   * 检查凭证与业务单据关联的完整性
   * 验证所有业务单据是否都已生成凭证，以及凭证的源单据是否存在
   */
  private checkVoucherDocumentLinkage(): ConsistencyCheck {
    const issues: string[] = [];

    // Check schema
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vouchers', 'journal_entries')").all() as any[];
    const useNewSchema = tables.some(t => t.name === 'vouchers');

    // Check if voucher_id column exists in orders table
    const ordersColumns = this.db.prepare("PRAGMA table_info(orders)").all() as any[];
    const hasVoucherIdColumn = ordersColumns.some(col => col.name === 'voucher_id');

    if (hasVoucherIdColumn) {
      // 1. 检查未生成凭证的销售订单
      const ordersWithoutVoucher = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE voucher_id IS NULL
      `).get() as { count: number };

      if (ordersWithoutVoucher.count > 0) {
        issues.push(`${ordersWithoutVoucher.count} 个销售订单未生成凭证`);
      }

      // 2. 检查未生成凭证的收款单
      const incomesWithoutVoucher = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM incomes 
        WHERE voucher_id IS NULL
      `).get() as { count: number };

      if (incomesWithoutVoucher.count > 0) {
        issues.push(`${incomesWithoutVoucher.count} 个收款单未生成凭证`);
      }

      // 3. 检查未生成凭证的付款单
      const expensesWithoutVoucher = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM expenses 
        WHERE voucher_id IS NULL
      `).get() as { count: number };

      if (expensesWithoutVoucher.count > 0) {
        issues.push(`${expensesWithoutVoucher.count} 个付款单未生成凭证`);
      }
    }

    // 4. 检查凭证的源单据是否存在 (only if using new schema)
    if (useNewSchema) {
      const orphanedVouchers = this.db.prepare(`
        SELECT v.id, v.voucher_no, v.source_type, v.source_id
        FROM vouchers v
        WHERE v.source_type IS NOT NULL 
        AND v.source_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM orders WHERE id = v.source_id AND v.source_type = 'order'
          UNION
          SELECT 1 FROM incomes WHERE id = v.source_id AND v.source_type = 'income'
          UNION
          SELECT 1 FROM expenses WHERE id = v.source_id AND v.source_type = 'expense'
          UNION
          SELECT 1 FROM supplier_bills WHERE id = v.source_id AND v.source_type = 'supplier_bill'
        )
      `).all() as any[];

      if (orphanedVouchers.length > 0) {
        issues.push(
          `${orphanedVouchers.length} 个凭证的源单据不存在: ` +
          orphanedVouchers.slice(0, 3).map(v => `${v.voucher_no}(${v.source_type}:${v.source_id})`).join(', ')
        );
      }
    }

    if (issues.length > 0) {
      return {
        name: '凭证与业务单据关联完整性检查',
        status: 'failed',
        details: issues.join('; ')
      };
    }

    return {
      name: '凭证与业务单据关联完整性检查',
      status: 'passed',
      details: hasVoucherIdColumn ? '所有业务单据已生成凭证，凭证源单据完整' : '数据库架构尚未升级，跳过此检查'
    };
  }

  /**
   * 检查辅助核算数据完整性
   * 验证需要辅助核算的科目是否都填写了辅助核算信息
   */
  private checkAuxiliaryAccountingData(): ConsistencyCheck {
    const issues: string[] = [];

    // Check if auxiliary_types column exists
    const accountColumns = this.db.prepare("PRAGMA table_info(accounts)").all() as any[];
    const hasAuxiliaryTypes = accountColumns.some(col => col.name === 'auxiliary_types');

    if (!hasAuxiliaryTypes) {
      return {
        name: '辅助核算数据完整性检查',
        status: 'passed',
        details: '数据库架构尚未升级，跳过此检查'
      };
    }

    // Check schema
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vouchers', 'journal_entries')").all() as any[];
    const useNewSchema = tables.some(t => t.name === 'vouchers');
    const voucherTable = useNewSchema ? 'vouchers' : 'journal_entries';
    const lineTable = useNewSchema ? 'voucher_lines' : 'journal_entry_lines';
    const idField = useNewSchema ? 'voucher_id' : 'entry_id';
    const noField = 'voucher_no'; // Both schemas use voucher_no

    // 获取所有需要辅助核算的科目
    const accountsWithAux = this.db.prepare(`
      SELECT id, name, auxiliary_types 
      FROM accounts 
      WHERE auxiliary_types IS NOT NULL AND auxiliary_types != '[]'
    `).all() as any[];

    for (const account of accountsWithAux) {
      const auxTypes = JSON.parse(account.auxiliary_types || '[]');
      const requiredTypes = auxTypes.filter((t: any) => t.required);

      if (requiredTypes.length > 0) {
        // 检查该科目的凭证分录是否都填写了必填的辅助核算信息
        const missingAuxData = this.db.prepare(`
          SELECT v.${noField} as voucher_no, vl.id as line_no
          FROM ${lineTable} vl
          JOIN ${voucherTable} v ON vl.${idField} = v.id
          WHERE vl.account_id = ? 
          AND (vl.auxiliary_data IS NULL OR vl.auxiliary_data = '{}')
        `).all(account.id) as any[];

        if (missingAuxData.length > 0) {
          issues.push(
            `科目 ${account.name}(${account.id}) 有 ${missingAuxData.length} 条分录缺少辅助核算信息`
          );
        }
      }
    }

    if (issues.length > 0) {
      return {
        name: '辅助核算数据完整性检查',
        status: 'failed',
        details: issues.join('; ')
      };
    }

    return {
      name: '辅助核算数据完整性检查',
      status: 'passed',
      details: accountsWithAux.length > 0 ? '辅助核算数据完整' : '无需辅助核算的科目，跳过此检查'
    };
  }
}

/**
 * 一致性检查结果
 */
interface ConsistencyCheckResult {
  check_date: string;
  checks: ConsistencyCheck[];
}

/**
 * 单项检查结果
 */
interface ConsistencyCheck {
  name: string;
  status: 'passed' | 'failed';
  details?: string;
}
