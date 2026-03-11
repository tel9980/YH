import { FinancialRatios, BalanceSheetV7, IncomeStatement } from '../../src/types.js';

/**
 * 财务指标计算器
 * 
 * 负责计算各类财务指标：
 * - 偿债能力指标（流动比率、速动比率、资产负债率）
 * - 营运能力指标（应收账款周转率、存货周转率、总资产周转率）
 * - 盈利能力指标（销售毛利率、销售净利率、净资产收益率、总资产收益率）
 * 
 * 使用正确的计算公式（属性19）
 */
export class FinancialRatioCalculator {
  constructor() {
    // 财务指标计算器不需要数据库连接，只需要资产负债表和利润表数据
  }

  /**
   * 计算财务指标
   * 
   * @param balanceSheet 资产负债表
   * @param incomeStatement 利润表
   * @returns 财务指标
   */
  calculateRatios(balanceSheet: BalanceSheetV7, incomeStatement: IncomeStatement): FinancialRatios {
    return {
      period: balanceSheet.period,
      solvency: this.calculateSolvencyRatios(balanceSheet),
      operational: this.calculateOperationalRatios(balanceSheet, incomeStatement),
      profitability: this.calculateProfitabilityRatios(balanceSheet, incomeStatement)
    };
  }

  /**
   * 计算偿债能力指标
   * 
   * 流动比率 = 流动资产 / 流动负债
   * 速动比率 = (流动资产 - 存货) / 流动负债
   * 资产负债率 = 负债总额 / 资产总额
   */
  private calculateSolvencyRatios(balanceSheet: BalanceSheetV7) {
    const currentAssets = balanceSheet.assets.current_assets.total;
    const currentLiabilities = balanceSheet.liabilities.current_liabilities.total;
    const inventory = balanceSheet.assets.current_assets.inventory;
    const totalLiabilities = balanceSheet.liabilities.total_liabilities;
    const totalAssets = balanceSheet.assets.total_assets;

    // 流动比率 = 流动资产 / 流动负债
    const currentRatio = currentLiabilities > 0
      ? currentAssets / currentLiabilities
      : 0;

    // 速动比率 = (流动资产 - 存货) / 流动负债
    const quickAssets = currentAssets - inventory;
    const quickRatio = currentLiabilities > 0
      ? quickAssets / currentLiabilities
      : 0;

    // 资产负债率 = 负债总额 / 资产总额
    const debtToAssetRatio = totalAssets > 0
      ? totalLiabilities / totalAssets
      : 0;

    return {
      current_ratio: currentRatio,
      quick_ratio: quickRatio,
      debt_to_asset_ratio: debtToAssetRatio
    };
  }

  /**
   * 计算营运能力指标
   * 
   * 应收账款周转率 = 营业收入 / 平均应收账款
   * 存货周转率 = 营业成本 / 平均存货
   * 总资产周转率 = 营业收入 / 平均资产总额
   * 
   * 注：简化处理，使用期末余额代替平均余额
   */
  private calculateOperationalRatios(balanceSheet: BalanceSheetV7, incomeStatement: IncomeStatement) {
    const operatingRevenue = incomeStatement.revenue.operating_revenue;
    const operatingCost = incomeStatement.cost.operating_cost;
    const receivables = balanceSheet.assets.current_assets.receivables;
    const inventory = balanceSheet.assets.current_assets.inventory;
    const totalAssets = balanceSheet.assets.total_assets;

    // 应收账款周转率 = 营业收入 / 应收账款
    const receivablesTurnover = receivables > 0
      ? operatingRevenue / receivables
      : 0;

    // 存货周转率 = 营业成本 / 存货
    const inventoryTurnover = inventory > 0
      ? operatingCost / inventory
      : 0;

    // 总资产周转率 = 营业收入 / 资产总额
    const totalAssetTurnover = totalAssets > 0
      ? operatingRevenue / totalAssets
      : 0;

    return {
      receivables_turnover: receivablesTurnover,
      inventory_turnover: inventoryTurnover,
      total_asset_turnover: totalAssetTurnover
    };
  }

  /**
   * 计算盈利能力指标
   * 
   * 销售毛利率 = (毛利润 / 营业收入) × 100
   * 销售净利率 = (净利润 / 营业收入总额) × 100
   * 净资产收益率 (ROE) = (净利润 / 净资产) × 100
   * 总资产收益率 (ROA) = (净利润 / 资产总额) × 100
   */
  private calculateProfitabilityRatios(balanceSheet: BalanceSheetV7, incomeStatement: IncomeStatement) {
    const operatingRevenue = incomeStatement.revenue.operating_revenue;
    const totalRevenue = incomeStatement.revenue.total_revenue;
    const grossProfit = incomeStatement.cost.gross_profit;
    const netProfit = incomeStatement.profit.net_profit;
    const totalEquity = balanceSheet.equity.total_equity;
    const totalAssets = balanceSheet.assets.total_assets;

    // 销售毛利率 = (毛利润 / 营业收入) × 100
    const grossMargin = operatingRevenue > 0
      ? (grossProfit / operatingRevenue) * 100
      : 0;

    // 销售净利率 = (净利润 / 营业收入总额) × 100
    const netMargin = totalRevenue > 0
      ? (netProfit / totalRevenue) * 100
      : 0;

    // 净资产收益率 (ROE) = (净利润 / 净资产) × 100
    const roe = totalEquity > 0
      ? (netProfit / totalEquity) * 100
      : 0;

    // 总资产收益率 (ROA) = (净利润 / 资产总额) × 100
    const roa = totalAssets > 0
      ? (netProfit / totalAssets) * 100
      : 0;

    return {
      gross_margin: grossMargin,
      net_margin: netMargin,
      roe: roe,
      roa: roa
    };
  }
}
