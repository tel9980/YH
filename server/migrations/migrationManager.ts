import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationInfo {
  version: string;
  appliedAt: string;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrationsPath = __dirname;
    this.initMigrationTable();
  }

  /**
   * 初始化迁移记录表
   */
  private initMigrationTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
  }

  /**
   * 初始化基础数据库结构 (v6.5 兼容)
   */
  private initBaseSchema() {
    const baseSchemaPath = path.join(this.migrationsPath, "initial-schema.sql");
    if (fs.existsSync(baseSchemaPath)) {
      const sql = fs.readFileSync(baseSchemaPath, "utf-8");
      this.db.exec(sql);
      console.log("✅ 基础数据库结构已就绪");
    }
  }

  /**
   * 获取当前数据库版本
   */
  getCurrentVersion(): string | null {
    try {
      const result = this.db
        .prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
        .get() as MigrationInfo | undefined;
      return result?.version || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 检查迁移是否已应用
   */
  private isMigrationApplied(version: string): boolean {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM schema_migrations WHERE version = ?")
      .get(version) as { count: number };
    return result.count > 0;
  }

  /**
   * 记录迁移已应用
   */
  private recordMigration(version: string) {
    this.db
      .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(version, new Date().toISOString());
  }

  /**
   * 执行迁移脚本
   */
  async runMigrations(): Promise<void> {
    console.log("🔄 开始检查数据库迁移...");

    // 首先执行基础结构初始化
    this.initBaseSchema();

    const currentVersion = this.getCurrentVersion();
    console.log(`📊 当前数据库版本: ${currentVersion || "未初始化"}`);

    // 检查是否需要执行 v7.0 迁移
    const v7MigrationPath = path.join(this.migrationsPath, "upgrade-v7.0.sql");
    
    if (!fs.existsSync(v7MigrationPath)) {
      console.log("⚠️ 未找到 v7.0 迁移脚本");
      return;
    }

    if (!this.isMigrationApplied("7.0.0")) {
      console.log("🚀 开始执行 v7.0 数据库迁移...");
      console.log("⚠️ 建议在执行前备份数据库！");

      try {
        // 读取迁移脚本
        const migrationSQL = fs.readFileSync(v7MigrationPath, "utf-8");

        // 在事务中执行迁移
        const transaction = this.db.transaction(() => {
          // 执行迁移脚本
          this.db.exec(migrationSQL);
          
          // 记录迁移
          this.recordMigration("7.0.0");
        });

        transaction();

        console.log("✅ v7.0 数据库迁移成功完成！");
        console.log("📝 迁移内容：");
        console.log("   - 表重命名: journal_entries → vouchers");
        console.log("   - 表重命名: journal_entry_lines → voucher_lines");
        console.log("   - 新增字段: accounts, vouchers, fixed_assets 等");
        console.log("   - 新建表: 10+ 个新表（成本核算、税务、折旧等）");
        console.log("   - 创建索引: 优化查询性能");
        console.log("   - 数据迁移: 更新历史数据");
        console.log("   - 预置科目: 制造业会计科目");

      } catch (error) {
        console.error("❌ 数据库迁移失败:", error);
        throw error;
      }
    } else {
      console.log("✅ v7.0 迁移已应用，跳过");
    }

    // 检查并应用性能优化索引 (Task 32.1)
    await this.applyPerformanceOptimizations();
  }

  /**
   * 应用性能优化索引
   * Task 32.1: 优化数据库查询
   */
  private async applyPerformanceOptimizations(): Promise<void> {
    const perfOptPath = path.join(this.migrationsPath, "performance-optimization-indexes.sql");
    
    if (!fs.existsSync(perfOptPath)) {
      console.log("⚠️ 未找到性能优化索引脚本");
      return;
    }

    if (this.isMigrationApplied("7.0.1-performance")) {
      console.log("✅ 性能优化索引已应用，跳过");
      return;
    }

    console.log("🚀 开始应用性能优化索引...");

    try {
      const perfOptSQL = fs.readFileSync(perfOptPath, "utf-8");

      const transaction = this.db.transaction(() => {
        this.db.exec(perfOptSQL);
        this.recordMigration("7.0.1-performance");
      });

      transaction();

      console.log("✅ 性能优化索引应用成功！");
      console.log("📝 优化内容：");
      console.log("   - 凭证查询优化: 复合索引 (date, status)");
      console.log("   - 报表生成优化: 科目类型索引");
      console.log("   - 月末结账优化: 生产订单、成本差异索引");
      console.log("   - 业务单据优化: 日期和凭证ID复合索引");
      console.log("   - 库存查询优化: 事务日期和类型索引");
      console.log("   - 性能目标: 凭证查询<500ms, 报表生成<2s, 结账<5s");

    } catch (error) {
      console.error("❌ 性能优化索引应用失败:", error);
      throw error;
    }
  }

  /**
   * 加载预置制造业科目
   */
  async loadManufacturingAccounts(): Promise<void> {
    try {
      const accountsPath = path.join(__dirname, "../data/manufacturing-accounts.json");
      
      if (!fs.existsSync(accountsPath)) {
        console.log("⚠️ 未找到制造业科目数据文件");
        return;
      }

      const accountsData = JSON.parse(fs.readFileSync(accountsPath, "utf-8"));
      
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO accounts (id, name, type, category, parent_id, level, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      let count = 0;
      for (const account of accountsData) {
        const result = insertStmt.run(
          account.id,
          account.name,
          account.type,
          account.category,
          account.parent_id,
          account.level,
          account.status
        );
        if (result.changes > 0) count++;
      }

      if (count > 0) {
        console.log(`✅ 成功导入 ${count} 个制造业会计科目`);
      } else {
        console.log("ℹ️ 制造业科目已存在，跳过导入");
      }
    } catch (error) {
      console.error("❌ 导入制造业科目失败:", error);
    }
  }

  /**
   * 获取迁移历史
   */
  getMigrationHistory(): MigrationInfo[] {
    return this.db
      .prepare("SELECT * FROM schema_migrations ORDER BY version DESC")
      .all() as MigrationInfo[];
  }
}
