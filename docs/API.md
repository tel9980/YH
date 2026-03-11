# 小会计 v7.0 API 文档

## 概述

本文档描述小会计 v7.0 系统的所有 API 接口。所有接口均为 RESTful 风格，使用 JSON 格式传输数据。

### 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

### 响应格式

#### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

---

## 1. 会计科目管理 API

### 1.1 获取所有科目

**请求**

```
GET /api/accounts
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "1001",
      "name": "库存现金",
      "type": "asset",
      "category": "货币资金",
      "parent_id": null,
      "level": 1,
      "status": "active",
      "auxiliary_types": [],
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 1.2 获取单个科目

**请求**

```
GET /api/accounts/:id
```

**参数**

- `id` (string): 科目编码

**响应**

```json
{
  "success": true,
  "data": {
    "id": "1001",
    "name": "库存现金",
    "type": "asset",
    "category": "货币资金",
    "parent_id": null,
    "level": 1,
    "status": "active"
  }
}
```

### 1.3 创建科目

**请求**

```
POST /api/accounts
```

**请求体**

```json
{
  "id": "6602-01-001",
  "name": "直接材料",
  "type": "cost",
  "category": "生产成本",
  "parent_id": "6602-01",
  "level": 3,
  "auxiliary_types": [
    {
      "type": "inventory",
      "required": true
    }
  ]
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "6602-01-001",
    "name": "直接材料",
    "message": "科目创建成功"
  }
}
```

### 1.4 更新科目

**请求**

```
PUT /api/accounts/:id
```

**请求体**

```json
{
  "name": "直接材料成本",
  "auxiliary_types": [
    {
      "type": "inventory",
      "required": true
    },
    {
      "type": "project",
      "required": false
    }
  ]
}
```

### 1.5 删除科目

**请求**

```
DELETE /api/accounts/:id
```

**响应**

```json
{
  "success": true,
  "message": "科目删除成功"
}
```

**错误响应**

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_HAS_BALANCE",
    "message": "该科目有发生额，不可删除"
  }
}
```

### 1.6 切换科目状态

**请求**

```
PATCH /api/accounts/:id/status
```

**请求体**

```json
{
  "status": "inactive"
}
```

---

## 2. 凭证管理 API

### 2.1 获取凭证列表

**请求**

```
GET /api/vouchers?period=2024-01&status=approved
```

**查询参数**

- `period` (string, optional): 会计期间 (YYYY-MM)
- `status` (string, optional): 凭证状态 (draft/approved/posted)
- `voucher_type` (string, optional): 凭证类型

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2024-01-15",
      "voucher_no": "记-240115-001",
      "voucher_type": "sales",
      "notes": "销售订单 #1001",
      "status": "approved",
      "source_type": "order",
      "source_id": 1001,
      "created_by": "admin",
      "approved_by": "manager",
      "created_at": "2024-01-15T10:00:00.000Z",
      "approved_at": "2024-01-15T11:00:00.000Z",
      "lines": [
        {
          "id": 1,
          "line_no": 1,
          "account_id": "1122",
          "debit": 11300,
          "credit": 0,
          "auxiliary_data": {
            "customer_id": 1
          },
          "notes": "应收账款"
        },
        {
          "id": 2,
          "line_no": 2,
          "account_id": "6001",
          "debit": 0,
          "credit": 10000,
          "notes": "主营业务收入"
        },
        {
          "id": 3,
          "line_no": 3,
          "account_id": "2221",
          "debit": 0,
          "credit": 1300,
          "notes": "应交税费-销项税额"
        }
      ]
    }
  ]
}
```

### 2.2 获取单个凭证

**请求**

```
GET /api/vouchers/:id
```

### 2.3 创建凭证

**请求**

```
POST /api/vouchers
```

**请求体**

```json
{
  "date": "2024-01-15",
  "voucher_type": "manual",
  "notes": "手工凭证",
  "lines": [
    {
      "line_no": 1,
      "account_id": "1002",
      "debit": 10000,
      "credit": 0,
      "notes": "银行存款"
    },
    {
      "line_no": 2,
      "account_id": "1122",
      "debit": 0,
      "credit": 10000,
      "auxiliary_data": {
        "customer_id": 1
      },
      "notes": "应收账款"
    }
  ]
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "voucher_no": "记-240115-002",
    "message": "凭证创建成功"
  }
}
```

### 2.4 更新凭证

**请求**

```
PUT /api/vouchers/:id
```

**注意**: 已审核的凭证不可修改

### 2.5 删除凭证

**请求**

```
DELETE /api/vouchers/:id
```

### 2.6 审核凭证

**请求**

```
POST /api/vouchers/:id/approve
```

**响应**

```json
{
  "success": true,
  "message": "凭证审核成功"
}
```

### 2.7 批量生成凭证

**请求**

```
POST /api/vouchers/generate
```

**请求体**

```json
{
  "source_type": "order",
  "source_ids": [1001, 1002, 1003],
  "date": "2024-01-15"
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "generated": 3,
    "failed": 0,
    "vouchers": [
      {
        "source_id": 1001,
        "voucher_id": 123,
        "voucher_no": "记-240115-001"
      }
    ]
  }
}
```

---

## 3. 凭证模板 API

### 3.1 获取凭证模板列表

**请求**

```
GET /api/voucher-templates
```

### 3.2 创建凭证模板

**请求**

```
POST /api/voucher-templates
```

**请求体**

```json
{
  "name": "销售收款模板",
  "description": "客户付款时使用",
  "voucher_type": "receipt",
  "template_lines": [
    {
      "line_no": 1,
      "account_id": "1002",
      "debit_formula": "amount",
      "credit_formula": "0",
      "notes": "银行存款"
    },
    {
      "line_no": 2,
      "account_id": "1122",
      "debit_formula": "0",
      "credit_formula": "amount",
      "notes": "应收账款"
    }
  ]
}
```

---

## 4. 库存计价 API

### 4.1 获取库存计价配置

**请求**

```
GET /api/inventory/valuation-config
```

**响应**

```json
{
  "success": true,
  "data": {
    "method": "fifo",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "updated_by": "admin"
  }
}
```

### 4.2 更新库存计价配置

**请求**

```
PUT /api/inventory/valuation-config
```

**请求体**

```json
{
  "method": "weighted_average"
}
```

### 4.3 获取库存变动记录

**请求**

```
GET /api/inventory/:itemId/transactions?start_date=2024-01-01&end_date=2024-01-31
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "item_id": 101,
      "transaction_date": "2024-01-10",
      "transaction_type": "in",
      "quantity": 100,
      "unit_cost": 50,
      "total_cost": 5000,
      "balance_quantity": 100,
      "balance_cost": 5000,
      "reference_type": "purchase",
      "reference_id": 1001,
      "notes": "采购入库"
    }
  ]
}
```

### 4.4 库存成本调整

**请求**

```
POST /api/inventory/adjustment
```

**请求体**

```json
{
  "item_id": 101,
  "adjustment_date": "2024-01-31",
  "adjustment_type": "inventory_loss",
  "quantity": -5,
  "amount": -250,
  "notes": "盘亏"
}
```

### 4.5 获取存货明细账

**请求**

```
GET /api/inventory/:itemId/ledger?period=2024-01
```

---

## 5. 成本核算 API

### 5.1 获取产品成本设置

**请求**

```
GET /api/product-costs
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "product_id": 1,
      "costing_method": "standard",
      "standard_material_cost": 50,
      "standard_labor_cost": 20,
      "standard_overhead_cost": 10,
      "standard_total_cost": 80,
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 5.2 更新产品标准成本

**请求**

```
PUT /api/product-costs/:productId
```

**请求体**

```json
{
  "costing_method": "standard",
  "standard_material_cost": 55,
  "standard_labor_cost": 22,
  "standard_overhead_cost": 11
}
```

### 5.3 创建生产订单

**请求**

```
POST /api/production-orders
```

**请求体**

```json
{
  "order_no": "PO202401001",
  "product_id": 1,
  "quantity": 100,
  "start_date": "2024-01-10"
}
```

### 5.4 获取生产订单成本明细

**请求**

```
GET /api/production-orders/:id/costs
```

**响应**

```json
{
  "success": true,
  "data": {
    "order_no": "PO202401001",
    "product_id": 1,
    "quantity": 100,
    "actual_material_cost": 5500,
    "actual_labor_cost": 2100,
    "actual_overhead_cost": 1050,
    "actual_total_cost": 8650,
    "standard_total_cost": 8000,
    "variance": 650
  }
}
```

### 5.5 执行制造费用分配

**请求**

```
POST /api/cost-allocation/overhead
```

**请求体**

```json
{
  "period": "2024-01",
  "method": "labor_hours",
  "total_overhead": 10000
}
```

### 5.6 获取成本差异分析

**请求**

```
GET /api/cost-variance/:period
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "period": "2024-01",
      "product_id": 1,
      "material_price_variance": 500,
      "material_quantity_variance": 0,
      "labor_efficiency_variance": 100,
      "overhead_variance": 50,
      "total_variance": 650,
      "variance_rate": 8.125
    }
  ]
}
```

### 5.7 处理成本差异

**请求**

```
POST /api/cost-variance/:period/process
```

**请求体**

```json
{
  "method": "transfer_to_cogs"
}
```

---

## 6. 月末结账 API

### 6.1 获取结账期间列表

**请求**

```
GET /api/closing/periods
```

### 6.2 获取结账检查清单

**请求**

```
GET /api/closing/:period/checklist
```

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "checklist": [
      {
        "item": "unvouchered_transactions",
        "description": "所有业务单据已生成凭证",
        "status": "completed"
      },
      {
        "item": "voucher_balance",
        "description": "所有凭证借贷平衡",
        "status": "completed"
      },
      {
        "item": "bank_reconciliation",
        "description": "银行存款已完成对账",
        "status": "pending",
        "error_message": "尚有3笔银行流水未对账"
      }
    ]
  }
}
```

### 6.3 启动结账流程

**请求**

```
POST /api/closing/:period/start
```

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "status": "closed",
    "closed_at": "2024-02-01T10:00:00.000Z",
    "closed_by": "admin"
  }
}
```

### 6.4 反结账

**请求**

```
POST /api/closing/:period/reopen
```

### 6.5 获取结账报告

**请求**

```
GET /api/closing/:period/report
```

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "revenue": 100000,
    "cost": 60000,
    "expense": 20000,
    "net_profit": 20000,
    "key_metrics": {
      "gross_margin": 40,
      "net_margin": 20,
      "expense_ratio": 20
    },
    "warnings": [
      "应收账款周转天数较长，注意回款风险"
    ]
  }
}
```

---

## 7. 财务报表 API

### 7.1 获取资产负债表

**请求**

```
GET /api/reports/balance-sheet?period=2024-01&compare_period=2023-12
```

**查询参数**

- `period` (string, required): 报表期间 (YYYY-MM)
- `compare_period` (string, optional): 对比期间

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "assets": {
      "current_assets": {
        "cash": 100000,
        "receivables": 50000,
        "inventory": 80000,
        "other": 10000,
        "total": 240000
      },
      "non_current_assets": {
        "fixed_assets": 500000,
        "accumulated_depreciation": -100000,
        "net_fixed_assets": 400000,
        "other": 0,
        "total": 400000
      },
      "total_assets": 640000
    },
    "liabilities": {
      "current_liabilities": {
        "payables": 30000,
        "tax_payable": 5000,
        "other": 5000,
        "total": 40000
      },
      "non_current_liabilities": {
        "total": 0
      },
      "total_liabilities": 40000
    },
    "equity": {
      "capital": 500000,
      "retained_earnings": 80000,
      "current_profit": 20000,
      "total_equity": 600000
    }
  }
}
```

### 7.2 获取利润表

**请求**

```
GET /api/reports/income-statement?period=2024-01
```

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "revenue": {
      "operating_revenue": 100000,
      "other_revenue": 0,
      "total_revenue": 100000
    },
    "cost": {
      "operating_cost": 60000,
      "gross_profit": 40000
    },
    "expenses": {
      "selling_expense": 5000,
      "administrative_expense": 10000,
      "financial_expense": 1000,
      "total_expense": 16000
    },
    "profit": {
      "operating_profit": 24000,
      "non_operating_income": 0,
      "non_operating_expense": 0,
      "profit_before_tax": 24000,
      "income_tax": 6000,
      "net_profit": 18000
    }
  }
}
```

### 7.3 获取现金流量表

**请求**

```
GET /api/reports/cash-flow?period=2024-01&method=direct
```

**查询参数**

- `method` (string): 编制方法 (direct/indirect)

### 7.4 获取财务指标

**请求**

```
GET /api/reports/financial-ratios?period=2024-01
```

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "solvency": {
      "current_ratio": 6.0,
      "quick_ratio": 4.0,
      "debt_to_asset_ratio": 0.0625
    },
    "operational": {
      "receivables_turnover": 2.0,
      "inventory_turnover": 0.75,
      "total_asset_turnover": 0.156
    },
    "profitability": {
      "gross_margin": 40,
      "net_margin": 18,
      "roe": 3.0,
      "roa": 2.8
    }
  }
}
```

### 7.5 导出报表

**请求**

```
POST /api/reports/export
```

**请求体**

```json
{
  "report_type": "balance_sheet",
  "period": "2024-01",
  "format": "excel"
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "file_url": "/downloads/balance_sheet_2024-01.xlsx",
    "file_name": "资产负债表_2024-01.xlsx"
  }
}
```

---

## 8. 辅助核算 API

### 8.1 获取辅助核算明细账

**请求**

```
GET /api/subsidiary-ledger/:accountId?auxiliary_type=customer&auxiliary_id=1&period=2024-01
```

**响应**

```json
{
  "success": true,
  "data": {
    "account_id": "1122",
    "auxiliary_type": "customer",
    "auxiliary_id": 1,
    "auxiliary_name": "客户A",
    "period": "2024-01",
    "opening_balance": 10000,
    "transactions": [
      {
        "date": "2024-01-15",
        "voucher_no": "记-240115-001",
        "notes": "销售订单 #1001",
        "debit": 11300,
        "credit": 0,
        "balance": 21300
      },
      {
        "date": "2024-01-20",
        "voucher_no": "记-240120-001",
        "notes": "收款",
        "debit": 0,
        "credit": 10000,
        "balance": 11300
      }
    ],
    "closing_balance": 11300
  }
}
```

### 8.2 获取往来对账单

**请求**

```
GET /api/reconciliation/:type/:entityId?period=2024-01
```

**参数**

- `type` (string): customer/supplier
- `entityId` (number): 客户/供应商ID

---

## 9. 税务管理 API

### 9.1 获取税务配置

**请求**

```
GET /api/tax/config
```

### 9.2 更新税务配置

**请求**

```
PUT /api/tax/config
```

**请求体**

```json
{
  "vat_taxpayer_type": "general",
  "vat_rate": 13.0,
  "eit_rate": 25.0
}
```

### 9.3 获取增值税申报表

**请求**

```
GET /api/tax/vat-report?period=2024-01
```

**响应**

```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "output_vat": 13000,
    "input_vat": 7800,
    "vat_payable": 5200,
    "details": {
      "sales_amount": 100000,
      "purchase_amount": 60000,
      "input_vat_transfer_out": 0
    }
  }
}
```

### 9.4 获取企业所得税申报表

**请求**

```
GET /api/tax/eit-report?period=2024-Q1
```

### 9.5 获取税务风险提示

**请求**

```
GET /api/tax/risk-alerts
```

---

## 10. 固定资产 API

### 10.1 获取固定资产列表

**请求**

```
GET /api/fixed-assets?status=in_use
```

### 10.2 新增固定资产

**请求**

```
POST /api/fixed-assets
```

**请求体**

```json
{
  "asset_no": "FA202401001",
  "name": "氧化生产线",
  "category": "机器设备",
  "acquisition_date": "2024-01-10",
  "original_cost": 500000,
  "salvage_value": 25000,
  "useful_life": 120,
  "depreciation_method": "straight_line",
  "department_id": 1
}
```

### 10.3 更新固定资产

**请求**

```
PUT /api/fixed-assets/:id
```

### 10.4 计提折旧

**请求**

```
POST /api/fixed-assets/:id/depreciate
```

**请求体**

```json
{
  "period": "2024-01"
}
```

### 10.5 处置固定资产

**请求**

```
POST /api/fixed-assets/:id/dispose
```

**请求体**

```json
{
  "disposal_date": "2024-01-31",
  "disposal_amount": 100000,
  "disposal_expense": 5000
}
```

### 10.6 获取折旧计划表

**请求**

```
GET /api/fixed-assets/:id/schedule
```

---

## 11. 数据校验 API

### 11.1 验证凭证

**请求**

```
POST /api/validation/voucher
```

**请求体**

```json
{
  "date": "2024-01-15",
  "lines": [
    {
      "account_id": "1002",
      "debit": 10000,
      "credit": 0
    },
    {
      "account_id": "1122",
      "debit": 0,
      "credit": 10000
    }
  ]
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

### 11.2 验证科目

**请求**

```
POST /api/validation/account
```

### 11.3 执行一致性检查

**请求**

```
GET /api/validation/consistency-check
```

**响应**

```json
{
  "success": true,
  "data": {
    "check_date": "2024-01-31T10:00:00.000Z",
    "checks": [
      {
        "name": "总账与明细账一致性",
        "status": "passed"
      },
      {
        "name": "账表与单据一致性",
        "status": "passed"
      },
      {
        "name": "凭证与业务单据关联完整性",
        "status": "failed",
        "details": "发现3笔订单未生成凭证"
      }
    ]
  }
}
```

---

## 错误代码

| 错误代码 | 描述 |
|---------|------|
| `ACCOUNT_NOT_FOUND` | 科目不存在 |
| `ACCOUNT_HAS_BALANCE` | 科目有发生额，不可删除 |
| `ACCOUNT_CODE_DUPLICATE` | 科目编码重复 |
| `ACCOUNT_CODE_INVALID` | 科目编码格式不正确 |
| `VOUCHER_NOT_FOUND` | 凭证不存在 |
| `VOUCHER_NOT_BALANCED` | 凭证借贷不平衡 |
| `VOUCHER_APPROVED` | 凭证已审核，不可修改 |
| `PERIOD_CLOSED` | 会计期间已结账，不可修改 |
| `PERIOD_NOT_CLOSED` | 会计期间未结账 |
| `CLOSING_CHECK_FAILED` | 结账前置条件检查失败 |
| `INVALID_AMOUNT` | 金额格式不正确 |
| `INVALID_DATE` | 日期格式不正确 |
| `MISSING_AUXILIARY_DATA` | 缺少辅助核算信息 |
| `INVENTORY_NEGATIVE` | 库存数量为负数 |
| `PRODUCTION_ORDER_NOT_FOUND` | 生产订单不存在 |
| `FIXED_ASSET_NOT_FOUND` | 固定资产不存在 |

---

**文档版本**：v7.0  
**最后更新**：2024年

*小会计 v7.0 | API 文档*
