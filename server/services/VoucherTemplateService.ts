import Database from "better-sqlite3";
import { VoucherTemplate, TemplateLineConfig, Voucher, VoucherLine, ValidationResult } from "../../src/types.js";

/**
 * 凭证模板管理服务
 * 负责凭证模板的创建、查询和应用
 * 
 * 属性36: 凭证模板保存和调用
 */
export class VoucherTemplateService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 创建凭证模板
   * 支持保存常用凭证为模板
   */
  createTemplate(template: Omit<VoucherTemplate, 'id' | 'created_at'>): ValidationResult & { id?: number } {
    // 验证模板数据
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      return validation;
    }

    try {
      const result = this.db.prepare(`
        INSERT INTO voucher_templates (name, description, voucher_type, template_lines, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        template.name,
        template.description,
        template.voucher_type,
        JSON.stringify(template.template_lines)
      );

      return { 
        valid: true, 
        id: result.lastInsertRowid as number 
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'CREATE_TEMPLATE_FAILED'
        }]
      };
    }
  }

  /**
   * 获取所有凭证模板
   */
  getTemplates(): VoucherTemplate[] {
    const templates = this.db
      .prepare("SELECT * FROM voucher_templates ORDER BY created_at DESC")
      .all() as any[];
    
    return templates.map(t => ({
      ...t,
      template_lines: JSON.parse(t.template_lines)
    }));
  }

  /**
   * 根据ID获取模板
   */
  getTemplateById(id: number): VoucherTemplate | null {
    const template = this.db
      .prepare("SELECT * FROM voucher_templates WHERE id = ?")
      .get(id) as any;
    
    if (!template) return null;
    
    return {
      ...template,
      template_lines: JSON.parse(template.template_lines)
    };
  }

  /**
   * 根据凭证类型获取模板
   */
  getTemplatesByType(voucherType: string): VoucherTemplate[] {
    const templates = this.db
      .prepare("SELECT * FROM voucher_templates WHERE voucher_type = ? ORDER BY created_at DESC")
      .all(voucherType) as any[];
    
    return templates.map(t => ({
      ...t,
      template_lines: JSON.parse(t.template_lines)
    }));
  }

  /**
   * 应用模板创建凭证
   * 支持从模板快速创建凭证
   * 
   * @param templateId 模板ID
   * @param data 动态数据，用于计算公式（如 { amount: 10000, tax_rate: 0.13 }）
   * @param date 凭证日期
   * @param notes 凭证摘要
   */
  applyTemplate(
    templateId: number, 
    data: Record<string, number>, 
    date: string, 
    notes?: string
  ): ValidationResult & { voucher?: Partial<Voucher> } {
    const template = this.getTemplateById(templateId);
    
    if (!template) {
      return {
        valid: false,
        errors: [{
          field: 'templateId',
          message: '模板不存在',
          code: 'TEMPLATE_NOT_FOUND'
        }]
      };
    }

    try {
      // 根据模板生成凭证分录
      const lines: VoucherLine[] = [];
      let lineNo = 1;

      for (const templateLine of template.template_lines) {
        const line: VoucherLine = {
          line_no: lineNo++,
          account_id: templateLine.account_id,
          debit: 0,
          credit: 0,
          notes: templateLine.notes
        };

        // 计算借方金额
        if (templateLine.debit_formula) {
          line.debit = this.evaluateFormula(templateLine.debit_formula, data);
        }

        // 计算贷方金额
        if (templateLine.credit_formula) {
          line.credit = this.evaluateFormula(templateLine.credit_formula, data);
        }

        lines.push(line);
      }

      // 构建凭证对象（不包含ID和凭证号，由调用方生成）
      const voucher: Partial<Voucher> = {
        date,
        voucher_type: template.voucher_type as any,
        notes: notes || template.description,
        status: 'draft',
        lines
      };

      return {
        valid: true,
        voucher
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: `应用模板失败: ${error.message}`,
          code: 'APPLY_TEMPLATE_FAILED'
        }]
      };
    }
  }

  /**
   * 从现有凭证保存为模板
   */
  saveVoucherAsTemplate(
    voucher: Voucher,
    templateName: string,
    templateDescription: string
  ): ValidationResult & { id?: number } {
    // 将凭证分录转换为模板配置
    const templateLines: TemplateLineConfig[] = voucher.lines.map(line => ({
      account_id: line.account_id,
      debit_formula: line.debit > 0 ? 'amount' : undefined,
      credit_formula: line.credit > 0 ? 'amount' : undefined,
      notes: line.notes
    }));

    return this.createTemplate({
      name: templateName,
      description: templateDescription,
      voucher_type: voucher.voucher_type,
      template_lines: templateLines
    });
  }

  /**
   * 更新模板
   */
  updateTemplate(id: number, updates: Partial<VoucherTemplate>): ValidationResult {
    const template = this.getTemplateById(id);
    if (!template) {
      return {
        valid: false,
        errors: [{
          field: 'id',
          message: '模板不存在',
          code: 'TEMPLATE_NOT_FOUND'
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
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.voucher_type !== undefined) {
        fields.push('voucher_type = ?');
        values.push(updates.voucher_type);
      }
      if (updates.template_lines !== undefined) {
        fields.push('template_lines = ?');
        values.push(JSON.stringify(updates.template_lines));
      }

      if (fields.length === 0) {
        return { valid: true };
      }

      values.push(id);

      this.db.prepare(`
        UPDATE voucher_templates SET ${fields.join(', ')} WHERE id = ?
      `).run(...values);

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'UPDATE_TEMPLATE_FAILED'
        }]
      };
    }
  }

  /**
   * 删除模板
   */
  deleteTemplate(id: number): ValidationResult {
    const template = this.getTemplateById(id);
    if (!template) {
      return {
        valid: false,
        errors: [{
          field: 'id',
          message: '模板不存在',
          code: 'TEMPLATE_NOT_FOUND'
        }]
      };
    }

    try {
      this.db.prepare("DELETE FROM voucher_templates WHERE id = ?").run(id);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          field: 'general',
          message: error.message,
          code: 'DELETE_TEMPLATE_FAILED'
        }]
      };
    }
  }

  /**
   * 验证模板数据
   */
  private validateTemplate(template: Omit<VoucherTemplate, 'id' | 'created_at'>): ValidationResult {
    const errors: any[] = [];

    // 验证模板名称
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: '模板名称不能为空',
        code: 'TEMPLATE_NAME_REQUIRED'
      });
    }

    // 验证模板分录
    if (!template.template_lines || template.template_lines.length === 0) {
      errors.push({
        field: 'template_lines',
        message: '模板至少需要一条分录',
        code: 'TEMPLATE_LINES_REQUIRED'
      });
    }

    // 验证每条分录
    template.template_lines?.forEach((line, index) => {
      if (!line.account_id) {
        errors.push({
          field: `template_lines[${index}].account_id`,
          message: '科目编码不能为空',
          code: 'ACCOUNT_ID_REQUIRED'
        });
      }

      // 验证至少有借方或贷方公式
      if (!line.debit_formula && !line.credit_formula) {
        errors.push({
          field: `template_lines[${index}]`,
          message: '分录必须有借方或贷方金额公式',
          code: 'AMOUNT_FORMULA_REQUIRED'
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 计算公式
   * 支持简单的数学表达式，如 "amount", "amount * 0.13", "amount * tax_rate"
   */
  private evaluateFormula(formula: string, data: Record<string, number>): number {
    try {
      // 替换变量
      let expression = formula;
      for (const [key, value] of Object.entries(data)) {
        expression = expression.replace(new RegExp(key, 'g'), value.toString());
      }

      // 安全计算（仅支持基本数学运算）
      // 移除所有非数字、运算符、小数点和空格的字符
      if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
        throw new Error(`不安全的公式表达式: ${formula}`);
      }

      // 使用 Function 构造器安全计算
      const result = new Function(`return ${expression}`)();
      
      // 四舍五入到两位小数
      return Math.round(result * 100) / 100;
    } catch (error: any) {
      throw new Error(`公式计算失败: ${formula}, 错误: ${error.message}`);
    }
  }
}
