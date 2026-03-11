import Database from "better-sqlite3";
import { Account, AuxiliaryType, ValidationResult } from "../../src/types.js";

/**
 * 会计科目管理服务
 * 负责科目的增删改查、验证和状态管理
 */
export class AccountService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 获取所有科目
   */
  getAllAccounts(): Account[] {
    const accounts = this.db
      .prepare("SELECT * FROM accounts ORDER BY id")
      .all() as any[];
    
    return accounts.map(a => ({
      ...a,
      auxiliary_types: a.auxiliary_types ? JSON.parse(a.auxiliary_types) : undefined
    }));
  }

  /**
   * 根据ID获取科目
   */
  getAccountById(id: string): Account | null {
    const account = this.db
      .prepare("SELECT * FROM accounts WHERE id = ?")
      .get(id) as any;
    
    if (!account) return null;
    
    return {
      ...account,
      auxiliary_types: account.auxiliary_types ? JSON.parse(account.auxiliary_types) : undefined
    };
  }

  /**
   * 创建科目
   */
  createAccount(account: Omit<Account, 'created_at' | 'updated_at'>): ValidationResult & { id?: string } {
    // 验证科目编码
    const validation = this.validateAccountCode(account.id, account.level);
    if (!validation.valid) {
      return validation;
    }

    // 检查编码唯一性
    const existing = this.getAccountById(account.id);
    if (existing) {
      return {
        valid: false,
        errors: [{
          field: 'id',
          message: '科目编码已存在',
          code: 'DUPLICATE_ACCOUNT_CODE'
        }]
      };
    }

    try {
      this.db.prepare(`
        INSERT INTO accounts (id, name, type, category, parent_id, level, status, auxiliary_types, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        account.id,
        account.name,
        account.type,
        account.category,
        account.parent_id,
        account.level,
        account.status || 'active',
        account.auxiliary_types ? JSON.stringify(account.auxiliary_types) : null
      );

      return { valid: true, id: account.id };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'CREATE_FAILED'
        }]
      };
    }
  }

  /**
   * 更新科目
   */
  updateAccount(id: string, updates: Partial<Account>): ValidationResult {
    const account = this.getAccountById(id);
    if (!account) {
      return {
        valid: false,
        errors: [{
          field: 'id',
          message: '科目不存在',
          code: 'ACCOUNT_NOT_FOUND'
        }]
      };
    }

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.auxiliary_types !== undefined) {
        fields.push('auxiliary_types = ?');
        values.push(JSON.stringify(updates.auxiliary_types));
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      this.db.prepare(`
        UPDATE accounts SET ${fields.join(', ')} WHERE id = ?
      `).run(...values);

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'UPDATE_FAILED'
        }]
      };
    }
  }

  /**
   * 删除科目（需验证无发生额）
   */
  deleteAccount(id: string): ValidationResult {
    // 检查科目是否有发生额
    if (!this.canDeleteAccount(id)) {
      return {
        valid: false,
        errors: [{
          field: 'id',
          message: '该科目已有发生额，无法删除',
          code: 'ACCOUNT_HAS_BALANCE'
        }]
      };
    }

    try {
      this.db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'DELETE_FAILED'
        }]
      };
    }
  }

  /**
   * 切换科目状态
   */
  toggleAccountStatus(id: string): ValidationResult {
    const account = this.getAccountById(id);
    if (!account) {
      return {
        valid: false,
        errors: [{
          field: 'id',
          message: '科目不存在',
          code: 'ACCOUNT_NOT_FOUND'
        }]
      };
    }

    const newStatus = account.status === 'active' ? 'inactive' : 'active';
    
    try {
      this.db.prepare(`
        UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newStatus, id);

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'STATUS_UPDATE_FAILED'
        }]
      };
    }
  }

  /**
   * 验证科目编码格式
   * 属性1: 科目编码唯一性
   * 属性2: 科目编码格式验证
   */
  validateAccountCode(code: string, level: number): ValidationResult {
    const errors: any[] = [];

    // 验证级次与格式的一致性
    if (level === 1) {
      // 一级科目：4位数字
      if (!/^\d{4}$/.test(code)) {
        errors.push({
          field: 'id',
          message: '一级科目编码必须是4位数字',
          code: 'INVALID_ACCOUNT_CODE_FORMAT'
        });
      }
    } else if (level === 2) {
      // 二级科目：XXXX-XX
      if (!/^\d{4}-\d{2}$/.test(code)) {
        errors.push({
          field: 'id',
          message: '二级科目编码格式必须为 XXXX-XX',
          code: 'INVALID_ACCOUNT_CODE_FORMAT'
        });
      }
    } else if (level === 3) {
      // 三级科目：XXXX-XX-XXX
      if (!/^\d{4}-\d{2}-\d{3}$/.test(code)) {
        errors.push({
          field: 'id',
          message: '三级科目编码格式必须为 XXXX-XX-XXX',
          code: 'INVALID_ACCOUNT_CODE_FORMAT'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 检查科目是否可以删除
   * 属性3: 有发生额科目不可删除
   */
  canDeleteAccount(id: string): boolean {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM voucher_lines 
      WHERE account_id = ? OR account_id LIKE ?
    `).get(id, `${id}%`) as { count: number };

    return result.count === 0;
  }

  /**
   * 设置辅助核算类型
   */
  setAuxiliaryTypes(id: string, types: AuxiliaryType[]): ValidationResult {
    try {
      this.db.prepare(`
        UPDATE accounts 
        SET auxiliary_types = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(JSON.stringify(types), id);

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'UPDATE_FAILED'
        }]
      };
    }
  }

  /**
   * 获取科目树（按层级组织）
   */
  getAccountTree(): any[] {
    const accounts = this.getAllAccounts();
    const tree: any[] = [];
    const map = new Map<string, any>();

    // 构建映射
    accounts.forEach(account => {
      map.set(account.id, { ...account, children: [] });
    });

    // 构建树结构
    accounts.forEach(account => {
      const node = map.get(account.id);
      if (account.parent_id && map.has(account.parent_id)) {
        map.get(account.parent_id).children.push(node);
      } else {
        tree.push(node);
      }
    });

    return tree;
  }
}
