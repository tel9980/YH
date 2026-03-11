import Database from "better-sqlite3";
import { FixedAsset, DepreciationSchedule, AssetDisposal } from "../../src/types.js";

/**
 * 固定资产管理服务
 * 处理资产折旧计算、处置、报表生成等
 */
export class FixedAssetService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 计算指定期间的折旧
   * 属性43: 固定资产折旧计算准确性
   */
  calculateDepreciation(asset: FixedAsset, period: string): number {
    if (asset.status !== '在用') return 0;

    // 检查是否已经提足折旧
    if (asset.net_book_value <= asset.salvage_value) return 0;

    // 获取已计提月数（不含本月）
    const totalMonths = asset.useful_life;
    const elapsedMonths = this.getElapsedMonths(asset.acquisition_date, period);
    
    // 如果还没到计提月份（入库当月不计提，下月开始）
    if (elapsedMonths <= 0) return 0;
    
    // 如果已经提满年限
    if (elapsedMonths > totalMonths) return 0;

    switch (asset.depreciation_method) {
      case 'straight_line':
        return this.calculateStraightLine(asset);
      case 'double_declining':
        return this.calculateDoubleDeclining(asset, elapsedMonths);
      case 'sum_of_years':
        return this.calculateSumOfYears(asset, elapsedMonths);
      default:
        return 0;
    }
  }

  /**
   * 年限平均法 (Straight-line)
   * 月折旧额 = (原值 - 残值) / 使用月数
   */
  private calculateStraightLine(asset: FixedAsset): number {
    const monthlyDepreciation = (asset.cost - asset.salvage_value) / asset.useful_life;
    // 确保最后一次计提不超过残值
    return Math.min(monthlyDepreciation, asset.net_book_value - asset.salvage_value);
  }

  /**
   * 双倍余额递减法 (Double-declining)
   * 年折旧率 = 2 / 使用年限
   * 月折旧率 = 年折旧率 / 12
   * 月折旧额 = 账面净值 * 月折旧率
   * 注意：最后两年改为直线法
   */
  private calculateDoubleDeclining(asset: FixedAsset, elapsedMonths: number): number {
    const years = asset.useful_life / 12;
    const annualRate = 2 / years;
    const monthlyRate = annualRate / 12;

    // 最后两年（24个月）逻辑简化：这里按月数判断
    if (elapsedMonths > asset.useful_life - 24) {
      // 剩余价值在最后24个月平均摊销
      // 需要找到进入最后两年前的账面净值，这里简化处理为当前的净值在剩余月份分摊
      const remainingMonths = asset.useful_life - elapsedMonths + 1;
      return (asset.net_book_value - asset.salvage_value) / remainingMonths;
    }

    const depreciation = asset.net_book_value * monthlyRate;
    return Math.min(depreciation, asset.net_book_value - asset.salvage_value);
  }

  /**
   * 年数总和法 (Sum-of-years)
   * 某年折旧率 = 尚可使用年数 / 预计使用年限的逐年数字总和
   */
  private calculateSumOfYears(asset: FixedAsset, elapsedMonths: number): number {
    const totalYears = Math.ceil(asset.useful_life / 12);
    const sumOfYears = (totalYears * (totalYears + 1)) / 2;
    
    const currentYear = Math.ceil(elapsedMonths / 12);
    const remainingYears = totalYears - currentYear + 1;
    
    const annualDepreciation = (asset.cost - asset.salvage_value) * (remainingYears / sumOfYears);
    const monthlyDepreciation = annualDepreciation / 12;
    
    return Math.min(monthlyDepreciation, asset.net_book_value - asset.salvage_value);
  }

  /**
   * 获取入库日期到指定期间经过的月数
   */
  private getElapsedMonths(acquisitionDate: string, period: string): number {
    const start = new Date(acquisitionDate);
    const [pYear, pMonth] = period.split('-').map(Number);
    const end = new Date(pYear, pMonth - 1);
    
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }

  /**
   * 计提所有资产的月度折旧
   */
  depreciateAll(period: string, userId: string): void {
    const assets = this.db.prepare("SELECT * FROM fixed_assets WHERE status = '在用'").all() as FixedAsset[];
    
    for (const asset of assets) {
      const amount = this.calculateDepreciation(asset, period);
      if (amount > 0) {
        this.recordDepreciation(asset, period, amount, userId);
      }
    }
  }

  /**
   * 记录折旧并更新资产状态
   */
  private recordDepreciation(asset: FixedAsset, period: string, amount: number, userId: string): void {
    const transaction = this.db.transaction(() => {
      // 1. 更新资产表
      this.db.prepare(`
        UPDATE fixed_assets 
        SET accumulated_depreciation = accumulated_depreciation + ?,
            net_book_value = net_book_value - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amount, amount, asset.id);

      // 2. 插入折旧计划表
      this.db.prepare(`
        INSERT INTO depreciation_schedules (asset_id, period, opening_book_value, depreciation_amount, accumulated_depreciation, closing_book_value)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        asset.id,
        period,
        asset.net_book_value,
        amount,
        asset.accumulated_depreciation + amount,
        asset.net_book_value - amount
      );
    });

    transaction();
  }

  /**
   * 固定资产处置
   * 属性45: 固定资产处置损益计算
   */
  disposeAsset(disposal: AssetDisposal, userId: string): void {
    const asset = this.db.prepare("SELECT * FROM fixed_assets WHERE id = ?").get(disposal.asset_id) as FixedAsset;
    if (!asset) throw new Error("资产不存在");

    const gainLoss = disposal.disposal_amount - asset.net_book_value - disposal.disposal_expense;

    const transaction = this.db.transaction(() => {
      // 1. 更新资产状态
      this.db.prepare("UPDATE fixed_assets SET status = '报废', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(asset.id);

      // 2. 记录处置信息
      this.db.prepare(`
        INSERT INTO asset_disposals (asset_id, disposal_date, disposal_amount, disposal_expense, gain_loss, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        asset.id,
        disposal.disposal_date,
        disposal.disposal_amount,
        disposal.disposal_expense,
        gain_loss,
        disposal.notes
      );
    });

    transaction();
  }

  /**
   * 获取资产卡片数据
   */
  getAssetCard(id: number): any {
    const asset = this.db.prepare("SELECT * FROM fixed_assets WHERE id = ?").get(id);
    const schedules = this.db.prepare("SELECT * FROM depreciation_schedules WHERE asset_id = ? ORDER BY period DESC").all(id);
    const disposal = this.db.prepare("SELECT * FROM asset_disposals WHERE asset_id = ?").get(id);
    
    return { ...asset, schedules, disposal };
  }
}
