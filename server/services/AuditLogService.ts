import Database from 'better-sqlite3';

/**
 * 审计日志条目
 */
export interface AuditLog {
  id?: number;
  timestamp: string;
  action: string;
  user: string;
  entity_type: string;
  entity_id?: number | string;
  details: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * 审计日志操作类型
 */
export enum AuditAction {
  // 凭证操作
  VOUCHER_CREATE = 'voucher_create',
  VOUCHER_UPDATE = 'voucher_update',
  VOUCHER_DELETE = 'voucher_delete',
  VOUCHER_APPROVE = 'voucher_approve',
  VOUCHER_REVERSE = 'voucher_reverse', // 凭证冲销 (红字凭证)
  
  // 科目操作
  ACCOUNT_CREATE = 'account_create',
  ACCOUNT_UPDATE = 'account_update',
  ACCOUNT_DELETE = 'account_delete',
  ACCOUNT_STATUS_CHANGE = 'account_status_change',
  
  // 结账操作
  PERIOD_CLOSE = 'period_close',
  PERIOD_REOPEN = 'period_reopen',
  
  // 成本操作
  COST_ALLOCATION = 'cost_allocation',
  COST_VARIANCE_PROCESS = 'cost_variance_process',
  
  // 固定资产操作
  ASSET_CREATE = 'asset_create',
  ASSET_UPDATE = 'asset_update',
  ASSET_DEPRECIATE = 'asset_depreciate',
  ASSET_DISPOSE = 'asset_dispose',
  
  // 库存操作
  INVENTORY_ADJUST = 'inventory_adjust',
  INVENTORY_VALUATION_CHANGE = 'inventory_valuation_change',
  
  // 系统操作
  SYSTEM_BACKUP = 'system_backup',
  SYSTEM_RESTORE = 'system_restore',
  DATA_IMPORT = 'data_import',
  DATA_EXPORT = 'data_export',
  
  // 用户操作
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  SETTINGS_CHANGE = 'settings_change'
}

/**
 * 审计日志服务类
 */
export class AuditLogService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeTable();
  }

  /**
   * 初始化审计日志表
   */
  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        user TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    `);
  }

  /**
   * 记录审计日志
   */
  log(
    action: AuditAction | string,
    user: string,
    entityType: string,
    details: any,
    entityId?: number | string,
    ipAddress?: string,
    userAgent?: string
  ): number {
    const timestamp = new Date().toISOString();
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (timestamp, action, user, entity_type, entity_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      timestamp,
      action,
      user,
      entityType,
      entityId?.toString() || null,
      detailsJson,
      ipAddress || null,
      userAgent || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * 记录凭证创建
   */
  logVoucherCreate(user: string, voucherId: number, voucherData: any): number {
    return this.log(
      AuditAction.VOUCHER_CREATE,
      user,
      'voucher',
      {
        voucher_id: voucherId,
        date: voucherData.date,
        voucher_no: voucherData.voucher_no,
        amount: voucherData.lines?.reduce((sum: number, line: any) => sum + line.debit, 0) || 0
      },
      voucherId
    );
  }

  /**
   * 记录凭证删除
   */
  logVoucherDelete(user: string, voucherId: number, voucherData: any): number {
    return this.log(
      AuditAction.VOUCHER_DELETE,
      user,
      'voucher',
      {
        voucher_id: voucherId,
        voucher_no: voucherData.voucher_no,
        date: voucherData.date
      },
      voucherId
    );
  }

  /**
   * 记录凭证审核
   */
  logVoucherApprove(user: string, voucherId: number, voucherNo: string): number {
    return this.log(
      AuditAction.VOUCHER_APPROVE,
      user,
      'voucher',
      {
        voucher_id: voucherId,
        voucher_no: voucherNo,
        approved_by: user,
        approved_at: new Date().toISOString()
      },
      voucherId
    );
  }

  /**
   * 记录凭证冲销
   */
  logVoucherReverse(user: string, originalVoucherId: number, reverseVoucherId: number, voucherNo: string): number {
    return this.log(
      AuditAction.VOUCHER_REVERSE,
      user,
      'voucher',
      {
        original_voucher_id: originalVoucherId,
        reverse_voucher_id: reverseVoucherId,
        voucher_no: voucherNo,
        reversed_by: user,
        reversed_at: new Date().toISOString()
      },
      reverseVoucherId
    );
  }

  /**
   * 记录期间结账
   */
  logPeriodClose(user: string, period: string, report: any): number {
    return this.log(
      AuditAction.PERIOD_CLOSE,
      user,
      'closing_period',
      {
        period,
        closed_by: user,
        closed_at: new Date().toISOString(),
        net_profit: report.net_profit,
        revenue: report.revenue,
        cost: report.cost
      },
      period
    );
  }

  /**
   * 记录期间反结账
   */
  logPeriodReopen(user: string, period: string, reason?: string): number {
    return this.log(
      AuditAction.PERIOD_REOPEN,
      user,
      'closing_period',
      {
        period,
        reopened_by: user,
        reopened_at: new Date().toISOString(),
        reason: reason || '未提供原因'
      },
      period
    );
  }

  /**
   * 记录科目创建
   */
  logAccountCreate(user: string, accountId: string, accountData: any): number {
    return this.log(
      AuditAction.ACCOUNT_CREATE,
      user,
      'account',
      {
        account_id: accountId,
        name: accountData.name,
        type: accountData.type,
        level: accountData.level
      },
      accountId
    );
  }

  /**
   * 记录科目删除
   */
  logAccountDelete(user: string, accountId: string, accountName: string): number {
    return this.log(
      AuditAction.ACCOUNT_DELETE,
      user,
      'account',
      {
        account_id: accountId,
        name: accountName
      },
      accountId
    );
  }

  /**
   * 记录科目状态变更
   */
  logAccountStatusChange(user: string, accountId: string, oldStatus: string, newStatus: string): number {
    return this.log(
      AuditAction.ACCOUNT_STATUS_CHANGE,
      user,
      'account',
      {
        account_id: accountId,
        old_status: oldStatus,
        new_status: newStatus
      },
      accountId
    );
  }

  /**
   * 记录成本分配
   */
  logCostAllocation(user: string, period: string, method: string, totalAmount: number): number {
    return this.log(
      AuditAction.COST_ALLOCATION,
      user,
      'cost_allocation',
      {
        period,
        method,
        total_amount: totalAmount,
        allocated_at: new Date().toISOString()
      },
      period
    );
  }

  /**
   * 记录库存计价方法变更
   */
  logInventoryValuationChange(user: string, oldMethod: string, newMethod: string): number {
    return this.log(
      AuditAction.INVENTORY_VALUATION_CHANGE,
      user,
      'inventory_config',
      {
        old_method: oldMethod,
        new_method: newMethod,
        changed_at: new Date().toISOString()
      }
    );
  }

  /**
   * 记录数据备份
   */
  logBackup(user: string, backupPath: string, size: number): number {
    return this.log(
      AuditAction.SYSTEM_BACKUP,
      user,
      'system',
      {
        backup_path: backupPath,
        size_bytes: size,
        backup_at: new Date().toISOString()
      }
    );
  }

  /**
   * 查询审计日志
   */
  query(filters: {
    startDate?: string;
    endDate?: string;
    action?: string;
    user?: string;
    entityType?: string;
    entityId?: string | number;
    limit?: number;
    offset?: number;
  }): AuditLog[] {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.user) {
      query += ' AND user = ?';
      params.push(filters.user);
    }

    if (filters.entityType) {
      query += ' AND entity_type = ?';
      params.push(filters.entityType);
    }

    if (filters.entityId) {
      query += ' AND entity_id = ?';
      params.push(filters.entityId.toString());
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return this.db.prepare(query).all(...params) as AuditLog[];
  }

  /**
   * 获取实体的操作历史
   */
  getEntityHistory(entityType: string, entityId: string | number): AuditLog[] {
    return this.query({
      entityType,
      entityId,
      limit: 100
    });
  }

  /**
   * 获取用户操作历史
   */
  getUserHistory(user: string, limit: number = 50): AuditLog[] {
    return this.query({
      user,
      limit
    });
  }

  /**
   * 统计审计日志
   */
  getStatistics(startDate?: string, endDate?: string): {
    total: number;
    byAction: Record<string, number>;
    byUser: Record<string, number>;
  } {
    let query = 'SELECT action, user, COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY action, user';

    const results = this.db.prepare(query).all(...params) as any[];

    const byAction: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    let total = 0;

    results.forEach(row => {
      byAction[row.action] = (byAction[row.action] || 0) + row.count;
      byUser[row.user] = (byUser[row.user] || 0) + row.count;
      total += row.count;
    });

    return { total, byAction, byUser };
  }

  /**
   * 清理旧日志（保留指定天数）
   */
  cleanOldLogs(daysToKeep: number = 365): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString();

    const result = this.db.prepare('DELETE FROM audit_logs WHERE timestamp < ?').run(cutoffDateStr);
    return result.changes;
  }
}
