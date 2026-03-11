import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * 备份记录
 */
export interface BackupRecord {
  id?: number;
  backup_date: string;
  backup_path: string;
  file_size: number;
  backup_type: 'manual' | 'auto' | 'pre_operation';
  notes?: string;
  created_at?: string;
}

/**
 * 备份服务类
 */
export class BackupService {
  private db: Database.Database;
  private dbPath: string;
  private backupDir: string;

  constructor(db: Database.Database, dbPath: string, backupDir?: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.backupDir = backupDir || path.join(path.dirname(dbPath), 'backups');
    this.initializeBackupDir();
    this.initializeTable();
  }

  /**
   * 初始化备份目录
   */
  private initializeBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`✅ 备份目录已创建: ${this.backupDir}`);
    }
  }

  /**
   * 初始化备份记录表
   */
  private initializeTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backup_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_date TEXT NOT NULL,
        backup_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        backup_type TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_backup_records_date ON backup_records(backup_date);
      CREATE INDEX IF NOT EXISTS idx_backup_records_type ON backup_records(backup_type);
    `);
  }

  /**
   * 执行数据库备份
   */
  backup(type: 'manual' | 'auto' | 'pre_operation' = 'manual', notes?: string): BackupRecord {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupFileName = `xiaokuaiji_backup_${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      // 使用 SQLite 的 VACUUM INTO 命令创建备份
      // 这会创建一个压缩的数据库副本
      this.db.prepare(`VACUUM INTO ?`).run(backupPath);

      // 获取备份文件大小
      const stats = fs.statSync(backupPath);
      const fileSize = stats.size;

      // 记录备份信息
      const backupRecord: BackupRecord = {
        backup_date: new Date().toISOString(),
        backup_path: backupPath,
        file_size: fileSize,
        backup_type: type,
        notes: notes || this.getBackupTypeDescription(type)
      };

      const stmt = this.db.prepare(`
        INSERT INTO backup_records (backup_date, backup_path, file_size, backup_type, notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        backupRecord.backup_date,
        backupRecord.backup_path,
        backupRecord.file_size,
        backupRecord.backup_type,
        backupRecord.notes
      );

      backupRecord.id = result.lastInsertRowid as number;

      console.log(`✅ 数据库备份成功: ${backupPath} (${this.formatFileSize(fileSize)})`);

      // 清理旧备份
      this.cleanOldBackups();

      return backupRecord;
    } catch (error: any) {
      console.error('❌ 数据库备份失败:', error);
      throw new Error(`备份失败: ${error.message}`);
    }
  }

  /**
   * 获取备份类型描述
   */
  private getBackupTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      manual: '手动备份',
      auto: '自动备份',
      pre_operation: '操作前自动备份'
    };
    return descriptions[type] || '备份';
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * 恢复数据库
   */
  restore(backupPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`备份文件不存在: ${backupPath}`);
    }

    try {
      // 关闭当前数据库连接
      this.db.close();

      // 备份当前数据库（以防恢复失败）
      const currentBackupPath = `${this.dbPath}.before_restore`;
      fs.copyFileSync(this.dbPath, currentBackupPath);

      // 恢复备份
      fs.copyFileSync(backupPath, this.dbPath);

      console.log(`✅ 数据库恢复成功: ${backupPath}`);

      // 删除临时备份
      fs.unlinkSync(currentBackupPath);
    } catch (error: any) {
      console.error('❌ 数据库恢复失败:', error);
      throw new Error(`恢复失败: ${error.message}`);
    }
  }

  /**
   * 获取所有备份记录
   */
  getBackupRecords(limit: number = 50): BackupRecord[] {
    return this.db.prepare(`
      SELECT * FROM backup_records 
      ORDER BY backup_date DESC 
      LIMIT ?
    `).all(limit) as BackupRecord[];
  }

  /**
   * 获取最新备份
   */
  getLatestBackup(): BackupRecord | null {
    const record = this.db.prepare(`
      SELECT * FROM backup_records 
      ORDER BY backup_date DESC 
      LIMIT 1
    `).get() as BackupRecord | undefined;

    return record || null;
  }

  /**
   * 检查是否需要自动备份
   */
  shouldAutoBackup(): boolean {
    const latestBackup = this.getLatestBackup();
    
    if (!latestBackup) {
      return true; // 没有备份记录，需要备份
    }

    // 检查最后一次备份是否超过24小时
    const lastBackupDate = new Date(latestBackup.backup_date);
    const now = new Date();
    const hoursSinceLastBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastBackup >= 24;
  }

  /**
   * 执行自动备份（如果需要）
   */
  autoBackupIfNeeded(): BackupRecord | null {
    if (this.shouldAutoBackup()) {
      console.log('🔄 执行自动备份...');
      return this.backup('auto', '每日自动备份');
    }
    return null;
  }

  /**
   * 关键操作前备份
   */
  backupBeforeOperation(operationName: string): BackupRecord {
    console.log(`🔄 执行操作前备份: ${operationName}`);
    return this.backup('pre_operation', `操作前备份: ${operationName}`);
  }

  /**
   * 清理旧备份（保留最近30个备份）
   */
  private cleanOldBackups(keepCount: number = 30): void {
    try {
      const allBackups = this.db.prepare(`
        SELECT * FROM backup_records 
        ORDER BY backup_date DESC
      `).all() as BackupRecord[];

      if (allBackups.length <= keepCount) {
        return; // 备份数量未超过限制
      }

      // 删除超过保留数量的备份
      const backupsToDelete = allBackups.slice(keepCount);
      
      for (const backup of backupsToDelete) {
        try {
          // 删除备份文件
          if (fs.existsSync(backup.backup_path)) {
            fs.unlinkSync(backup.backup_path);
          }

          // 删除备份记录
          this.db.prepare('DELETE FROM backup_records WHERE id = ?').run(backup.id);
          
          console.log(`🗑️ 已删除旧备份: ${backup.backup_path}`);
        } catch (error) {
          console.error(`⚠️ 删除备份失败: ${backup.backup_path}`, error);
        }
      }

      console.log(`✅ 清理完成，保留最近 ${keepCount} 个备份`);
    } catch (error) {
      console.error('⚠️ 清理旧备份失败:', error);
    }
  }

  /**
   * 删除指定备份
   */
  deleteBackup(backupId: number): void {
    const backup = this.db.prepare('SELECT * FROM backup_records WHERE id = ?').get(backupId) as BackupRecord | undefined;

    if (!backup) {
      throw new Error('备份记录不存在');
    }

    try {
      // 删除备份文件
      if (fs.existsSync(backup.backup_path)) {
        fs.unlinkSync(backup.backup_path);
      }

      // 删除备份记录
      this.db.prepare('DELETE FROM backup_records WHERE id = ?').run(backupId);

      console.log(`✅ 备份已删除: ${backup.backup_path}`);
    } catch (error: any) {
      throw new Error(`删除备份失败: ${error.message}`);
    }
  }

  /**
   * 获取备份目录路径
   */
  getBackupDir(): string {
    return this.backupDir;
  }

  /**
   * 获取备份统计信息
   */
  getBackupStatistics(): {
    total_backups: number;
    total_size: number;
    latest_backup_date: string | null;
    oldest_backup_date: string | null;
  } {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_backups,
        SUM(file_size) as total_size,
        MAX(backup_date) as latest_backup_date,
        MIN(backup_date) as oldest_backup_date
      FROM backup_records
    `).get() as any;

    return {
      total_backups: stats.total_backups || 0,
      total_size: stats.total_size || 0,
      latest_backup_date: stats.latest_backup_date || null,
      oldest_backup_date: stats.oldest_backup_date || null
    };
  }
}
