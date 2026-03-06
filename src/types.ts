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
  name: string;
  acquisition_date: string;
  cost: number;
  depreciation_method: string;
  useful_life: number;
  salvage_value: number;
  status: string;
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
