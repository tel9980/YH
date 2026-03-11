/**
 * 税务管理服务
 * Tax Management Service
 * 
 * 负责税务配置、增值税计算、企业所得税计算、税务申报表生成和税务风险提示
 */

import Database from 'better-sqlite3';
import type { TaxConfig, VATReport, EITReport } from '../../src/types';

export interface TaxRiskAlert {
  risk_type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export class TaxManagementService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 获取税务配置
   * Get tax configuration
   */
  getTaxConfig(): TaxConfig {
    const config = this.db.prepare(`
      SELECT * FROM tax_config WHERE id = 1
    `).get() as TaxConfig | undefined;

    if (!config) {
      // 如果没有配置，返回默认值
      return {
        id: 1,
        vat_taxpayer_type: 'general',
        vat_rate: 13.0,
        eit_rate: 25.0
      };
    }

    return config;
  }

  /**
   * 更新税务配置
   * Update tax configuration
   */
  updateTaxConfig(config: Partial<TaxConfig>): TaxConfig {
    const current = this.getTaxConfig();
    
    const updated = {
      ...current,
      ...config,
      updated_at: new Date().toISOString()
    };

    this.db.prepare(`
      UPDATE tax_config 
      SET vat_taxpayer_type = ?,
          vat_rate = ?,
          eit_rate = ?,
          updated_at = ?
      WHERE id = 1
    `).run(
      updated.vat_taxpayer_type,
      updated.vat_rate,
      updated.eit_rate,
      updated.updated_at
    );

    return updated;
  }

  /**
   * 计算增值税（销项税额或进项税额）
   * Calculate VAT (output or input)
   * 
   * 属性40: 含税金额 = 不含税金额 + 税额
   * 税额 = 不含税金额 × 税率
   */
  calculateVAT(amountExcludingTax: number, taxRate: number): {
    tax_amount: number;
    amount_including_tax: number;
  } {
    const taxAmount = amountExcludingTax * (taxRate / 100);
    const amountIncludingTax = amountExcludingTax + taxAmount;

    return {
      tax_amount: Math.round(taxAmount * 100) / 100,
      amount_including_tax: Math.round(amountIncludingTax * 100) / 100
    };
  }

  /**
   * 从含税金额反算不含税金额和税额
   * Calculate amount excluding tax from amount including tax
   */
  calculateAmountExcludingTax(amountIncludingTax: number, taxRate: number): {
    amount_excluding_tax: number;
    tax_amount: number;
  } {
    const amountExcludingTax = amountIncludingTax / (1 + taxRate / 100);
    const taxAmount = amountIncludingTax - amountExcludingTax;

    return {
      amount_excluding_tax: Math.round(amountExcludingTax * 100) / 100,
      tax_amount: Math.round(taxAmount * 100) / 100
    };
  }

  /**
   * 生成增值税申报表
   * Generate VAT report
   * 
   * 属性41: 应纳税额 = 销项税额 - 进项税额
   */
  generateVATReport(period: string): VATReport {
    const config = this.getTaxConfig();
    const taxRate = config.vat_rate;

    // 计算销项税额（从销售订单）
    const salesData = this.db.prepare(`
      SELECT 
        SUM(total) as total_sales,
        SUM(total / (1 + tax_rate / 100)) as sales_excluding_tax,
        SUM(total - total / (1 + tax_rate / 100)) as output_vat
      FROM orders
      WHERE strftime('%Y-%m', date) = ?
        AND status IN ('已完工', '已送货')
    `).get(period) as any;

    // 计算进项税额（从采购费用）
    const purchaseData = this.db.prepare(`
      SELECT 
        SUM(amount) as total_purchase,
        SUM(amount / (1 + ? / 100)) as purchase_excluding_tax,
        SUM(amount - amount / (1 + ? / 100)) as input_vat
      FROM expenses
      WHERE strftime('%Y-%m', date) = ?
        AND category IN ('原材料采购', '设备采购', '办公用品')
    `).get(taxRate, taxRate, period) as any;

    const outputVAT = salesData?.output_vat || 0;
    const inputVAT = purchaseData?.input_vat || 0;
    const salesAmount = salesData?.sales_excluding_tax || 0;
    const purchaseAmount = purchaseData?.purchase_excluding_tax || 0;

    // 获取进项税额转出
    const transferOutData = this.db.prepare(`
      SELECT SUM(debit - credit) as transfer_out
      FROM voucher_lines
      WHERE account_id = '222102-02'
        AND voucher_id IN (
          SELECT id FROM vouchers 
          WHERE strftime('%Y-%m', date) = ?
        )
    `).get(period) as any;

    const inputVATTransferOut = Math.max(0, transferOutData?.transfer_out || 0);

    // 属性41: 应纳税额 = 销项税额 - 进项税额 + 进项税额转出
    const vatPayable = outputVAT - inputVAT + inputVATTransferOut;

    const report: VATReport = {
      period,
      output_vat: Math.round(outputVAT * 100) / 100,
      input_vat: Math.round(inputVAT * 100) / 100,
      vat_payable: Math.round(vatPayable * 100) / 100,
      details: {
        sales_amount: Math.round(salesAmount * 100) / 100,
        purchase_amount: Math.round(purchaseAmount * 100) / 100,
        input_vat_transfer_out: Math.round(inputVATTransferOut * 100) / 100
      }
    };

    // 保存报表到数据库
    this.saveTaxReport('vat', period, report);

    return report;
  }

  /**
   * 处理进项税额转出
   * Handle input VAT transfer out
   * 
   * 当购进的货物用于非应税项目、免税项目或发生非正常损失时，需要将进项税额转出
   */
  transferInputVAT(params: {
    date: string;
    amount: number;
    reason: string;
    notes?: string;
  }): { voucher_id: number } {
    const { date, amount, reason, notes } = params;

    // 生成进项税额转出凭证
    // 借：相关成本费用科目
    // 贷：应交税费-应交增值税(进项税额转出)
    
    const voucherNo = this.generateVoucherNo('vat_transfer', date);
    
    const voucherResult = this.db.prepare(`
      INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, created_by)
      VALUES (?, ?, 'manual', ?, 'draft', 'system')
    `).run(date, voucherNo, `进项税额转出 - ${reason}${notes ? ': ' + notes : ''}`);

    const voucherId = voucherResult.lastInsertRowid as number;

    // 借：管理费用/制造费用（根据原因确定）
    const expenseAccount = reason.includes('非正常损失') ? '6602' : '5101-03';
    
    this.db.prepare(`
      INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit)
      VALUES (?, 1, ?, ?, 0)
    `).run(voucherId, expenseAccount, amount);

    // 贷：应交税费-应交增值税(进项税额转出)
    this.db.prepare(`
      INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit)
      VALUES (?, 2, '222102-02', 0, ?)
    `).run(voucherId, amount);

    return { voucher_id: voucherId };
  }

  /**
   * 计算企业所得税
   * Calculate Enterprise Income Tax (EIT)
   * 
   * 属性42: 企业所得税 = 应纳税所得额 × 税率
   */
  calculateEIT(period: string): EITReport {
    const config = this.getTaxConfig();
    const eitRate = config.eit_rate;

    // 获取本期收入
    const revenueData = this.db.prepare(`
      SELECT SUM(debit - credit) as revenue
      FROM voucher_lines
      WHERE account_id LIKE '5%'
        AND voucher_id IN (
          SELECT id FROM vouchers 
          WHERE strftime('%Y-%m', date) = ?
            AND status = 'approved'
        )
    `).get(period) as any;

    // 获取本期成本
    const costData = this.db.prepare(`
      SELECT SUM(debit - credit) as cost
      FROM voucher_lines
      WHERE account_id = '5401'
        AND voucher_id IN (
          SELECT id FROM vouchers 
          WHERE strftime('%Y-%m', date) = ?
            AND status = 'approved'
        )
    `).get(period) as any;

    // 获取本期费用
    const expenseData = this.db.prepare(`
      SELECT SUM(debit - credit) as expense
      FROM voucher_lines
      WHERE account_id LIKE '66%'
        AND voucher_id IN (
          SELECT id FROM vouchers 
          WHERE strftime('%Y-%m', date) = ?
            AND status = 'approved'
        )
    `).get(period) as any;

    const revenue = Math.abs(revenueData?.revenue || 0);
    const cost = costData?.cost || 0;
    const expense = expenseData?.expense || 0;

    // 应纳税所得额 = 收入 - 成本 - 费用
    const taxableIncome = revenue - cost - expense;

    // 属性42: 企业所得税 = 应纳税所得额 × 税率
    const eitPayable = taxableIncome > 0 ? taxableIncome * (eitRate / 100) : 0;

    // 获取已预缴的企业所得税
    const prepaidData = this.db.prepare(`
      SELECT SUM(debit - credit) as prepaid
      FROM voucher_lines
      WHERE account_id = '222103'
        AND voucher_id IN (
          SELECT id FROM vouchers 
          WHERE strftime('%Y-%m', date) <= ?
            AND status = 'approved'
        )
    `).get(period) as any;

    const prepaidEIT = prepaidData?.prepaid || 0;

    const report: EITReport = {
      period,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      taxable_income: Math.round(taxableIncome * 100) / 100,
      eit_payable: Math.round(eitPayable * 100) / 100,
      prepaid_eit: Math.round(prepaidEIT * 100) / 100
    };

    // 保存报表到数据库
    this.saveTaxReport('eit', period, report);

    return report;
  }

  /**
   * 生成季度企业所得税申报表
   * Generate quarterly EIT report
   */
  generateQuarterlyEITReport(year: number, quarter: number): EITReport {
    const months = this.getQuarterMonths(year, quarter);
    
    let totalRevenue = 0;
    let totalCost = 0;
    let totalExpense = 0;

    // 汇总季度数据
    for (const month of months) {
      const monthReport = this.calculateEIT(month);
      totalRevenue += monthReport.revenue;
      totalCost += monthReport.cost;
      totalExpense += monthReport.expense;
    }

    const config = this.getTaxConfig();
    const eitRate = config.eit_rate;
    const taxableIncome = totalRevenue - totalCost - totalExpense;
    const eitPayable = taxableIncome > 0 ? taxableIncome * (eitRate / 100) : 0;

    const period = `${year}-Q${quarter}`;

    const report: EITReport = {
      period,
      revenue: Math.round(totalRevenue * 100) / 100,
      cost: Math.round(totalCost * 100) / 100,
      expense: Math.round(totalExpense * 100) / 100,
      taxable_income: Math.round(taxableIncome * 100) / 100,
      eit_payable: Math.round(eitPayable * 100) / 100,
      prepaid_eit: 0
    };

    // 保存季度报表
    this.saveTaxReport('eit_quarterly', period, report);

    return report;
  }

  /**
   * 检查税务风险
   * Check tax risks
   */
  checkTaxRisks(period: string): TaxRiskAlert[] {
    const alerts: TaxRiskAlert[] = [];
    const vatReport = this.generateVATReport(period);
    const eitReport = this.calculateEIT(period);

    // 检查进项税额占比异常
    if (vatReport.output_vat > 0) {
      const inputRatio = (vatReport.input_vat / vatReport.output_vat) * 100;
      
      if (inputRatio > 90) {
        alerts.push({
          risk_type: 'high_input_vat_ratio',
          severity: 'high',
          description: `进项税额占销项税额比例过高 (${inputRatio.toFixed(1)}%)，可能引起税务关注`,
          suggestion: '请核实进项税额抵扣的合规性，确保取得合法有效的增值税专用发票'
        });
      } else if (inputRatio > 80) {
        alerts.push({
          risk_type: 'high_input_vat_ratio',
          severity: 'medium',
          description: `进项税额占销项税额比例较高 (${inputRatio.toFixed(1)}%)`,
          suggestion: '建议关注进项税额的合理性'
        });
      }
    }

    // 检查税负率偏低
    if (vatReport.details.sales_amount > 0) {
      const taxBurdenRate = (vatReport.vat_payable / vatReport.details.sales_amount) * 100;
      
      // 制造业一般税负率在 2-5% 之间
      if (taxBurdenRate < 1 && vatReport.vat_payable > 0) {
        alerts.push({
          risk_type: 'low_tax_burden_rate',
          severity: 'high',
          description: `增值税税负率偏低 (${taxBurdenRate.toFixed(2)}%)，低于行业平均水平`,
          suggestion: '请核实销售收入和进项税额的准确性，避免税务风险'
        });
      } else if (taxBurdenRate < 2 && vatReport.vat_payable > 0) {
        alerts.push({
          risk_type: 'low_tax_burden_rate',
          severity: 'medium',
          description: `增值税税负率较低 (${taxBurdenRate.toFixed(2)}%)`,
          suggestion: '建议关注税负率变化趋势'
        });
      }
    }

    // 检查企业所得税异常
    if (eitReport.revenue > 0 && eitReport.taxable_income < 0) {
      alerts.push({
        risk_type: 'negative_taxable_income',
        severity: 'medium',
        description: '本期应纳税所得额为负数，企业处于亏损状态',
        suggestion: '建议分析亏损原因，关注成本费用的合理性'
      });
    }

    // 检查收入成本配比异常
    if (eitReport.revenue > 0) {
      const costRatio = (eitReport.cost / eitReport.revenue) * 100;
      
      if (costRatio > 90) {
        alerts.push({
          risk_type: 'high_cost_ratio',
          severity: 'medium',
          description: `成本占收入比例过高 (${costRatio.toFixed(1)}%)，毛利率偏低`,
          suggestion: '建议分析成本构成，关注成本控制'
        });
      }
    }

    return alerts;
  }

  /**
   * 保存税务报表到数据库
   * Save tax report to database
   */
  private saveTaxReport(reportType: string, period: string, reportData: any): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO tax_reports (report_type, period, report_data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      reportType,
      period,
      JSON.stringify(reportData),
      new Date().toISOString()
    );
  }

  /**
   * 获取历史税务报表
   * Get historical tax report
   */
  getTaxReport(reportType: string, period: string): any {
    const result = this.db.prepare(`
      SELECT report_data FROM tax_reports
      WHERE report_type = ? AND period = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(reportType, period) as any;

    if (result) {
      return JSON.parse(result.report_data);
    }

    return null;
  }

  /**
   * 生成凭证号
   * Generate voucher number
   */
  private generateVoucherNo(type: string, date: string): string {
    const dateStr = date.replace(/-/g, '').substring(2); // YYMMDD
    const count = this.db.prepare(`
      SELECT COUNT(*) as count FROM vouchers
      WHERE date = ?
    `).get(date) as any;

    const seq = String(count.count + 1).padStart(3, '0');
    return `记-${dateStr}-${seq}`;
  }

  /**
   * 获取季度的月份
   * Get months in a quarter
   */
  private getQuarterMonths(year: number, quarter: number): string[] {
    const startMonth = (quarter - 1) * 3 + 1;
    const months: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      const month = startMonth + i;
      months.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    
    return months;
  }
}
