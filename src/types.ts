export interface Customer {
  id: number;
  name: string;
  credit_limit: number;
  pinyin?: string;
}

export interface Supplier {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  spec?: string;
  unit: string;
  default_price: number;
  pinyin?: string;
}

export interface Order {
  id: number;
  date: string;
  customer: string;
  product: string;
  spec?: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  outsource: string;
  notes: string;
  invoiced: number; // 0 or 1
  tax_rate: number;
  status: string; // e.g., "待产", "氧化中", "待检", "已完工", "已送货"
  worker: string; // 生产员/计件员
  reconciled: number; // 0: 未核对, 1: 已核对
}

export interface Income {
  id: number;
  date: string;
  customer: string;
  amount: number;
  bank: string;
  notes: string;
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  supplier: string;
  amount: number;
  method: string;
  notes: string;
}

export interface SupplierBill {
  id: number;
  date: string;
  supplier: string;
  category: string;
  amount: number;
  notes: string;
}

export interface Stats {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  totalReceivable: number;
  totalPayable: number;
  orderCount: number;
  outsourceCount: number;
  inventoryAlerts: number;
  aging: {
    "0-30天": number;
    "31-60天": number;
    "61-90天": number;
    "90天+": number;
  };
  mom: {
    income: number;
    expense: number;
    order: number;
    profit: number;
  };
}

export interface BankBalance {
  bank: string;
  balance: number;
}

export interface Overdue {
  customer: string;
  debt: number;
}

export interface FixedAsset {
  id: number;
  asset_no: string;         // 资产编号
  name: string;
  category: string;         // 资产类别
  acquisition_date: string;
  cost: number;
  salvage_value: number;
  useful_life: number;      // 使用年限（月）
  depreciation_method: 'straight_line' | 'double_declining' | 'sum_of_years' | 'units_of_production';
  accumulated_depreciation: number; // 累计折旧
  net_book_value: number;   // 账面净值
  department_id?: number;
  status: '在用' | '停用' | '报废';
  created_at?: string;
  updated_at?: string;
}

export interface BalanceSheet {
  assets: {
    cash: number;
    receivable: number;
    inventory: number;
    fixedAssets: number;
    total: number;
  };
  liabilities: {
    payable: number;
    total: number;
  };
  equity: {
    total: number;
  };
}

export interface TopProduct {
  product: string;
  total: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  stock: number;
  unit: string;
  low_threshold: number;
  unit_cost: number;
}

export interface InventoryTransaction {
  id: number;
  item_name: string;
  timestamp: string;
  type: "入库" | "出库" | "盘点" | "领料";
  delta: number;
  notes: string;
}

export interface MaterialRequisition {
  id: number;
  date: string;
  item_name: string;
  qty: number;
  worker: string;
  notes: string;
}

// ============================================================================
// v7.0 新增类型定义 - 专业会计准则合规版
// ============================================================================

// 辅助核算类型
export interface AuxiliaryType {
  type: 'customer' | 'supplier' | 'department' | 'project' | 'inventory';
  required: boolean;
}

// 会计科目
export interface Account {
  id: string;              // 科目编码，如 "6602-01-001"
  name: string;            // 科目名称
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense';
  category: string;        // 科目类别
  parent_id: string | null; // 父科目编码
  level: number;           // 科目级次 (1-3)
  status: 'active' | 'inactive'; // 启用状态
  auxiliary_types?: AuxiliaryType[]; // 辅助核算类型
  created_at?: string;
  updated_at?: string;
}

// 辅助核算数据
export interface AuxiliaryData {
  customer_id?: number;
  supplier_id?: number;
  department_id?: number;
  project_id?: number;
  inventory_id?: number;
}

// 凭证分录
export interface VoucherLine {
  id?: number;
  voucher_id?: number;
  line_no: number;         // 行号
  account_id: string;      // 科目编码
  debit: number;           // 借方金额
  credit: number;          // 贷方金额
  auxiliary_data?: AuxiliaryData; // 辅助核算数据
  notes?: string;
}

// 记账凭证
export interface Voucher {
  id?: number;
  date: string;
  voucher_no: string;      // 凭证号，如 "记-240101-001"
  voucher_type: 'manual' | 'sales' | 'purchase' | 'receipt' | 'payment' | 'closing';
  notes: string;
  status: 'draft' | 'approved' | 'posted'; // 草稿/已审核/已过账
  source_type?: 'order' | 'income' | 'expense' | 'supplier_bill'; // 源单据类型
  source_id?: number;      // 源单据ID
  created_by?: string;
  approved_by?: string;
  created_at?: string;
  approved_at?: string;
  lines: VoucherLine[];
}

// 凭证模板
export interface VoucherTemplate {
  id?: number;
  name: string;
  description: string;
  voucher_type: string;
  template_lines: TemplateLineConfig[];
  created_at?: string;
}

export interface TemplateLineConfig {
  account_id: string;
  debit_formula?: string;  // 如 "amount", "amount * 0.13"
  credit_formula?: string;
  notes?: string;
}

// 产品成本
export interface ProductCost {
  product_id: number;
  costing_method: 'standard' | 'actual'; // 成本核算方法
  standard_material_cost?: number;
  standard_labor_cost?: number;
  standard_overhead_cost?: number;
  standard_total_cost?: number;
  updated_at?: string;
}

// 生产订单
export interface ProductionOrder {
  id?: number;
  order_no: string;
  product_id: number;
  quantity: number;
  start_date: string;
  completion_date?: string;
  status: 'in_progress' | 'completed' | 'closed';
  actual_material_cost: number;
  actual_labor_cost: number;
  actual_overhead_cost: number;
  actual_total_cost: number;
  created_at?: string;
}

// 成本差异
export interface CostVariance {
  id?: number;
  period: string;              // 会计期间 YYYY-MM
  product_id: number;
  material_price_variance: number;
  material_quantity_variance: number;
  labor_efficiency_variance: number;
  overhead_variance: number;
  total_variance: number;
  variance_rate: number;       // 差异率
  processed?: boolean;
  created_at?: string;
}

// 制造费用分配
export interface OverheadAllocation {
  id?: number;
  period: string;
  method: 'labor_hours' | 'machine_hours' | 'labor_cost' | 'output_quantity';
  total_overhead: number;
  allocations: {
    production_order_id: number;
    allocation_base: number;   // 分配基数
    allocated_amount: number;
  }[];
  created_at?: string;
}

// 结账期间
export interface ClosingPeriod {
  period: string;              // YYYY-MM
  status: 'open' | 'closing' | 'closed';
  closed_at?: string;
  closed_by?: string;
  checklist?: ClosingCheckItem[];
  report?: ClosingReport;
}

export interface ClosingCheckItem {
  item: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
}

export interface ClosingReport {
  period: string;
  revenue: number;
  cost: number;
  expense: number;
  net_profit: number;
  key_metrics: {
    gross_margin: number;
    net_margin: number;
    expense_ratio: number;
  };
  warnings: string[];
}

// 库存计价配置
export interface InventoryValuationConfig {
  id: number;
  method: 'fifo' | 'weighted_average' | 'moving_average' | 'specific_identification';
  updated_at?: string;
  updated_by?: string;
}

// 库存事务
export interface InventoryTransactionV7 {
  id?: number;
  item_id: number;
  transaction_date: string;
  transaction_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  unit_cost: number;
  total_cost: number;
  balance_quantity: number;
  balance_cost: number;
  reference_type?: string;
  reference_id?: number;
  notes?: string;
  created_at?: string;
}

// 税务配置
export interface TaxConfig {
  id: number;
  vat_taxpayer_type: 'general' | 'small_scale';
  vat_rate: number;
  eit_rate: number;
  updated_at?: string;
}

// 增值税申报表
export interface VATReport {
  period: string;
  output_vat: number;
  input_vat: number;
  vat_payable: number;
  details: {
    sales_amount: number;
    purchase_amount: number;
    input_vat_transfer_out: number;
  };
}

// 企业所得税申报表
export interface EITReport {
  period: string;
  revenue: number;
  cost: number;
  expense: number;
  taxable_income: number;
  eit_payable: number;
  prepaid_eit: number;
}

// 固定资产折旧计划
export interface DepreciationSchedule {
  id?: number;
  asset_id: number;
  period: string;
  opening_book_value: number;
  depreciation_amount: number;
  accumulated_depreciation: number;
  closing_book_value: number;
  voucher_id?: number;
  created_at?: string;
}

// 固定资产处置
export interface AssetDisposal {
  id?: number;
  asset_id: number;
  disposal_date: string;
  disposal_amount: number;
  disposal_expense: number;
  gain_loss: number;
  voucher_id?: number;
  notes?: string;
  created_at?: string;
}

// 财务报表 - 资产负债表
export interface BalanceSheetV7 {
  period: string;
  contains_unapproved_data?: boolean; // 属性32: 包含未审核凭证时标注
  assets: {
    current_assets: {
      cash: number;
      receivables: number;
      inventory: number;
      other: number;
      total: number;
    };
    non_current_assets: {
      fixed_assets: number;
      accumulated_depreciation: number;
      net_fixed_assets: number;
      other: number;
      total: number;
    };
    total_assets: number;
  };
  liabilities: {
    current_liabilities: {
      payables: number;
      tax_payable: number;
      other: number;
      total: number;
    };
    non_current_liabilities: {
      total: number;
    };
    total_liabilities: number;
  };
  equity: {
    capital: number;
    retained_earnings: number;
    current_profit: number;
    total_equity: number;
  };
}

// 利润表
export interface IncomeStatement {
  period: string;
  contains_unapproved_data?: boolean; // 属性32: 包含未审核凭证时标注
  revenue: {
    operating_revenue: number;
    other_revenue: number;
    total_revenue: number;
  };
  cost: {
    operating_cost: number;
    gross_profit: number;
  };
  expenses: {
    selling_expense: number;
    administrative_expense: number;
    financial_expense: number;
    total_expense: number;
  };
  profit: {
    operating_profit: number;
    non_operating_income: number;
    non_operating_expense: number;
    profit_before_tax: number;
    income_tax: number;
    net_profit: number;
  };
}

// 现金流量表
export interface CashFlowStatement {
  period: string;
  contains_unapproved_data?: boolean; // 属性32: 包含未审核凭证时标注
  operating_activities: {
    cash_inflows: number;
    cash_outflows: number;
    net_cash_flow: number;
  };
  investing_activities: {
    cash_inflows: number;
    cash_outflows: number;
    net_cash_flow: number;
  };
  financing_activities: {
    cash_inflows: number;
    cash_outflows: number;
    net_cash_flow: number;
  };
  net_increase_in_cash: number;
  beginning_cash_balance: number;
  ending_cash_balance: number;
}

// 财务指标
export interface FinancialRatios {
  period: string;
  solvency: {
    current_ratio: number;
    quick_ratio: number;
    debt_to_asset_ratio: number;
  };
  operational: {
    receivables_turnover: number;
    inventory_turnover: number;
    total_asset_turnover: number;
  };
  profitability: {
    gross_margin: number;
    net_margin: number;
    roe: number;
    roa: number;
  };
}

// 辅助核算明细账
export interface SubsidiaryLedger {
  account_id: string;
  auxiliary_type: 'customer' | 'supplier' | 'department' | 'project' | 'inventory';
  auxiliary_id: number;
  auxiliary_name: string;
  period: string;
  opening_balance: number;
  transactions: {
    date: string;
    voucher_no: string;
    notes: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  closing_balance: number;
}

// 往来对账单
export interface ReconciliationStatement {
  type: 'customer' | 'supplier';
  entity_id: number;
  entity_name: string;
  period: string;
  opening_balance: number;
  transactions: {
    date: string;
    type: string;
    reference_no: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  closing_balance: number;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// 数据一致性检查结果
export interface ConsistencyCheckResult {
  check_date: string;
  checks: ConsistencyCheck[];
}

export interface ConsistencyCheck {
  name: string;
  status: 'passed' | 'failed';
  details?: string;
}

// 错误响应
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
  };
}
