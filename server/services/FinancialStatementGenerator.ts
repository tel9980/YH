import Database from "better-sqlite3";
import { BalanceSheetV7, IncomeStatement, CashFlowStatement, FinancialRatios } from "../../src/types.js";
import { FinancialRatioCalculator } from "./FinancialRatioCalculator.js";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

/**
 * 财务报表生成器
 * 生成资产负债表、利润表、现金流量表和财务指标
 * 
 * 性能优化 (Task 32.2):
 * - 实现报表数据缓存机制
 * - 优化复杂查询逻辑
 * - 批量处理数据查询
 */
export class FinancialStatementGenerator {
  private db: Database.Database;
  private ratioCalculator: FinancialRatioCalculator;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 60000; // 1分钟缓存

  constructor(db: Database.Database) {
    this.db = db;
    this.ratioCalculator = new FinancialRatioCalculator();
    this.cache = new Map();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存数据
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * 设置缓存数据
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * 生成资产负债表
   * 性能优化: 使用缓存机制
   */
  generateBalanceSheet(period: string): BalanceSheetV7 {
    // 检查缓存
    const cacheKey = `balance_sheet_${period}`;
    const cached = this.getCachedData<BalanceSheetV7>(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = `${period}-${this.getLastDayOfMonth(period)}`;

    // 检查是否包含未审核凭证 (属性32)
    const containsUnapprovedData = this.containsUnapprovedVouchers(period);

    // 流动资产
    const cash = this.getAccountBalance(['1001', '1002'], null, endDate);
    const receivables = this.getAccountBalance(['1122'], null, endDate);
    const inventory = this.getAccountBalance(['1403', '1405'], null, endDate);
    const otherCurrentAssets = this.getAccountBalance(['1221', '1123'], null, endDate);
    const totalCurrentAssets = cash + receivables + inventory + otherCurrentAssets;

    // 非流动资产
    const fixedAssets = this.getAccountBalance(['1601'], null, endDate);
    const accumulatedDepreciation = this.getAccountBalance(['1602'], null, endDate);
    const netFixedAssets = fixedAssets - accumulatedDepreciation;
    const otherNonCurrentAssets = this.getAccountBalance(['1801'], null, endDate);
    const totalNonCurrentAssets = netFixedAssets + otherNonCurrentAssets;

    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    // 流动负债
    const payables = this.getAccountBalance(['2202'], null, endDate);
    const taxPayable = this.getAccountBalance(['2221'], null, endDate);
    const otherCurrentLiabilities = this.getAccountBalance(['2203', '2211'], null, endDate);
    const totalCurrentLiabilities = payables + taxPayable + otherCurrentLiabilities;

    // 非流动负债
    const totalNonCurrentLiabilities = 0;

    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

    // 所有者权益
    const capital = this.getAccountBalance(['4001'], null, endDate);
    const retainedEarnings = this.getAccountBalance(['410401'], null, endDate);
    const currentProfit = this.getAccountBalance(['4103'], null, endDate);
    const totalEquity = capital + retainedEarnings + currentProfit;

    const result = {
      period,
      contains_unapproved_data: containsUnapprovedData,
      assets: {
        current_assets: {
          cash,
          receivables,
          inventory,
          other: otherCurrentAssets,
          total: totalCurrentAssets
        },
        non_current_assets: {
          fixed_assets: fixedAssets,
          accumulated_depreciation: accumulatedDepreciation,
          net_fixed_assets: netFixedAssets,
          other: otherNonCurrentAssets,
          total: totalNonCurrentAssets
        },
        total_assets: totalAssets
      },
      liabilities: {
        current_liabilities: {
          payables,
          tax_payable: taxPayable,
          other: otherCurrentLiabilities,
          total: totalCurrentLiabilities
        },
        non_current_liabilities: {
          total: totalNonCurrentLiabilities
        },
        total_liabilities: totalLiabilities
      },
      equity: {
        capital,
        retained_earnings: retainedEarnings,
        current_profit: currentProfit,
        total_equity: totalEquity
      }
    };

    // 缓存结果
    this.setCachedData(cacheKey, result);

    return result;
  }

  /**
   * 生成利润表
   * 性能优化: 使用缓存机制
   */
  generateIncomeStatement(period: string): IncomeStatement {
    // 检查缓存
    const cacheKey = `income_statement_${period}`;
    const cached = this.getCachedData<IncomeStatement>(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = `${period}-01`;
    const endDate = `${period}-${this.getLastDayOfMonth(period)}`;

    // 检查是否包含未审核凭证 (属性32)
    const containsUnapprovedData = this.containsUnapprovedVouchers(period);

    // 收入
    const operatingRevenue = this.getAccountBalance(['5001', '500101'], startDate, endDate);
    const otherRevenue = this.getAccountBalance(['5301'], startDate, endDate);
    const totalRevenue = operatingRevenue + otherRevenue;

    // 成本
    const operatingCost = this.getAccountBalance(['5401'], startDate, endDate);
    const grossProfit = operatingRevenue - operatingCost;

    // 费用
    const sellingExpense = this.getAccountBalance(['6601'], startDate, endDate);
    const administrativeExpense = this.getAccountBalance(['6602'], startDate, endDate);
    const financialExpense = this.getAccountBalance(['6603'], startDate, endDate);
    const totalExpense = sellingExpense + administrativeExpense + financialExpense;

    // 利润
    const operatingProfit = grossProfit - totalExpense;
    const nonOperatingIncome = otherRevenue;
    const nonOperatingExpense = 0;
    const profitBeforeTax = operatingProfit + nonOperatingIncome - nonOperatingExpense;
    const incomeTax = this.getAccountBalance(['222103'], startDate, endDate);
    const netProfit = profitBeforeTax - incomeTax;

    const result = {
      period,
      contains_unapproved_data: containsUnapprovedData,
      revenue: {
        operating_revenue: operatingRevenue,
        other_revenue: otherRevenue,
        total_revenue: totalRevenue
      },
      cost: {
        operating_cost: operatingCost,
        gross_profit: grossProfit
      },
      expenses: {
        selling_expense: sellingExpense,
        administrative_expense: administrativeExpense,
        financial_expense: financialExpense,
        total_expense: totalExpense
      },
      profit: {
        operating_profit: operatingProfit,
        non_operating_income: nonOperatingIncome,
        non_operating_expense: nonOperatingExpense,
        profit_before_tax: profitBeforeTax,
        income_tax: incomeTax,
        net_profit: netProfit
      }
    };

    // 缓存结果
    this.setCachedData(cacheKey, result);

    return result;
  }

  /**
   * 生成现金流量表（简化版）
   * 属性17: 现金流量表计算准确性
   */
  generateCashFlowStatement(period: string): CashFlowStatement {
    const startDate = `${period}-01`;
    const endDate = `${period}-${this.getLastDayOfMonth(period)}`;

    // 检查是否包含未审核凭证 (属性32)
    const containsUnapprovedData = this.containsUnapprovedVouchers(period);

    // 经营活动现金流
    const operatingInflows = this.getCashInflows(startDate, endDate);
    const operatingOutflows = this.getCashOutflows(startDate, endDate);
    const netOperatingCashFlow = operatingInflows - operatingOutflows;

    // 投资活动现金流（简化）
    const investingInflows = 0;
    const investingOutflows = 0;
    const netInvestingCashFlow = investingInflows - investingOutflows;

    // 筹资活动现金流（简化）
    const financingInflows = 0;
    const financingOutflows = 0;
    const netFinancingCashFlow = financingInflows - financingOutflows;

    // 现金净增加额
    const netIncreaseInCash = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;

    // 期初期末现金余额
    const beginningCashBalance = this.getCashBalance(null, startDate);
    const endingCashBalance = this.getCashBalance(null, endDate);

    return {
      period,
      contains_unapproved_data: containsUnapprovedData,
      operating_activities: {
        cash_inflows: operatingInflows,
        cash_outflows: operatingOutflows,
        net_cash_flow: netOperatingCashFlow
      },
      investing_activities: {
        cash_inflows: investingInflows,
        cash_outflows: investingOutflows,
        net_cash_flow: netInvestingCashFlow
      },
      financing_activities: {
        cash_inflows: financingInflows,
        cash_outflows: financingOutflows,
        net_cash_flow: netFinancingCashFlow
      },
      net_increase_in_cash: netIncreaseInCash,
      beginning_cash_balance: beginningCashBalance,
      ending_cash_balance: endingCashBalance
    };
  }

  /**
   * 计算财务指标
   * 属性19: 财务指标计算公式正确性
   */
  calculateFinancialRatios(period: string): FinancialRatios {
    const balanceSheet = this.generateBalanceSheet(period);
    const incomeStatement = this.generateIncomeStatement(period);

    // 使用 FinancialRatioCalculator 计算财务指标
    return this.ratioCalculator.calculateRatios(balanceSheet, incomeStatement);
  }

  /**
   * 获取科目余额
   * 性能优化: 使用 IN 子句代替多个 LIKE 条件，添加索引提示
   */
  private getAccountBalance(accountIds: string[], startDate: string | null, endDate: string): number {
    // 构建账户ID列表（包括子账户）
    const accountPatterns = accountIds.map(id => `'${id}'`).join(',');
    const likeConditions = accountIds.map(id => `vl.account_id LIKE '${id}%'`).join(' OR ');
    
    let query = `
      SELECT 
        COALESCE(SUM(vl.debit), 0) as total_debit,
        COALESCE(SUM(vl.credit), 0) as total_credit
      FROM voucher_lines vl
      INDEXED BY idx_voucher_lines_account
      JOIN vouchers v ON vl.voucher_id = v.id
      WHERE (vl.account_id IN (${accountPatterns}) OR ${likeConditions})
    `;

    const params: any[] = [];
    
    if (startDate) {
      query += " AND v.date >= ?";
      params.push(startDate);
    }
    
    query += " AND v.date <= ?";
    params.push(endDate);

    const result = this.db.prepare(query).get(...params) as any;
    return result.total_debit - result.total_credit;
  }

  /**
   * 获取现金流入
   */
  private getCashInflows(startDate: string, endDate: string): number {
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM incomes
      WHERE date BETWEEN ? AND ?
    `).get(startDate, endDate) as { total: number };

    return result.total;
  }

  /**
   * 获取现金流出
   */
  private getCashOutflows(startDate: string, endDate: string): number {
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date BETWEEN ? AND ?
    `).get(startDate, endDate) as { total: number };

    return result.total;
  }

  /**
   * 获取现金余额
   */
  private getCashBalance(startDate: string | null, endDate: string): number {
    return this.getAccountBalance(['1001', '1002'], startDate, endDate);
  }

  /**
   * 获取月份最后一天
   */
  private getLastDayOfMonth(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return lastDay.toString().padStart(2, '0');
  }

  /**
   * 检查报表期间是否包含未审核凭证
   * 属性32: 未审核凭证报表标注
   * 
   * @param period 会计期间 (YYYY-MM)
   * @returns 如果包含未审核凭证返回 true
   */
  private containsUnapprovedVouchers(period: string): boolean {
    const startDate = `${period}-01`;
    const endDate = `${period}-${this.getLastDayOfMonth(period)}`;

    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM vouchers
      WHERE date BETWEEN ? AND ?
        AND status != 'approved'
    `).get(startDate, endDate) as { count: number };

    return result.count > 0;
  }

  /**
   * 导出报表到 Excel
   * 属性20: 报表导出格式正确性
   * 
   * @param reportType 报表类型: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'financial_ratios'
   * @param period 会计期间 (YYYY-MM)
   * @returns Excel 文件的 Buffer
   */
  exportToExcel(reportType: string, period: string): Buffer {
    const workbook = XLSX.utils.book_new();
    
    switch (reportType) {
      case 'balance_sheet': {
        const balanceSheet = this.generateBalanceSheet(period);
        const worksheet = this.createBalanceSheetWorksheet(balanceSheet);
        XLSX.utils.book_append_sheet(workbook, worksheet, '资产负债表');
        break;
      }
      case 'income_statement': {
        const incomeStatement = this.generateIncomeStatement(period);
        const worksheet = this.createIncomeStatementWorksheet(incomeStatement);
        XLSX.utils.book_append_sheet(workbook, worksheet, '利润表');
        break;
      }
      case 'cash_flow': {
        const cashFlow = this.generateCashFlowStatement(period);
        const worksheet = this.createCashFlowWorksheet(cashFlow);
        XLSX.utils.book_append_sheet(workbook, worksheet, '现金流量表');
        break;
      }
      case 'financial_ratios': {
        const ratios = this.calculateFinancialRatios(period);
        const worksheet = this.createFinancialRatiosWorksheet(ratios, period);
        XLSX.utils.book_append_sheet(workbook, worksheet, '财务指标');
        break;
      }
      default:
        throw new Error(`不支持的报表类型: ${reportType}`);
    }
    
    // 生成 Buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return excelBuffer;
  }

  /**
   * 导出报表到 PDF
   * 属性20: 报表导出格式正确性
   * 
   * @param reportType 报表类型: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'financial_ratios'
   * @param period 会计期间 (YYYY-MM)
   * @returns PDF 文件的 Buffer
   */
  exportToPDF(reportType: string, period: string): Buffer {
    const doc = new jsPDF();
    
    // 设置中文字体（使用默认字体，实际项目中可能需要加载中文字体）
    doc.setFont('helvetica');
    
    switch (reportType) {
      case 'balance_sheet': {
        const balanceSheet = this.generateBalanceSheet(period);
        this.addBalanceSheetToPDF(doc, balanceSheet);
        break;
      }
      case 'income_statement': {
        const incomeStatement = this.generateIncomeStatement(period);
        this.addIncomeStatementToPDF(doc, incomeStatement);
        break;
      }
      case 'cash_flow': {
        const cashFlow = this.generateCashFlowStatement(period);
        this.addCashFlowToPDF(doc, cashFlow);
        break;
      }
      case 'financial_ratios': {
        const ratios = this.calculateFinancialRatios(period);
        this.addFinancialRatiosToPDF(doc, ratios, period);
        break;
      }
      default:
        throw new Error(`不支持的报表类型: ${reportType}`);
    }
    
    // 生成 Buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
  }

  /**
   * 创建资产负债表 Excel 工作表
   */
  private createBalanceSheetWorksheet(balanceSheet: BalanceSheetV7): XLSX.WorkSheet {
    const data: any[][] = [
      ['资产负债表'],
      [`期间: ${balanceSheet.period}`],
    ];

    // 添加未审核数据警告 (属性32)
    if (balanceSheet.contains_unapproved_data) {
      data.push(['⚠️ 警告: 包含未审核数据']);
    }

    data.push(
      [],
      ['资产', '金额', '负债和所有者权益', '金额'],
      ['流动资产:', '', '流动负债:', ''],
      ['  货币资金', balanceSheet.assets.current_assets.cash, '  应付账款', balanceSheet.liabilities.current_liabilities.payables],
      ['  应收账款', balanceSheet.assets.current_assets.receivables, '  应交税费', balanceSheet.liabilities.current_liabilities.tax_payable],
      ['  存货', balanceSheet.assets.current_assets.inventory, '  其他流动负债', balanceSheet.liabilities.current_liabilities.other],
      ['  其他流动资产', balanceSheet.assets.current_assets.other, '流动负债合计', balanceSheet.liabilities.current_liabilities.total],
      ['流动资产合计', balanceSheet.assets.current_assets.total, '', ''],
      ['', '', '非流动负债:', ''],
      ['非流动资产:', '', '非流动负债合计', balanceSheet.liabilities.non_current_liabilities.total],
      ['  固定资产原值', balanceSheet.assets.non_current_assets.fixed_assets, '', ''],
      ['  减：累计折旧', balanceSheet.assets.non_current_assets.accumulated_depreciation, '负债合计', balanceSheet.liabilities.total_liabilities],
      ['  固定资产净值', balanceSheet.assets.non_current_assets.net_fixed_assets, '', ''],
      ['  其他非流动资产', balanceSheet.assets.non_current_assets.other, '所有者权益:', ''],
      ['非流动资产合计', balanceSheet.assets.non_current_assets.total, '  实收资本', balanceSheet.equity.capital],
      ['', '', '  未分配利润', balanceSheet.equity.retained_earnings],
      ['', '', '  本年利润', balanceSheet.equity.current_profit],
      ['资产总计', balanceSheet.assets.total_assets, '所有者权益合计', balanceSheet.equity.total_equity],
      ['', '', '负债和所有者权益总计', balanceSheet.liabilities.total_liabilities + balanceSheet.equity.total_equity]
    );
    
    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * 创建利润表 Excel 工作表
   */
  private createIncomeStatementWorksheet(incomeStatement: IncomeStatement): XLSX.WorkSheet {
    const data: any[][] = [
      ['利润表'],
      [`期间: ${incomeStatement.period}`],
    ];

    // 添加未审核数据警告 (属性32)
    if (incomeStatement.contains_unapproved_data) {
      data.push(['⚠️ 警告: 包含未审核数据']);
    }

    data.push(
      [],
      ['项目', '金额'],
      ['一、营业收入', incomeStatement.revenue.operating_revenue],
      ['  减：营业成本', incomeStatement.cost.operating_cost],
      ['二、营业毛利', incomeStatement.cost.gross_profit],
      ['  减：销售费用', incomeStatement.expenses.selling_expense],
      ['      管理费用', incomeStatement.expenses.administrative_expense],
      ['      财务费用', incomeStatement.expenses.financial_expense],
      ['三、营业利润', incomeStatement.profit.operating_profit],
      ['  加：营业外收入', incomeStatement.profit.non_operating_income],
      ['  减：营业外支出', incomeStatement.profit.non_operating_expense],
      ['四、利润总额', incomeStatement.profit.profit_before_tax],
      ['  减：所得税费用', incomeStatement.profit.income_tax],
      ['五、净利润', incomeStatement.profit.net_profit]
    );
    
    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * 创建现金流量表 Excel 工作表
   */
  private createCashFlowWorksheet(cashFlow: CashFlowStatement): XLSX.WorkSheet {
    const data: any[][] = [
      ['现金流量表'],
      [`期间: ${cashFlow.period}`],
    ];

    // 添加未审核数据警告 (属性32)
    if (cashFlow.contains_unapproved_data) {
      data.push(['⚠️ 警告: 包含未审核数据']);
    }

    data.push(
      [],
      ['项目', '金额'],
      ['一、经营活动产生的现金流量', ''],
      ['  现金流入', cashFlow.operating_activities.cash_inflows],
      ['  现金流出', cashFlow.operating_activities.cash_outflows],
      ['  经营活动现金流量净额', cashFlow.operating_activities.net_cash_flow],
      [],
      ['二、投资活动产生的现金流量', ''],
      ['  现金流入', cashFlow.investing_activities.cash_inflows],
      ['  现金流出', cashFlow.investing_activities.cash_outflows],
      ['  投资活动现金流量净额', cashFlow.investing_activities.net_cash_flow],
      [],
      ['三、筹资活动产生的现金流量', ''],
      ['  现金流入', cashFlow.financing_activities.cash_inflows],
      ['  现金流出', cashFlow.financing_activities.cash_outflows],
      ['  筹资活动现金流量净额', cashFlow.financing_activities.net_cash_flow],
      [],
      ['四、现金及现金等价物净增加额', cashFlow.net_increase_in_cash],
      ['  加：期初现金余额', cashFlow.beginning_cash_balance],
      ['五、期末现金余额', cashFlow.ending_cash_balance]
    );
    
    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * 创建财务指标 Excel 工作表
   */
  private createFinancialRatiosWorksheet(ratios: FinancialRatios, period: string): XLSX.WorkSheet {
    const data = [
      ['财务指标分析'],
      [`期间: ${period}`],
      [],
      ['指标类别', '指标名称', '数值', '单位'],
      ['偿债能力指标', '流动比率', ratios.solvency.current_ratio.toFixed(2), ''],
      ['', '速动比率', ratios.solvency.quick_ratio.toFixed(2), ''],
      ['', '资产负债率', (ratios.solvency.debt_to_asset_ratio * 100).toFixed(2), '%'],
      [],
      ['营运能力指标', '应收账款周转率', ratios.operational.receivables_turnover.toFixed(2), '次'],
      ['', '存货周转率', ratios.operational.inventory_turnover.toFixed(2), '次'],
      ['', '总资产周转率', ratios.operational.total_asset_turnover.toFixed(2), '次'],
      [],
      ['盈利能力指标', '销售毛利率', (ratios.profitability.gross_margin * 100).toFixed(2), '%'],
      ['', '销售净利率', (ratios.profitability.net_margin * 100).toFixed(2), '%'],
      ['', '净资产收益率', (ratios.profitability.roe * 100).toFixed(2), '%'],
      ['', '总资产收益率', (ratios.profitability.roa * 100).toFixed(2), '%']
    ];
    
    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * 添加资产负债表到 PDF
   */
  private addBalanceSheetToPDF(doc: jsPDF, balanceSheet: BalanceSheetV7): void {
    // 标题
    doc.setFontSize(16);
    doc.text('Balance Sheet', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${balanceSheet.period}`, 105, 22, { align: 'center' });
    
    let startY = 30;

    // 添加未审核数据警告 (属性32)
    if (balanceSheet.contains_unapproved_data) {
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0); // 红色
      doc.text('WARNING: Contains Unapproved Data', 105, startY, { align: 'center' });
      doc.setTextColor(0, 0, 0); // 恢复黑色
      startY += 7;
    }
    
    // 资产表格
    autoTable(doc, {
      startY: startY,
      head: [['Assets', 'Amount']],
      body: [
        ['Current Assets:', ''],
        ['  Cash', balanceSheet.assets.current_assets.cash.toFixed(2)],
        ['  Receivables', balanceSheet.assets.current_assets.receivables.toFixed(2)],
        ['  Inventory', balanceSheet.assets.current_assets.inventory.toFixed(2)],
        ['  Other Current Assets', balanceSheet.assets.current_assets.other.toFixed(2)],
        ['Total Current Assets', balanceSheet.assets.current_assets.total.toFixed(2)],
        ['', ''],
        ['Non-Current Assets:', ''],
        ['  Fixed Assets', balanceSheet.assets.non_current_assets.fixed_assets.toFixed(2)],
        ['  Less: Accumulated Depreciation', balanceSheet.assets.non_current_assets.accumulated_depreciation.toFixed(2)],
        ['  Net Fixed Assets', balanceSheet.assets.non_current_assets.net_fixed_assets.toFixed(2)],
        ['  Other Non-Current Assets', balanceSheet.assets.non_current_assets.other.toFixed(2)],
        ['Total Non-Current Assets', balanceSheet.assets.non_current_assets.total.toFixed(2)],
        ['', ''],
        ['Total Assets', balanceSheet.assets.total_assets.toFixed(2)]
      ],
      theme: 'grid',
      styles: { fontSize: 9 }
    });
    
    // 负债和权益表格
    const finalY = (doc as any).lastAutoTable.finalY || startY;
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Liabilities and Equity', 'Amount']],
      body: [
        ['Current Liabilities:', ''],
        ['  Payables', balanceSheet.liabilities.current_liabilities.payables.toFixed(2)],
        ['  Tax Payable', balanceSheet.liabilities.current_liabilities.tax_payable.toFixed(2)],
        ['  Other Current Liabilities', balanceSheet.liabilities.current_liabilities.other.toFixed(2)],
        ['Total Current Liabilities', balanceSheet.liabilities.current_liabilities.total.toFixed(2)],
        ['', ''],
        ['Non-Current Liabilities:', ''],
        ['Total Non-Current Liabilities', balanceSheet.liabilities.non_current_liabilities.total.toFixed(2)],
        ['Total Liabilities', balanceSheet.liabilities.total_liabilities.toFixed(2)],
        ['', ''],
        ['Equity:', ''],
        ['  Capital', balanceSheet.equity.capital.toFixed(2)],
        ['  Retained Earnings', balanceSheet.equity.retained_earnings.toFixed(2)],
        ['  Current Profit', balanceSheet.equity.current_profit.toFixed(2)],
        ['Total Equity', balanceSheet.equity.total_equity.toFixed(2)],
        ['', ''],
        ['Total Liabilities and Equity', (balanceSheet.liabilities.total_liabilities + balanceSheet.equity.total_equity).toFixed(2)]
      ],
      theme: 'grid',
      styles: { fontSize: 9 }
    });
  }

  /**
   * 添加利润表到 PDF
   */
  private addIncomeStatementToPDF(doc: jsPDF, incomeStatement: IncomeStatement): void {
    doc.setFontSize(16);
    doc.text('Income Statement', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${incomeStatement.period}`, 105, 22, { align: 'center' });
    
    let startY = 30;

    // 添加未审核数据警告 (属性32)
    if (incomeStatement.contains_unapproved_data) {
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0); // 红色
      doc.text('WARNING: Contains Unapproved Data', 105, startY, { align: 'center' });
      doc.setTextColor(0, 0, 0); // 恢复黑色
      startY += 7;
    }
    
    autoTable(doc, {
      startY: startY,
      head: [['Item', 'Amount']],
      body: [
        ['Operating Revenue', incomeStatement.revenue.operating_revenue.toFixed(2)],
        ['Less: Operating Cost', incomeStatement.cost.operating_cost.toFixed(2)],
        ['Gross Profit', incomeStatement.cost.gross_profit.toFixed(2)],
        ['Less: Selling Expense', incomeStatement.expenses.selling_expense.toFixed(2)],
        ['      Administrative Expense', incomeStatement.expenses.administrative_expense.toFixed(2)],
        ['      Financial Expense', incomeStatement.expenses.financial_expense.toFixed(2)],
        ['Operating Profit', incomeStatement.profit.operating_profit.toFixed(2)],
        ['Add: Non-Operating Income', incomeStatement.profit.non_operating_income.toFixed(2)],
        ['Less: Non-Operating Expense', incomeStatement.profit.non_operating_expense.toFixed(2)],
        ['Profit Before Tax', incomeStatement.profit.profit_before_tax.toFixed(2)],
        ['Less: Income Tax', incomeStatement.profit.income_tax.toFixed(2)],
        ['Net Profit', incomeStatement.profit.net_profit.toFixed(2)]
      ],
      theme: 'grid',
      styles: { fontSize: 9 }
    });
  }

  /**
   * 添加现金流量表到 PDF
   */
  private addCashFlowToPDF(doc: jsPDF, cashFlow: CashFlowStatement): void {
    doc.setFontSize(16);
    doc.text('Cash Flow Statement', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${cashFlow.period}`, 105, 22, { align: 'center' });
    
    let startY = 30;

    // 添加未审核数据警告 (属性32)
    if (cashFlow.contains_unapproved_data) {
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0); // 红色
      doc.text('WARNING: Contains Unapproved Data', 105, startY, { align: 'center' });
      doc.setTextColor(0, 0, 0); // 恢复黑色
      startY += 7;
    }
    
    autoTable(doc, {
      startY: startY,
      head: [['Item', 'Amount']],
      body: [
        ['Operating Activities:', ''],
        ['  Cash Inflows', cashFlow.operating_activities.cash_inflows.toFixed(2)],
        ['  Cash Outflows', cashFlow.operating_activities.cash_outflows.toFixed(2)],
        ['  Net Cash Flow', cashFlow.operating_activities.net_cash_flow.toFixed(2)],
        ['', ''],
        ['Investing Activities:', ''],
        ['  Cash Inflows', cashFlow.investing_activities.cash_inflows.toFixed(2)],
        ['  Cash Outflows', cashFlow.investing_activities.cash_outflows.toFixed(2)],
        ['  Net Cash Flow', cashFlow.investing_activities.net_cash_flow.toFixed(2)],
        ['', ''],
        ['Financing Activities:', ''],
        ['  Cash Inflows', cashFlow.financing_activities.cash_inflows.toFixed(2)],
        ['  Cash Outflows', cashFlow.financing_activities.cash_outflows.toFixed(2)],
        ['  Net Cash Flow', cashFlow.financing_activities.net_cash_flow.toFixed(2)],
        ['', ''],
        ['Net Increase in Cash', cashFlow.net_increase_in_cash.toFixed(2)],
        ['Add: Beginning Cash Balance', cashFlow.beginning_cash_balance.toFixed(2)],
        ['Ending Cash Balance', cashFlow.ending_cash_balance.toFixed(2)]
      ],
      theme: 'grid',
      styles: { fontSize: 9 }
    });
  }

  /**
   * 添加财务指标到 PDF
   */
  private addFinancialRatiosToPDF(doc: jsPDF, ratios: FinancialRatios, period: string): void {
    doc.setFontSize(16);
    doc.text('Financial Ratios', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${period}`, 105, 22, { align: 'center' });
    
    autoTable(doc, {
      startY: 30,
      head: [['Category', 'Indicator', 'Value']],
      body: [
        ['Solvency', 'Current Ratio', ratios.solvency.current_ratio.toFixed(2)],
        ['', 'Quick Ratio', ratios.solvency.quick_ratio.toFixed(2)],
        ['', 'Debt to Asset Ratio', (ratios.solvency.debt_to_asset_ratio * 100).toFixed(2) + '%'],
        ['', '', ''],
        ['Operational', 'Receivables Turnover', ratios.operational.receivables_turnover.toFixed(2)],
        ['', 'Inventory Turnover', ratios.operational.inventory_turnover.toFixed(2)],
        ['', 'Total Asset Turnover', ratios.operational.total_asset_turnover.toFixed(2)],
        ['', '', ''],
        ['Profitability', 'Gross Margin', (ratios.profitability.gross_margin * 100).toFixed(2) + '%'],
        ['', 'Net Margin', (ratios.profitability.net_margin * 100).toFixed(2) + '%'],
        ['', 'ROE', (ratios.profitability.roe * 100).toFixed(2) + '%'],
        ['', 'ROA', (ratios.profitability.roa * 100).toFixed(2) + '%']
      ],
      theme: 'grid',
      styles: { fontSize: 9 }
    });
  }
}
