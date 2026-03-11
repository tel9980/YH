import express from "express";
import Database from "better-sqlite3";
import { AccountService } from "../services/AccountService.js";
import { ValidationService } from "../services/ValidationService.js";
import { VoucherGenerator } from "../services/VoucherGenerator.js";
import { VoucherTemplateService } from "../services/VoucherTemplateService.js";
import { CostAccountingService } from "../services/CostAccountingService.js";
import { InventoryValuationService } from "../services/InventoryValuationService.js";
import { ClosingProcessor } from "../services/ClosingProcessor.js";
import { FinancialStatementGenerator } from "../services/FinancialStatementGenerator.js";
import { SubsidiaryAccountingService } from "../services/SubsidiaryAccountingService.js";
import { TaxManagementService } from "../services/TaxManagementService.js";
import { FixedAssetService } from "../services/FixedAssetService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { BackupService } from "../services/BackupService.js";
import { errorHandler } from "../middleware/errorHandler.js";

/**
 * v7.0 API 路由
 * 整合所有新增的专业会计功能
 */
export function createV7Routes(db: Database.Database, dbPath?: string) {
  const router = express.Router();

  // 初始化服务
  const accountService = new AccountService(db);
  const validationService = new ValidationService(db);
  const voucherGenerator = new VoucherGenerator(db);
  const voucherTemplateService = new VoucherTemplateService(db);
  const costAccountingService = new CostAccountingService(db);
  const inventoryValuationService = new InventoryValuationService(db);
  const closingProcessor = new ClosingProcessor(db);
  const statementGenerator = new FinancialStatementGenerator(db);
  const subsidiaryAccountingService = new SubsidiaryAccountingService(db);
  const taxManagementService = new TaxManagementService(db);
  const fixedAssetService = new FixedAssetService(db);
  const auditLogService = new AuditLogService(db);
  const backupService = dbPath ? new BackupService(db, dbPath) : null;

  // ============================================================================
  // 会计科目管理 API
  // ============================================================================

  // 获取所有科目
  router.get("/accounts", (req, res) => {
    try {
      const accounts = accountService.getAllAccounts();
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取科目树
  router.get("/accounts/tree", (req, res) => {
    try {
      const tree = accountService.getAccountTree();
      res.json(tree);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建科目
  router.post("/accounts", (req, res) => {
    try {
      const result = accountService.createAccount(req.body);
      if (result.valid) {
        res.json({ success: true, id: result.id });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新科目
  router.put("/accounts/:id", (req, res) => {
    try {
      const result = accountService.updateAccount(req.params.id, req.body);
      if (result.valid) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除科目
  router.delete("/accounts/:id", (req, res) => {
    try {
      const result = accountService.deleteAccount(req.params.id);
      if (result.valid) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 切换科目状态
  router.patch("/accounts/:id/status", (req, res) => {
    try {
      const result = accountService.toggleAccountStatus(req.params.id);
      if (result.valid) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 凭证管理 API
  // ============================================================================

  // 验证凭证
  router.post("/vouchers/validate", (req, res) => {
    try {
      const result = validationService.validateVoucher(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 审核凭证
  router.patch("/vouchers/:id/approve", (req, res) => {
    try {
      const { userId } = req.body;
      const result = db.prepare(`
        UPDATE vouchers 
        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'draft'
      `).run(userId || 'system', req.params.id);

      if (result.changes > 0) {
        // 记录审计日志
        const voucher = db.prepare("SELECT voucher_no FROM vouchers WHERE id = ?").get(req.params.id) as any;
        if (voucher) {
          auditLogService.logVoucherApprove(userId || 'system', parseInt(req.params.id), voucher.voucher_no);
        }
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "凭证不存在或已审核" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 凭证冲销 (红字凭证)
  router.post("/vouchers/:id/reverse", (req, res) => {
    try {
      const { userId, reason } = req.body;
      const voucherId = parseInt(req.params.id);

      // 1. 获取原凭证
      const originalVoucher = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucherId) as any;
      if (!originalVoucher) return res.status(404).json({ error: "原凭证不存在" });
      if (originalVoucher.status !== 'approved') return res.status(400).json({ error: "只有已审核的凭证才能冲销" });

      const lines = db.prepare("SELECT * FROM voucher_lines WHERE voucher_id = ?").all(voucherId) as any[];

      const transaction = db.transaction(() => {
        // 2. 创建红字凭证
        const reverseVoucherNo = `冲-${originalVoucher.voucher_no}`;
        const info = db.prepare(`
          INSERT INTO vouchers (date, voucher_no, voucher_type, notes, status, created_by, created_at) 
          VALUES (?, ?, 'reverse', ?, 'approved', ?, CURRENT_TIMESTAMP)
        `).run(
          new Date().toISOString().split('T')[0],
          reverseVoucherNo,
          `冲销凭证 ${originalVoucher.voucher_no}: ${reason || '错误修正'}`,
          userId || 'system'
        );
        const reverseVoucherId = info.lastInsertRowid as number;

        // 3. 插入相反金额的行 (红字)
        const insertLine = db.prepare(`
          INSERT INTO voucher_lines (voucher_id, line_no, account_id, debit, credit, notes) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        lines.forEach(line => {
          insertLine.run(
            reverseVoucherId,
            line.line_no,
            line.account_id,
            line.debit !== 0 ? -line.debit : 0,
            line.credit !== 0 ? -line.credit : 0,
            `冲销: ${line.notes || ''}`
          );
        });

        // 4. 标记原凭证为已冲销
        db.prepare("UPDATE vouchers SET status = 'reversed', notes = notes || ? WHERE id = ?")
          .run(` (已冲销, 见凭证 ${reverseVoucherNo})`, voucherId);

        return reverseVoucherId;
      });

      const newVoucherId = transaction();
      
      // 5. 记录审计日志
      auditLogService.logVoucherReverse(userId || 'system', voucherId, newVoucherId, originalVoucher.voucher_no);

      res.json({ success: true, reverseVoucherId: newVoucherId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 批量生成凭证
  router.post("/vouchers/generate-batch", async (req, res) => {
    try {
      const { sourceType, ids } = req.body;
      const result = await voucherGenerator.batchGenerateVouchers(sourceType, ids);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成单个凭证
  router.post("/vouchers/generate", async (req, res) => {
    try {
      const { sourceType, sourceId } = req.body;
      const voucherId = await voucherGenerator.generateVoucher(sourceType, sourceId);
      if (voucherId) {
        res.json({ success: true, voucherId });
      } else {
        res.status(500).json({ error: "凭证生成失败" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 凭证模板 API
  // ============================================================================

  // 获取所有模板
  router.get("/voucher-templates", (req, res) => {
    try {
      const templates = voucherTemplateService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个模板
  router.get("/voucher-templates/:id", (req, res) => {
    try {
      const template = voucherTemplateService.getTemplateById(parseInt(req.params.id));
      if (template) {
        res.json(template);
      } else {
        res.status(404).json({ error: "模板不存在" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建模板
  router.post("/voucher-templates", (req, res) => {
    try {
      const result = voucherTemplateService.createTemplate(req.body);
      if (result.valid) {
        res.json({ success: true, id: result.id });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 应用模板
  router.post("/voucher-templates/apply", (req, res) => {
    try {
      const { templateId, data, date, notes } = req.body;
      const result = voucherTemplateService.applyTemplate(templateId, data, date, notes);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 从凭证保存为模板
  router.post("/voucher-templates/from-voucher", (req, res) => {
    try {
      const { voucher, templateName, templateDescription } = req.body;
      const result = voucherTemplateService.saveVoucherAsTemplate(voucher, templateName, templateDescription);
      if (result.valid) {
        res.json({ success: true, id: result.id });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新模板
  router.put("/voucher-templates/:id", (req, res) => {
    try {
      const result = voucherTemplateService.updateTemplate(parseInt(req.params.id), req.body);
      if (result.valid) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除模板
  router.delete("/voucher-templates/:id", (req, res) => {
    try {
      const result = voucherTemplateService.deleteTemplate(parseInt(req.params.id));
      if (result.valid) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.errors });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 成本核算 API
  // ============================================================================

  // 设置产品标准成本
  router.post("/product-costs/:productId", (req, res) => {
    try {
      costAccountingService.setProductCost(parseInt(req.params.productId), req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取产品成本
  router.get("/product-costs/:productId", (req, res) => {
    try {
      const cost = costAccountingService.getProductCost(parseInt(req.params.productId));
      res.json(cost);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取所有成本差异
  router.get("/cost-variances", (req, res) => {
    try {
      const variances = costAccountingService.getAllCostVariances();
      res.json(variances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 计算成本差异
  router.post("/cost-variances/calculate", (req, res) => {
    try {
      const { period, productId } = req.body;
      const variance = costAccountingService.calculateVariances(period, productId);
      res.json(variance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 处理成本差异
  router.post("/cost-variances/:id/process", (req, res) => {
    try {
      const voucherId = costAccountingService.processVariance(parseInt(req.params.id));
      res.json({ success: true, voucherId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建生产订单
  router.post("/production-orders", (req, res) => {
    try {
      const orderId = costAccountingService.createProductionOrder(req.body);
      res.json({ success: true, orderId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取所有生产订单
  router.get("/production-orders", (req, res) => {
    try {
      const orders = costAccountingService.getAllProductionOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取生产订单详情
  router.get("/production-orders/:id", (req, res) => {
    try {
      const order = costAccountingService.getProductionOrder(parseInt(req.params.id));
      if (order) {
        res.json(order);
      } else {
        res.status(404).json({ error: "生产订单不存在" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取生产订单成本明细
  router.get("/production-orders/:id/cost-details", (req, res) => {
    try {
      const details = costAccountingService.getProductionOrderCostDetails(parseInt(req.params.id));
      if (details) {
        res.json(details);
      } else {
        res.status(404).json({ error: "生产订单不存在" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成生产成本计算单
  router.get("/production-orders/:id/cost-sheet", (req, res) => {
    try {
      const costSheet = costAccountingService.generateCostSheet(parseInt(req.params.id));
      res.json(costSheet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 归集材料成本
  router.post("/production-orders/:id/allocate-material", (req, res) => {
    try {
      const { itemId, quantity, unitCost } = req.body;
      costAccountingService.allocateMaterialCost(
        parseInt(req.params.id),
        itemId,
        quantity,
        unitCost
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 归集人工成本
  router.post("/production-orders/:id/allocate-labor", (req, res) => {
    try {
      const { laborCost, notes } = req.body;
      costAccountingService.allocateLaborCost(
        parseInt(req.params.id),
        laborCost,
        notes
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 库存计价 API
  // ============================================================================

  // 获取库存计价配置
  router.get("/inventory/valuation-config", (req, res) => {
    try {
      const config = inventoryValuationService.getValuationConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新库存计价方法
  router.put("/inventory/valuation-config", (req, res) => {
    try {
      const { method, userId } = req.body;
      inventoryValuationService.updateValuationConfig(method, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 处理出库
  router.post("/inventory/outbound", (req, res) => {
    try {
      const { itemId, quantity, referenceType, referenceId } = req.body;
      const cost = inventoryValuationService.processOutbound(itemId, quantity, referenceType, referenceId);
      res.json({ success: true, cost });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 处理入库
  router.post("/inventory/inbound", (req, res) => {
    try {
      const { itemId, quantity, unitCost, referenceType, referenceId } = req.body;
      inventoryValuationService.processInbound(itemId, quantity, unitCost, referenceType, referenceId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取库存明细账
  router.get("/inventory/:itemId/ledger", (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const ledger = inventoryValuationService.getInventoryLedger(
        parseInt(req.params.itemId),
        startDate as string,
        endDate as string
      );
      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 月末结账 API
  // ============================================================================

  // 执行结账
  router.post("/closing/execute", async (req, res) => {
    try {
      const { period, userId } = req.body;
      const report = await closingProcessor.executeClosing(period, userId);
      res.json({ success: true, report });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 反结账
  router.post("/closing/reopen", async (req, res) => {
    try {
      const { period, userId } = req.body;
      await closingProcessor.reopenPeriod(period, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 检查期间是否已结账
  router.get("/closing/check/:period", (req, res) => {
    try {
      const isClosed = closingProcessor.isPeriodClosed(req.params.period);
      res.json({ isClosed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 财务报表 API
  // ============================================================================

  // 生成资产负债表
  router.get("/reports/balance-sheet", (req, res) => {
    try {
      const { period } = req.query;
      const report = statementGenerator.generateBalanceSheet(period as string);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成利润表
  router.get("/reports/income-statement", (req, res) => {
    try {
      const { period } = req.query;
      const report = statementGenerator.generateIncomeStatement(period as string);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成现金流量表
  router.get("/reports/cash-flow", (req, res) => {
    try {
      const { period } = req.query;
      const report = statementGenerator.generateCashFlowStatement(period as string);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 计算财务指标
  router.get("/reports/financial-ratios", (req, res) => {
    try {
      const { period } = req.query;
      const ratios = statementGenerator.calculateFinancialRatios(period as string);
      res.json(ratios);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 导出报表到 Excel
  router.get("/reports/export/excel", (req, res) => {
    try {
      const { reportType, period } = req.query;
      
      if (!reportType || !period) {
        return res.status(400).json({ error: '缺少必需参数: reportType 和 period' });
      }
      
      const buffer = statementGenerator.exportToExcel(reportType as string, period as string);
      
      // 设置响应头
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${period}.xlsx"`);
      
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 导出报表到 PDF
  router.get("/reports/export/pdf", (req, res) => {
    try {
      const { reportType, period } = req.query;
      
      if (!reportType || !period) {
        return res.status(400).json({ error: '缺少必需参数: reportType 和 period' });
      }
      
      const buffer = statementGenerator.exportToPDF(reportType as string, period as string);
      
      // 设置响应头
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${period}.pdf"`);
      
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 辅助核算 API
  // ============================================================================

  // 获取辅助核算明细账
  // 属性34: 辅助核算明细账查询准确性
  router.get("/subsidiary-ledger", (req, res) => {
    try {
      const { account_id, auxiliary_type, auxiliary_id, start_date, end_date } = req.query;

      if (!account_id || !auxiliary_type || !auxiliary_id || !start_date || !end_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: account_id, auxiliary_type, auxiliary_id, start_date, end_date" 
        });
      }

      const ledger = subsidiaryAccountingService.getSubsidiaryLedger(
        account_id as string,
        auxiliary_type as 'customer' | 'supplier' | 'department' | 'project' | 'inventory',
        parseInt(auxiliary_id as string),
        start_date as string,
        end_date as string
      );

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取客户应收账款明细账
  router.get("/subsidiary-ledger/customer/:customerId", (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: start_date, end_date" 
        });
      }

      const ledger = subsidiaryAccountingService.getCustomerLedger(
        parseInt(req.params.customerId),
        start_date as string,
        end_date as string
      );

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取供应商应付账款明细账
  router.get("/subsidiary-ledger/supplier/:supplierId", (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: start_date, end_date" 
        });
      }

      const ledger = subsidiaryAccountingService.getSupplierLedger(
        parseInt(req.params.supplierId),
        start_date as string,
        end_date as string
      );

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取存货明细账
  router.get("/subsidiary-ledger/inventory/:inventoryId", (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: start_date, end_date" 
        });
      }

      const ledger = subsidiaryAccountingService.getInventoryLedger(
        parseInt(req.params.inventoryId),
        start_date as string,
        end_date as string
      );

      res.json(ledger);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取所有客户应收账款汇总
  router.get("/subsidiary-ledger/customer-balances", (req, res) => {
    try {
      const { as_of_date } = req.query;

      if (!as_of_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: as_of_date" 
        });
      }

      const balances = subsidiaryAccountingService.getAllCustomerBalances(as_of_date as string);
      res.json(balances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取所有供应商应付账款汇总
  router.get("/subsidiary-ledger/supplier-balances", (req, res) => {
    try {
      const { as_of_date } = req.query;

      if (!as_of_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: as_of_date" 
        });
      }

      const balances = subsidiaryAccountingService.getAllSupplierBalances(as_of_date as string);
      res.json(balances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成客户往来对账单
  // 属性35: 往来对账单数据准确性
  router.get("/reconciliation/customer/:customerId", (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const customerId = parseInt(req.params.customerId);

      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: start_date, end_date" 
        });
      }

      if (isNaN(customerId)) {
        return res.status(400).json({ 
          error: "无效的客户ID" 
        });
      }

      const statement = subsidiaryAccountingService.generateReconciliationStatement(
        'customer',
        customerId,
        start_date as string,
        end_date as string
      );

      res.json(statement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成供应商往来对账单
  // 属性35: 往来对账单数据准确性
  router.get("/reconciliation/supplier/:supplierId", (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const supplierId = parseInt(req.params.supplierId);

      if (!start_date || !end_date) {
        return res.status(400).json({ 
          error: "缺少必需参数: start_date, end_date" 
        });
      }

      if (isNaN(supplierId)) {
        return res.status(400).json({ 
          error: "无效的供应商ID" 
        });
      }

      const statement = subsidiaryAccountingService.generateReconciliationStatement(
        'supplier',
        supplierId,
        start_date as string,
        end_date as string
      );

      res.json(statement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 数据校验 API
  // ============================================================================

  // 检查异常余额
  router.get("/validation/abnormal-balances", (req, res) => {
    try {
      const warnings = validationService.checkAbnormalBalances();
      res.json(warnings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 数据一致性检查
  router.get("/validation/consistency-check", (req, res) => {
    try {
      const result = validationService.checkConsistency();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 税务管理 API (Tax Management)
  // ============================================================================

  // 获取税务配置
  router.get("/tax/config", (req, res) => {
    try {
      const config = taxManagementService.getTaxConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新税务配置
  router.put("/tax/config", (req, res) => {
    try {
      const config = taxManagementService.updateTaxConfig(req.body);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 计算增值税
  // 属性40: 增值税计算准确性
  router.post("/tax/calculate-vat", (req, res) => {
    try {
      const { amountExcludingTax, taxRate } = req.body;
      const result = taxManagementService.calculateVAT(amountExcludingTax, taxRate);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成增值税申报表
  // 属性41: 增值税申报表数据准确性
  router.get("/tax/vat-report", (req, res) => {
    try {
      const { period } = req.query;
      if (!period || typeof period !== 'string') {
        return res.status(400).json({ error: '缺少期间参数' });
      }
      const report = taxManagementService.generateVATReport(period);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 处理进项税额转出
  router.post("/tax/transfer-input-vat", (req, res) => {
    try {
      const { date, amount, reason, notes } = req.body;
      if (!date || !amount || !reason) {
        return res.status(400).json({ error: '缺少必要参数' });
      }
      const result = taxManagementService.transferInputVAT({ date, amount, reason, notes });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 计算企业所得税
  // 属性42: 企业所得税计算准确性
  router.get("/tax/eit-report", (req, res) => {
    try {
      const { period } = req.query;
      if (!period || typeof period !== 'string') {
        return res.status(400).json({ error: '缺少期间参数' });
      }
      const report = taxManagementService.calculateEIT(period);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 生成季度企业所得税申报表
  router.get("/tax/eit-report/quarterly", (req, res) => {
    try {
      const { year, quarter } = req.query;
      if (!year || !quarter) {
        return res.status(400).json({ error: '缺少年份或季度参数' });
      }
      const report = taxManagementService.generateQuarterlyEITReport(
        parseInt(year as string),
        parseInt(quarter as string)
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 检查税务风险
  router.get("/tax/risk-alerts", (req, res) => {
    try {
      const { period } = req.query;
      if (!period || typeof period !== 'string') {
        return res.status(400).json({ error: '缺少期间参数' });
      }
      const alerts = taxManagementService.checkTaxRisks(period);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取历史税务报表
  router.get("/tax/reports/:reportType/:period", (req, res) => {
    try {
      const { reportType, period } = req.params;
      const report = taxManagementService.getTaxReport(reportType, period);
      if (!report) {
        return res.status(404).json({ error: '报表不存在' });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 审计日志 API (Audit Logs)
  // ============================================================================

  // 查询审计日志
  router.get("/audit-logs", (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date as string,
        endDate: req.query.end_date as string,
        action: req.query.action as string,
        user: req.query.user as string,
        entityType: req.query.entity_type as string,
        entityId: req.query.entity_id as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };
      const logs = auditLogService.query(filters);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取实体操作历史
  router.get("/audit-logs/entity/:entityType/:entityId", (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const history = auditLogService.getEntityHistory(entityType, entityId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取用户操作历史
  router.get("/audit-logs/user/:user", (req, res) => {
    try {
      const { user } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const history = auditLogService.getUserHistory(user, limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取审计日志统计
  router.get("/audit-logs/statistics", (req, res) => {
    try {
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      const stats = auditLogService.getStatistics(startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 数据备份 API (Backup)
  // ============================================================================

  // 执行手动备份
  router.post("/backup/manual", (req, res) => {
    try {
      if (!backupService) {
        return res.status(500).json({ error: '备份服务未初始化' });
      }
      const { notes, userId } = req.body;
      const record = backupService.backup('manual', notes);
      
      // 记录审计日志
      auditLogService.logBackup(
        userId || 'system',
        record.backup_path,
        record.file_size
      );
      
      res.json({ success: true, record });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取备份记录列表
  router.get("/backup/records", (req, res) => {
    try {
      if (!backupService) {
        return res.status(500).json({ error: '备份服务未初始化' });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const records = backupService.getBackupRecords(limit);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取最新备份
  router.get("/backup/latest", (req, res) => {
    try {
      if (!backupService) {
        return res.status(500).json({ error: '备份服务未初始化' });
      }
      const latest = backupService.getLatestBackup();
      res.json(latest);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取备份统计信息
  router.get("/backup/statistics", (req, res) => {
    try {
      if (!backupService) {
        return res.status(500).json({ error: '备份服务未初始化' });
      }
      const stats = backupService.getBackupStatistics();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除备份
  router.delete("/backup/:id", (req, res) => {
    try {
      if (!backupService) {
        return res.status(500).json({ error: '备份服务未初始化' });
      }
      const backupId = parseInt(req.params.id);
      backupService.deleteBackup(backupId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 检查是否需要自动备份
  router.get("/backup/should-auto-backup", (req, res) => {
    try {
      if (!backupService) {
        return res.status(500).json({ error: '备份服务未初始化' });
      }
      const should = backupService.shouldAutoBackup();
      res.json({ shouldBackup: should });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 应用错误处理中间件（必须在所有路由之后）
  router.use(errorHandler);

  // ============================================================================
  // 固定资产 API (Fixed Assets)
  // ============================================================================

  // 获取所有固定资产
  router.get("/fixed-assets", (req, res) => {
    try {
      const assets = db.prepare("SELECT * FROM fixed_assets ORDER BY acquisition_date DESC").all();
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取固定资产卡片
  router.get("/fixed-assets/:id", (req, res) => {
    try {
      const card = fixedAssetService.getAssetCard(parseInt(req.params.id));
      res.json(card);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 新增固定资产
  router.post("/fixed-assets", (req, res) => {
    try {
      const { name, category, acquisition_date, cost, salvage_value, useful_life, depreciation_method, asset_no, department_id } = req.body;
      
      const info = db.prepare(`
        INSERT INTO fixed_assets (
          name, category, acquisition_date, cost, salvage_value, useful_life, 
          depreciation_method, asset_no, department_id, net_book_value, accumulated_depreciation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '在用')
      `).run(
        name, category, acquisition_date, cost, salvage_value, useful_life, 
        depreciation_method, asset_no || `FA${new Date().getTime()}`, department_id || null, cost
      );
      
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 固定资产处置
  router.post("/fixed-assets/:id/dispose", (req, res) => {
    try {
      const { disposal_date, disposal_amount, disposal_expense, notes, userId } = req.body;
      fixedAssetService.disposeAsset({
        asset_id: parseInt(req.params.id),
        disposal_date,
        disposal_amount,
        disposal_expense,
        gain_loss: 0, // calculated in service
        notes
      }, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除固定资产
  router.delete("/fixed-assets/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM fixed_assets WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
