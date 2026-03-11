import React, { useState, useEffect, useMemo } from "react";
import { Order, Income, Expense, Customer, Supplier, SupplierBill, Stats } from "@/types";
import { formatCurrency, cn, toChineseNumeral } from "@/lib/utils";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { 
  Search, 
  Download, 
  FileText, 
  PieChart as PieChartIcon,
  List,
  HandCoins,
  Trash2,
  Printer,
  X,
  Truck,
  History,
  Clock,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileDown,
  Settings2,
  Eye,
  EyeOff,
  Check,
  CheckSquare,
  Square,
  MessageSquare,
  UserCheck,
  Wallet,
  ShieldCheck,
  FileJson,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { useToast } from "./Toast";
import { Skeleton, TableSkeleton } from "./Skeleton";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function Reports() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderPagination, setOrderPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [supplierBills, setSupplierBills] = useState<SupplierBill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [payableAging, setPayableAging] = useState<any[]>([]);
  const [receivableAging, setReceivableAging] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [inventoryValuation, setInventoryValuation] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [financialStatements, setFinancialStatements] = useState<any>(null);
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  const [subsidiaryLedger, setSubsidiaryLedger] = useState<any>(null);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [entityType, setEntityType] = useState<'customer' | 'supplier'>('customer');
  const [multiColLedger, setMultiColLedger] = useState<{ columns: any[], data: any[] } | null>(null);
  const [selectedParentAccount, setSelectedParentAccount] = useState("6602"); // Default to Management Expenses
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [taxReport, setTaxReport] = useState<any>(null);
  const [profitDistributions, setProfitDistributions] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("summary");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [printingStatement, setPrintingStatement] = useState<{ customer: string, type: 'customer' | 'supplier' } | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<{ id: number, invoice_no: string, invoice_date: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [minAmount, setMinAmount] = useState<number | "">("");
  const [maxAmount, setMaxAmount] = useState<number | "">("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedOutsource, setSelectedOutsource] = useState("");
  const [invoicedFilter, setInvoicedFilter] = useState<"all" | "yes" | "no">("all");

  // Custom Columns
  const [showSettings, setShowSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    customer: true,
    product: true,
    qty: true,
    price: true,
    total: true,
    outsource: true,
    notes: true,
    fixture_loss: false,
    invoiced: true,
    tax_rate: false,
    status: true,
    worker: true
  });

  const [wages, setWages] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/multi-column-ledger/${selectedParentAccount}?startDate=${startDate}&endDate=${endDate}`)
      .then(res => res.json())
      .then(setMultiColLedger);
  }, [selectedParentAccount, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOrders(1),
        fetch("/api/incomes").then(res => res.json()).then(setIncomes),
        fetch("/api/expenses").then(res => res.json()).then(setExpenses),
        fetch("/api/supplier-bills").then(res => res.json()).then(setSupplierBills),
        fetch("/api/customers").then(res => res.json()).then(setCustomers),
        fetch("/api/suppliers").then(res => res.json()).then(setSuppliers),
        fetch("/api/audit-logs").then(res => res.json()).then(setAuditLogs),
        fetch("/api/stats").then(res => res.json()).then(setStats),
        fetch("/api/expense-breakdown").then(res => res.json()).then(setExpenseBreakdown),
        fetch("/api/accounts").then(res => res.json()).then(setAccounts),
        fetch("/api/payable-aging").then(res => res.json()).then(setPayableAging),
        fetch("/api/receivable-aging").then(res => res.json()).then(setReceivableAging),
        fetch("/api/inventory-valuation").then(res => res.json()).then(data => setInventoryValuation(data.totalValue)),
        fetch("/api/yearly-summary").then(res => res.json()).then(setYearlyData),
        fetch("/api/financial-statements").then(res => res.json()).then(setFinancialStatements),
        fetch("/api/trial-balance").then(res => res.json()).then(setTrialBalance),
        fetch(`/api/tax-report?startDate=${startDate}&endDate=${endDate}`).then(res => res.json()).then(setTaxReport),
        fetch("/api/profit-distributions").then(res => res.json()).then(setProfitDistributions),
        fetch(`/api/cash-flow?startDate=${startDate}&endDate=${endDate}`).then(res => res.json()).then(setCashFlowData),
        fetchWages()
      ]);
    } catch (e) {
      showToast("加载数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchWages = async () => {
    try {
      const res = await fetch(`/api/wage-report?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setWages(data);
    } catch (e) {
      console.error("Fetch wages error", e);
    }
  };

  const fetchOrders = (page: number) => {
    fetch(`/api/orders?page=${page}&limit=50`).then(res => res.json()).then(data => {
      setOrders(data.orders);
      setOrderPagination(data.pagination);
    });
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    showToast("Excel 导出成功", "success");
  };

  const exportToPDF = (title: string, headers: string[][], body: any[][], fileName: string) => {
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    (doc as any).autoTable({
      head: headers,
      body: body,
      startY: 20,
      styles: { font: "helvetica", fontSize: 8 },
    });
    doc.save(`${fileName}.pdf`);
    showToast("PDF 导出成功", "success");
  };

  useEffect(() => {
    if (selectedEntity) {
      fetch(`/api/subsidiary-ledger/${entityType}/${selectedEntity}?startDate=${startDate}&endDate=${endDate}`)
        .then(res => res.json())
        .then(setSubsidiaryLedger);
    }
  }, [selectedEntity, entityType, startDate, endDate]);

  const handleExportDetails = () => {
    const data = [
      ...filteredOrders.map(o => ({ 日期: o.date, 类型: "订单", 客户_供应商: o.customer, 内容: `${o.product} (${o.qty}${o.unit})`, 金额: o.total })),
      ...filteredIncomes.map(i => ({ 日期: i.date, 类型: "收款", 客户_供应商: i.customer, 内容: i.bank, 金额: i.amount })),
      ...filteredExpenses.map(e => ({ 日期: e.date, 类型: "支出", 客户_供应商: e.supplier, 内容: e.category, 金额: -e.amount })),
      ...filteredSupplierBills.map(b => ({ 日期: b.date, 类型: "应付", 客户_供应商: b.supplier, 内容: b.category, 金额: b.amount }))
    ];
    exportToExcel(data, `明细报表_${startDate}_${endDate}`);
  };

  const handleExportFullFinancialReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 40px; color: #1e293b; background: white; }
        .page-break { page-break-after: always; margin-top: 40px; }
        .report-header { text-align: center; margin-bottom: 50px; border-bottom: 2px solid #334155; padding-bottom: 20px; }
        h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: 2px; }
        .meta { font-size: 14px; color: #64748b; font-weight: 500; }
        .section-container { margin-bottom: 40px; border-radius: 12px; border: 1px solid #e2e8f0; padding: 30px; }
        .section-title { font-size: 20px; font-weight: 800; margin-bottom: 25px; color: #1e293b; display: flex; align-items: center; }
        .section-title::before { content: ""; display: inline-block; width: 6px; height: 24px; background: #6366f1; margin-right: 12px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { border: 1px solid #e2e8f0; padding: 14px 18px; text-align: left; }
        th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 11px; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 800; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .sub-row { color: #64748b; font-size: 13px; }
        .total-row { background: #f1f5f9; font-weight: 800; font-size: 16px; border-top: 2px solid #0f172a; }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          .section-container { border: none; padding: 0; }
        }
      </style>
    `;

    const content = `
      <html>
        <head>
          <title>氧化加工厂_标准财务报告_${startDate}_${endDate}</title>
          ${styles}
        </head>
        <body>
          <div class="report-header">
            <h1>标准财务年度报告</h1>
            <div class="meta">编制单位: 氧化加工厂 | 期间: ${startDate} 至 ${endDate} | 币种: 人民币 (CNY)</div>
          </div>
          
          <div class="section-container">
            <div class="section-title">一、利润表 (Income Statement)</div>
            <div id="pl-content"></div>
          </div>
          
          <div class="page-break"></div>
          
          <div class="section-container">
            <div class="section-title">二、资产负债简表 (Balance Sheet)</div>
            <div id="bs-content"></div>
          </div>
          
          <div class="page-break"></div>
          
          <div class="section-container">
            <div class="section-title">三、现金流量表 (Cash Flow Statement)</div>
            <div id="cf-content"></div>
          </div>

          <div class="report-footer" style="margin-top: 50px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
            报告生成时间: ${new Date().toLocaleString()} | 系统支持: 小会计 v5.6 Pro
          </div>
          
          <script>
            // Simple helper to inject content without React's extra attributes
            function inject(id, html) {
              const el = document.getElementById(id);
              if (el) el.innerHTML = html;
            }
            
            window.onload = () => {
              // Extract logic for standard financial report formatting
              setTimeout(() => window.print(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    // Note: We'll manually build the HTML tables for each section here to ensure clean formatting
    
    // 1. PL Table
    const plData = `
      <table>
        <thead><tr><th>项目</th><th class="text-right">金额 (元)</th></tr></thead>
        <tbody>
          <tr><td class="font-bold">一、营业总收入</td><td class="text-right font-bold font-mono">${formatCurrency(totalSales)}</td></tr>
          <tr class="sub-row"><td>减：营业成本</td><td class="text-right font-mono negative">${formatCurrency(filteredExpenses.filter(e => e.account_id?.startsWith('5401')).reduce((acc, cur) => acc + cur.amount, 0))}</td></tr>
          <tr class="total-row"><td>二、营业利润 (毛利)</td><td class="text-right font-mono positive">${formatCurrency(totalSales - filteredExpenses.filter(e => e.account_id?.startsWith('5401')).reduce((acc, cur) => acc + cur.amount, 0))}</td></tr>
          <tr class="sub-row"><td>减：期间费用 (销售+管理)</td><td class="text-right font-mono negative">${formatCurrency(filteredExpenses.filter(e => e.account_id?.startsWith('6601') || e.account_id?.startsWith('6602')).reduce((acc, cur) => acc + cur.amount, 0))}</td></tr>
          <tr class="total-row"><td>三、本期营业净利润</td><td class="text-right font-mono positive">${formatCurrency(totalSales - totalExpense)}</td></tr>
        </tbody>
      </table>
    `;
    printWindow.document.getElementById('pl-content')!.innerHTML = plData;

    // 2. Balance Sheet Table
    if (balanceSheet) {
      const bsData = `
        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 40px;">
          <div>
            <table>
              <thead><tr><th>资产项目</th><th class="text-right">金额 (元)</th></tr></thead>
              <tbody>
                <tr><td>货币资金</td><td class="text-right font-mono">${formatCurrency(balanceSheet.assets.cash)}</td></tr>
                <tr><td>应收账款</td><td class="text-right font-mono">${formatCurrency(balanceSheet.assets.receivable)}</td></tr>
                <tr><td>存货</td><td class="text-right font-mono">${formatCurrency(balanceSheet.assets.inventory)}</td></tr>
                <tr><td>固定资产净值</td><td class="text-right font-mono">${formatCurrency(balanceSheet.assets.fixedAssets)}</td></tr>
                <tr class="total-row"><td>资产总计</td><td class="text-right font-mono">${formatCurrency(balanceSheet.assets.total)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <table>
              <thead><tr><th>负债及权益项目</th><th class="text-right">金额 (元)</th></tr></thead>
              <tbody>
                <tr><td>应付账款</td><td class="text-right font-mono">${formatCurrency(balanceSheet.liabilities.payable)}</td></tr>
                <tr class="total-row"><td>负债合计</td><td class="text-right font-mono">${formatCurrency(balanceSheet.liabilities.total)}</td></tr>
                <tr><td>留存收益 (估算)</td><td class="text-right font-mono">${formatCurrency(balanceSheet.equity.total)}</td></tr>
                <tr class="total-row"><td>负债及权益合计</td><td class="text-right font-mono">${formatCurrency(balanceSheet.liabilities.total + balanceSheet.equity.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      printWindow.document.getElementById('bs-content')!.innerHTML = bsData;
    }

    // 3. Cash Flow Table
    if (cashFlowData) {
      const cfData = `
        <table>
          <thead><tr><th>项目</th><th class="text-right">本期发生额 (元)</th></tr></thead>
          <tbody>
            <tr><td class="font-bold">一、经营活动现金流量</td><td class="text-right"></td></tr>
            <tr class="sub-row"><td>    销售商品提供劳务收到的现金</td><td class="text-right font-mono positive">${formatCurrency(cashFlowData.operating.in)}</td></tr>
            <tr class="sub-row"><td>    购买商品接受劳务支付的现金</td><td class="text-right font-mono negative">(${formatCurrency(cashFlowData.operating.out)})</td></tr>
            <tr class="total-row"><td>    经营活动产生的现金流量净额</td><td class="text-right font-mono">${formatCurrency(cashFlowData.operating.net)}</td></tr>
            <tr><td class="font-bold">二、投资活动现金流量</td><td class="text-right"></td></tr>
            <tr class="sub-row"><td>    购建固定资产支付的现金</td><td class="text-right font-mono negative">(${formatCurrency(cashFlowData.investing.out)})</td></tr>
            <tr class="total-row"><td>    投资活动产生的现金流量净额</td><td class="text-right font-mono">${formatCurrency(cashFlowData.investing.net)}</td></tr>
            <tr class="total-row" style="background: #e2e8f0;"><td>三、现金及等价物净增加额</td><td class="text-right font-mono font-black">${formatCurrency(cashFlowData.net)}</td></tr>
          </tbody>
        </table>
      `;
      printWindow.document.getElementById('cf-content')!.innerHTML = cfData;
    }

    printWindow.document.close();
  };

  const renderPLStatement = () => {
    if (!financialStatements) return <Skeleton className="h-96 w-full rounded-2xl" />;
    const { profitLoss } = financialStatements;

    return (
      <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-4xl mx-auto transition-colors duration-300">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold dark:text-slate-100 uppercase tracking-tight">利润表 (Income Statement)</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-mono italic text-sm">注：基于会计科目余额生成</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-base font-bold dark:text-slate-200">一、营业收入 (Revenue)</span>
            <span className="text-base font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(profitLoss.revenue)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="pl-4 text-sm text-slate-500 dark:text-slate-400">减：营业成本 (Cost of Sales)</span>
            <span className="text-sm font-mono text-rose-500">{formatCurrency(profitLoss.cost)}</span>
          </div>
          <div className="flex justify-between items-center py-3 font-bold border-b-2 border-slate-900 dark:border-slate-700">
            <span className="text-base dark:text-slate-200">二、营业利润 (Gross Profit)</span>
            <span className="text-base font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(profitLoss.grossProfit)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="pl-4 text-sm text-slate-500 dark:text-slate-400">减：期间费用 (Operating Expenses)</span>
            <span className="text-sm font-mono text-rose-500">{formatCurrency(profitLoss.expenses)}</span>
          </div>
          <div className="flex justify-between items-center py-4 font-black text-lg border-t-2 border-slate-900 dark:border-slate-700 mt-4 bg-slate-50 dark:bg-slate-800/30 px-4 rounded-lg">
            <span className="dark:text-slate-100">三、本期净利润 (Net Profit)</span>
            <span className={cn(
              "font-mono",
              profitLoss.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>{formatCurrency(profitLoss.netProfit)}</span>
          </div>
        </div>

        {/* DuPont Analysis (基于专业核算) */}
        {financialStatements.balanceSheet && (
          <div className="mt-12 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-8 flex items-center text-slate-800 dark:text-slate-100">
              <TrendingUp size={20} className="mr-2 text-emerald-600" />
              杜邦财务分析
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">销售净利率</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {profitLoss.revenue > 0 ? ((profitLoss.netProfit / profitLoss.revenue) * 100).toFixed(2) : "0"}%
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">资产周转率</div>
                <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {financialStatements.balanceSheet.assets.total > 0 ? (profitLoss.revenue / financialStatements.balanceSheet.assets.total).toFixed(2) : "0"}
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                <div className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">权益乘数</div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {financialStatements.balanceSheet.equity.total > 0 ? (financialStatements.balanceSheet.assets.total / financialStatements.balanceSheet.equity.total).toFixed(2) : "1"}
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-center">
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                ROE (净资产收益率) = {financialStatements.balanceSheet.equity.total > 0 ? ((profitLoss.netProfit / financialStatements.balanceSheet.equity.total) * 100).toFixed(2) : "0"}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCashFlowStatement = () => {
    if (!cashFlowData) return <Skeleton className="h-96 w-full rounded-2xl" />;
    return (
      <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-4xl mx-auto transition-colors duration-300">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold dark:text-slate-100 uppercase tracking-tight">现金流量表 (Cash Flow Statement)</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-mono">日期: {startDate} 至 {endDate} | 编制方法: 凭证直接法</p>
        </div>

        <div className="space-y-8">
          {/* Operating */}
          <section className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b-2 border-slate-900 dark:border-slate-700">
              <h3 className="text-base font-black">一、经营活动产生的现金流量：</h3>
              <span className={cn("text-base font-mono font-black", cashFlowData.operating.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {formatCurrency(cashFlowData.operating.net)}
              </span>
            </div>
            <div className="pl-8 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">经营活动现金流入 (销售商品、提供劳务)</span>
                <span className="font-mono text-emerald-600">+{formatCurrency(cashFlowData.operating.in)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">经营活动现金流出 (采购、费用、工资、税费)</span>
                <span className="font-mono text-rose-500">-{formatCurrency(cashFlowData.operating.out)}</span>
              </div>
            </div>
          </section>

          {/* Investing */}
          <section className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b-2 border-slate-900 dark:border-slate-700">
              <h3 className="text-base font-black">二、投资活动产生的现金流量：</h3>
              <span className={cn("text-base font-mono font-black", cashFlowData.investing.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {formatCurrency(cashFlowData.investing.net)}
              </span>
            </div>
            <div className="pl-8 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">购建固定资产支付的现金</span>
                <span className="font-mono text-rose-500">-{formatCurrency(cashFlowData.investing.out)}</span>
              </div>
            </div>
          </section>

          {/* Financing */}
          <section className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b-2 border-slate-900 dark:border-slate-700">
              <h3 className="text-base font-black">三、筹资活动产生的现金流量：</h3>
              <span className={cn("text-base font-mono font-black", cashFlowData.financing.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {formatCurrency(cashFlowData.financing.net)}
              </span>
            </div>
            <div className="pl-8 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">吸收投资收到的现金</span>
                <span className="font-mono text-emerald-600">+{formatCurrency(cashFlowData.financing.in)}</span>
              </div>
            </div>
          </section>

          {/* Net Increase */}
          <section className="mt-12 pt-8 border-t-4 border-slate-900 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl">
            <span className="text-xl font-black uppercase tracking-widest">现金及现金等价物净增加额</span>
            <span className={cn("text-2xl font-black font-mono", cashFlowData.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatCurrency(cashFlowData.net)}
            </span>
          </section>
        </div>
      </div>
    );
  };

  const renderSubsidiaryLedger = () => {
    const entities = entityType === 'customer' 
      ? Array.from(new Set(orders.map(o => o.customer)))
      : Array.from(new Set(supplierBills.map(b => b.supplier)));

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center space-x-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => { setEntityType('customer'); setSelectedEntity(""); }}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", entityType === 'customer' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500")}
            >客户明细账</button>
            <button 
              onClick={() => { setEntityType('supplier'); setSelectedEntity(""); }}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", entityType === 'supplier' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500")}
            >供应商明细账</button>
          </div>
          <select 
            value={selectedEntity} 
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- 请选择往来单位 --</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {subsidiaryLedger && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black dark:text-slate-100">{selectedEntity} - 往来明细账</h3>
                <p className="text-xs text-slate-400 mt-1">统计周期: {startDate} 至 {endDate}</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">当前余额</div>
                  <div className="text-xl font-black text-indigo-600 font-mono">
                    {formatCurrency(subsidiaryLedger.data.length > 0 ? subsidiaryLedger.data[subsidiaryLedger.data.length-1].balance : subsidiaryLedger.openingBalance)}
                  </div>
                </div>
                <button onClick={() => exportToExcel(subsidiaryLedger.data, `${selectedEntity}_明细账`)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors">
                  <Download size={18} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">日期</th>
                    <th className="px-6 py-4">类型</th>
                    <th className="px-6 py-4">摘要</th>
                    <th className="px-6 py-4 text-right">借方 (增加应收/减少应付)</th>
                    <th className="px-6 py-4 text-right">贷方 (减少应收/增加应付)</th>
                    <th className="px-6 py-4 text-right">余额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  <tr className="bg-slate-50/30 dark:bg-slate-800/30 italic">
                    <td className="px-6 py-3 font-mono text-slate-400">{startDate}</td>
                    <td className="px-6 py-3" colSpan={4}>期初余额</td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-500">{formatCurrency(subsidiaryLedger.openingBalance)}</td>
                  </tr>
                  {subsidiaryLedger.data.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-500">{t.date}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          t.type === '销售' || t.type === '付款' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                        )}>{t.type}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{t.notes}</td>
                      <td className="px-6 py-4 text-right font-mono text-indigo-600">{t.debit > 0 ? formatCurrency(t.debit) : "-"}</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600">{t.credit > 0 ? formatCurrency(t.credit) : "-"}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold dark:text-slate-100">{formatCurrency(t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHealthCockpit = () => {
    if (!balanceSheet) return <Skeleton className="h-96 w-full rounded-2xl" />;
    
    const currentAssets = balanceSheet.assets.cash + balanceSheet.assets.receivable + balanceSheet.assets.inventory;
    const currentLiabilities = balanceSheet.liabilities.payable;
    const totalAssets = balanceSheet.assets.total;
    const totalLiabilities = balanceSheet.liabilities.total;
    
    const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : "∞";
    const debtRatio = totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : "0";
    const roe = balanceSheet.equity.total > 0 ? (((totalIncome - totalExpense) / balanceSheet.equity.total) * 100).toFixed(1) : "0";
    
    const healthMetrics = [
      { 
        name: "流动比率 (Current Ratio)", 
        value: currentRatio, 
        desc: "衡量短期偿债能力，通常 > 2 为佳", 
        status: Number(currentRatio) >= 2 ? "Good" : Number(currentRatio) >= 1 ? "Warning" : "Danger" 
      },
      { 
        name: "资产负债率 (Debt Ratio)", 
        value: `${debtRatio}%`, 
        desc: "衡量长期财务风险，通常 40%-60% 为宜", 
        status: Number(debtRatio) <= 60 ? "Good" : Number(debtRatio) <= 80 ? "Warning" : "Danger" 
      },
      { 
        name: "净资产收益率 (ROE)", 
        value: `${roe}%`, 
        desc: "衡量股东权益投资报酬率", 
        status: Number(roe) >= 15 ? "Good" : Number(roe) >= 5 ? "Warning" : "Danger" 
      },
      { 
        name: "销售净利率", 
        value: totalIncome > 0 ? `${(((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)}%` : "0%", 
        desc: "每百元销售收入带来的净利润", 
        status: (totalIncome - totalExpense) / totalIncome >= 0.1 ? "Good" : "Warning" 
      }
    ];

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {healthMetrics.map((m, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{m.name}</h4>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  m.status === "Good" ? "bg-emerald-100 text-emerald-700" :
                  m.status === "Warning" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                )}>
                  {m.status}
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-2 font-mono">{m.value}</div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-6 flex items-center text-slate-800 dark:text-slate-100">
              <ShieldCheck size={20} className="mr-2 text-indigo-600" />
              财务稳健度雷达
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                  { subject: '偿债能力', A: Math.min(100, Number(currentRatio) * 40), fullMark: 100 },
                  { subject: '盈利能力', A: Math.min(100, Number(roe) * 4), fullMark: 100 },
                  { subject: '营运效率', A: 85, fullMark: 100 },
                  { subject: '资本结构', A: Math.max(0, 100 - Number(debtRatio)), fullMark: 100 },
                  { subject: '现金流', A: 75, fullMark: 100 },
                ]}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Radar name="工厂指标" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-6 flex items-center text-slate-800 dark:text-slate-100">
              <Activity size={20} className="mr-2 text-rose-600" />
              风险预警建议
            </h3>
            <div className="space-y-4">
              {Number(currentRatio) < 1.2 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-800 flex items-start">
                  <AlertTriangle className="text-rose-600 mr-3 mt-0.5" size={18} />
                  <div>
                    <div className="text-sm font-bold text-rose-900 dark:text-rose-300">短期偿债风险高</div>
                    <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">流动比率低于安全线，建议加快回款或减少短期负债，确保资金链安全。</p>
                  </div>
                </div>
              )}
              {Number(debtRatio) > 70 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 flex items-start">
                  <AlertTriangle className="text-amber-600 mr-3 mt-0.5" size={18} />
                  <div>
                    <div className="text-sm font-bold text-amber-900 dark:text-amber-300">资本结构待优化</div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">资产负债率偏高，财务杠杆较大，建议谨慎增加新借款。</p>
                  </div>
                </div>
              )}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-start">
                <CheckCircle2 className="text-indigo-600 mr-3 mt-0.5" size={18} />
                <div>
                  <div className="text-sm font-bold text-indigo-900 dark:text-indigo-300">AI 经营建议</div>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">当前盈利水平稳健，建议加大对高毛利产品的排产比例，进一步提升 ROE。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!financialStatements) return <Skeleton className="h-96 w-full rounded-2xl" />;
    const { balanceSheet } = financialStatements;

    return (
      <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-5xl mx-auto transition-colors duration-300">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold dark:text-slate-100 uppercase tracking-tight">资产负债表 (Balance Sheet)</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-mono">日期: {new Date().toLocaleDateString()} | 币种: 人民币 (CNY)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Assets Column */}
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b-2 border-slate-900 dark:border-slate-700 pb-2">
              <h3 className="text-lg font-black">资产 (Assets)</h3>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">期末余额</div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center group">
                <span className="text-sm font-bold">流动资产：</span>
              </div>
              <div className="pl-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>货币资金 (现金/银行)</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.assets.cash)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>应收账款</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.assets.receivable)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>存货</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.assets.inventory)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center group pt-2">
                <span className="text-sm font-bold">非流动资产：</span>
              </div>
              <div className="pl-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>固定资产净值</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.assets.fixedAssets)}</span>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-base font-black">资产总计 (Total Assets)</span>
                <span className="text-lg font-black text-indigo-600 font-mono">{formatCurrency(balanceSheet.assets.total)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities and Equity Column */}
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b-2 border-slate-900 dark:border-slate-700 pb-2">
                <h3 className="text-lg font-black">负债 (Liabilities)</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center group">
                  <span className="text-sm font-bold">流动负债：</span>
                </div>
                <div className="pl-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>应付账款</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.liabilities.payable)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>应交税费</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.liabilities.taxPayable)}</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-base font-black">负债合计 (Total Liabilities)</span>
                  <span className="text-lg font-black text-rose-600 font-mono">{formatCurrency(balanceSheet.liabilities.total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end border-b-2 border-slate-900 dark:border-slate-700 pb-2">
                <h3 className="text-lg font-black">所有者权益 (Equity)</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>实收资本</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.equity.capital)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>留存收益 (估算)</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.equity.retainedEarnings)}</span>
                </div>
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-base font-black">权益合计 (Total Equity)</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">{formatCurrency(balanceSheet.equity.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t-2 border-slate-900 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/20 px-6 rounded-xl">
          <span className="text-xl font-black uppercase italic tracking-tighter">Liabilities & Equity Total</span>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatCurrency(balanceSheet.liabilities.total + balanceSheet.equity.total)}
          </span>
        </div>
        
        {Math.abs(balanceSheet.assets.total - (balanceSheet.liabilities.total + balanceSheet.equity.total)) > 1 && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-bold text-center rounded-lg border border-rose-100 dark:border-rose-900/30">
            警告：资产负债表不平衡！差额: {formatCurrency(balanceSheet.assets.total - (balanceSheet.liabilities.total + balanceSheet.equity.total))}
          </div>
        )}
      </div>
    );
  };

  const renderMultiColumnLedger = () => {
    if (!multiColLedger) return <Skeleton className="h-96 w-full rounded-2xl" />;
    
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold dark:text-slate-100 flex items-center">
              <List size={24} className="mr-2 text-indigo-600" />
              多栏明细账 (Multi-Column Ledger)
            </h2>
            <p className="text-slate-500 text-sm mt-1">适用于费用类科目的横向明细分析</p>
          </div>
          <div className="flex items-center space-x-4">
            <select 
              value={selectedParentAccount}
              onChange={e => setSelectedParentAccount(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold"
            >
              <option value="6602">6602 - 管理费用</option>
              <option value="6601">6601 - 销售费用</option>
              <option value="5401">5401 - 主营业务成本</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse border border-slate-200 dark:border-slate-800">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                <th className="border border-slate-200 dark:border-slate-800 px-4 py-3 min-w-[100px]">日期</th>
                <th className="border border-slate-200 dark:border-slate-800 px-4 py-3 min-w-[150px]">摘要</th>
                {multiColLedger.columns.map(col => (
                  <th key={col.id} className="border border-slate-200 dark:border-slate-800 px-4 py-3 text-right min-w-[100px]">
                    {col.name}
                  </th>
                ))}
                <th className="border border-slate-200 dark:border-slate-800 px-4 py-3 text-right min-w-[120px] bg-slate-100 dark:bg-slate-700">合计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {multiColLedger.data.map((row, idx) => {
                const rowTotal = Object.values(row.columns).reduce((acc: any, cur: any) => acc + cur, 0);
                return (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="border border-slate-200 dark:border-slate-800 px-4 py-3 font-mono">{row.date}</td>
                    <td className="border border-slate-200 dark:border-slate-800 px-4 py-3 italic text-slate-400">{row.notes}</td>
                    {multiColLedger.columns.map(col => (
                      <td key={col.id} className="border border-slate-200 dark:border-slate-800 px-4 py-3 text-right font-mono text-indigo-600">
                        {row.columns[col.id] ? formatCurrency(row.columns[col.id] as number) : "-"}
                      </td>
                    ))}
                    <td className="border border-slate-200 dark:border-slate-800 px-4 py-3 text-right font-mono font-black bg-slate-50/50 dark:bg-slate-800/20">
                      {formatCurrency(rowTotal as number)}
                    </td>
                  </tr>
                );
              })}
              {multiColLedger.data.length === 0 && (
                <tr>
                  <td colSpan={multiColLedger.columns.length + 3} className="px-6 py-12 text-center text-slate-400 italic">
                    该时段内暂无明细记录
                  </td>
                </tr>
              )}
            </tbody>
            {multiColLedger.data.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-black">
                <tr>
                  <td colSpan={2} className="border border-slate-200 dark:border-slate-800 px-4 py-3 uppercase tracking-widest text-[10px]">本期合计 (Subtotal)</td>
                  {multiColLedger.columns.map(col => {
                    const colTotal = multiColLedger.data.reduce((acc, row) => acc + (row.columns[col.id] || 0), 0);
                    return (
                      <td key={col.id} className="border border-slate-200 dark:border-slate-800 px-4 py-3 text-right font-mono text-indigo-700 dark:text-indigo-400">
                        {formatCurrency(colTotal)}
                      </td>
                    );
                  })}
                  <td className="border border-slate-200 dark:border-slate-800 px-4 py-3 text-right font-mono text-indigo-800 dark:text-indigo-300 bg-slate-100 dark:bg-slate-700">
                    {formatCurrency(multiColLedger.data.reduce((acc, row) => acc + Object.values(row.columns).reduce((rAcc: any, rCur: any) => rAcc + rCur, 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  const renderTrialBalance = () => {
    const totalDebit = trialBalance.reduce((acc, cur) => acc + cur.debit, 0);
    const totalCredit = trialBalance.reduce((acc, cur) => acc + cur.credit, 0);

    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold dark:text-slate-100">试算平衡表 (Trial Balance)</h2>
          <p className="text-slate-500 text-sm mt-1">确保会计借贷双方金额相等</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                <th className="px-6 py-4">科目编码</th>
                <th className="px-6 py-4">科目名称</th>
                <th className="px-6 py-4 text-right">借方余额 (Debit)</th>
                <th className="px-6 py-4 text-right">贷方余额 (Credit)</th>
                <th className="px-6 py-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {trialBalance.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 font-mono">{acc.id}</td>
                  <td className="px-6 py-4 font-bold">{acc.name}</td>
                  <td className="px-6 py-4 text-right font-mono text-indigo-600">{formatCurrency(acc.debit)}</td>
                  <td className="px-6 py-4 text-right font-mono text-rose-600">{formatCurrency(acc.credit)}</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => {
                        setSelectedLedgerAccount(acc.id);
                        fetch(`/api/general-ledger/${acc.id}`).then(res => res.json()).then(setLedgerData);
                      }}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      查看总账
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-800 font-black">
                <td colSpan={2} className="px-6 py-4">合计 (Total)</td>
                <td className="px-6 py-4 text-right font-mono text-indigo-600">{formatCurrency(totalDebit)}</td>
                <td className="px-6 py-4 text-right font-mono text-rose-600">{formatCurrency(totalCredit)}</td>
                <td className="px-6 py-4 text-center">
                  {Math.abs(totalDebit - totalCredit) < 0.01 ? 
                    <span className="text-emerald-600 text-[10px] uppercase tracking-widest">Balanced ✅</span> : 
                    <span className="text-rose-600 text-[10px] uppercase tracking-widest italic animate-pulse underline">Unbalanced ❌</span>
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {selectedLedgerAccount && (
          <div className="mt-12 pt-8 border-t-2 border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center">
                <List size={20} className="mr-2 text-indigo-600" />
                科目明细总账: {selectedLedgerAccount} - {trialBalance.find(a => a.id === selectedLedgerAccount)?.name}
              </h3>
              <button onClick={() => setSelectedLedgerAccount(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                    <th className="px-4 py-3">日期</th>
                    <th className="px-4 py-3">往来单位</th>
                    <th className="px-4 py-3">摘要</th>
                    <th className="px-4 py-3 text-right">借方</th>
                    <th className="px-4 py-3 text-right">贷方</th>
                    <th className="px-4 py-3 text-right">余额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ledgerData.map((entry, idx) => {
                    // Simple balance calculation for the view
                    const balance = ledgerData.slice(0, idx + 1).reduce((acc, cur) => acc + (cur.debit - cur.credit), 0);
                    return (
                      <tr key={idx} className="hover:bg-white dark:hover:bg-slate-800">
                        <td className="px-4 py-3 font-mono">{entry.date}</td>
                        <td className="px-4 py-3">{entry.entity}</td>
                        <td className="px-4 py-3 italic text-slate-400">{entry.notes}</td>
                        <td className="px-4 py-3 text-right font-mono text-indigo-600">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(balance)}</td>
                      </tr>
                    );
                  })}
                  {ledgerData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">暂无明细记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleExportCustomerStatement = () => {
    if (!selectedCustomer) return;
    const data = [
      ...customerOrders.map(o => ({ 日期: o.date, 类型: "订单", 产品: o.product, 数量: o.qty, 单位: o.unit, 单价: o.price, 金额: o.total })),
      ...customerIncomes.map(i => ({ 日期: i.date, 类型: "收款", 方式: i.bank, 金额: -i.amount }))
    ];
    exportToExcel(data, `${selectedCustomer}_对账单_${new Date().toLocaleDateString()}`);
  };

  const handleExportSupplierStatement = () => {
    if (!selectedSupplier) return;
    const sBills = supplierBills.filter(b => b.supplier === selectedSupplier);
    const sExpenses = expenses.filter(e => e.supplier === selectedSupplier);
    const data = [
      ...sBills.map(b => ({ 日期: b.date, 类型: "应付账单", 分类: b.category, 金额: b.amount })),
      ...sExpenses.map(e => ({ 日期: e.date, 类型: "付款记录", 方式: e.method, 金额: -e.amount }))
    ];
    exportToExcel(data, `${selectedSupplier}_供应商对账单_${new Date().toLocaleDateString()}`);
  };

  useEffect(fetchData, []);

  const handleDelete = async (type: "orders" | "incomes" | "expenses" | "supplier-bills", id: number) => {
    if (!window.confirm("确定要删除这条记录吗？删除后不可恢复。")) return;
    const res = await fetch(`/api/${type}/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("删除成功", "success");
      fetchData();
    } else {
      showToast("删除失败", "error");
    }
  };

  const filteredOrders = useMemo(() => orders.filter(o => {
    const term = debouncedSearchTerm.toLowerCase();
    const matchesSearch = o.customer.toLowerCase().includes(term) || 
                         o.product.toLowerCase().includes(term) ||
                         o.notes.toLowerCase().includes(term);
    const matchesDate = o.date >= startDate && o.date <= endDate;
    const matchesAmount = (minAmount === "" || o.total >= minAmount) && (maxAmount === "" || o.total <= maxAmount);
    const matchesProduct = selectedProduct === "" || o.product === selectedProduct;
    const matchesOutsource = selectedOutsource === "" || o.outsource === selectedOutsource;
    const matchesInvoiced = invoicedFilter === "all" || (invoicedFilter === "yes" ? o.invoiced === 1 : o.invoiced === 0);
    
    return matchesSearch && matchesDate && matchesAmount && matchesProduct && matchesOutsource && matchesInvoiced;
  }), [orders, debouncedSearchTerm, startDate, endDate, minAmount, maxAmount, selectedProduct, selectedOutsource, invoicedFilter]);

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const handleToggleInvoiced = async (id: number, currentStatus: number) => {
    try {
      const res = await fetch(`/api/orders/${id}/invoiced`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiced: currentStatus ? 0 : 1 })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, invoiced: currentStatus ? 0 : 1 } : o));
        showToast("开票状态已更新", "success");
      }
    } catch (e) {
      showToast("更新失败", "error");
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        showToast("生产状态已更新", "success");
      }
    } catch (e) {
      showToast("更新失败", "error");
    }
  };

  const handleUpdateReconciled = async (id: number, reconciled: number) => {
    try {
      const res = await fetch(`/api/orders/${id}/reconciled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconciled })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, reconciled } : o));
        showToast("核对状态已更新", "success");
      }
    } catch (e) {
      showToast("更新失败", "error");
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;
    try {
      const res = await fetch(`/api/orders/${editingInvoice.id}/invoice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          invoice_no: editingInvoice.invoice_no, 
          invoice_date: editingInvoice.invoice_date 
        })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === editingInvoice.id ? { ...o, ...editingInvoice } : o));
        showToast("发票信息已保存", "success");
        setEditingInvoice(null);
      }
    } catch (err) {
      showToast("保存失败", "error");
    }
  };

  const handleBatchInvoiced = async (val: number) => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await fetch("/api/orders/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedOrderIds, updates: { invoiced: val } })
      });
      if (res.ok) {
        showToast(`已批量标记为${val ? "已开票" : "未开票"}`, "success");
        fetchOrders(orderPagination.page);
        setSelectedOrderIds([]);
      }
    } catch (e) {
      showToast("批量操作失败", "error");
    }
  };

  const handleBatchStatus = async (status: string) => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await fetch("/api/orders/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedOrderIds, updates: { status } })
      });
      if (res.ok) {
        showToast(`已批量更新状态为: ${status}`, "success");
        fetchOrders(orderPagination.page);
        setSelectedOrderIds([]);
      }
    } catch (e) {
      showToast("批量操作失败", "error");
    }
  };

  const copyToWeChat = (o: Order) => {
    const text = `【送货通知】\n客户：${o.customer}\n日期：${o.date}\n产品：${o.product}\n数量：${o.qty} ${o.unit}\n金额：${formatCurrency(o.total)}\n备注：${o.notes || '无'}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast("已复制微信分享文案", "success");
    });
  };
  const handleBatchDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!window.confirm(`确定要批量删除这 ${selectedOrderIds.length} 条记录吗？`)) return;
    try {
      await Promise.all(selectedOrderIds.map(id => 
        fetch(`/api/orders/${id}`, { method: "DELETE" })
      ));
      fetchData();
      setSelectedOrderIds([]);
      showToast(`批量删除 ${selectedOrderIds.length} 条记录成功`, "success");
    } catch (e) {
      showToast("批量删除失败", "error");
    }
  };

  const handleGenerateVouchers = async (type: 'orders' | 'incomes' | 'expenses' | 'supplier_bills', ids: number[]) => {
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate-business-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ids })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`成功生成 ${data.count} 张会计凭证`, "success");
        fetchData();
      } else {
        showToast(data.error || "生成凭证失败", "error");
      }
    } catch (e) {
      showToast("网络请求失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const exportBatchStatements = () => {
    const wb = XLSX.utils.book_new();
    
    // Get all unique customers in the current filtered orders
    const customersInPeriod = Array.from(new Set(orders.map(o => o.customer)));
    
    customersInPeriod.forEach(custName => {
      const custOrders = orders.filter(o => o.customer === custName);
      const custIncomes = incomes.filter(i => i.customer === custName);
      
      const data = [];
      // Header
      data.push(["日期", "产品/项目", "规格", "数量", "单位", "单价", "应收金额", "实收金额", "备注"]);
      
      custOrders.forEach(o => {
        data.push([o.date, o.product, o.spec || "", o.qty, o.unit, o.price, o.total, 0, o.notes]);
      });
      
      custIncomes.forEach(i => {
        data.push([i.date, "收款 (" + i.bank + ")", "", "", "", "", 0, i.amount, i.notes]);
      });
      
      // Totals
      const totalOrder = custOrders.reduce((acc, cur) => acc + cur.total, 0);
      const totalIncome = custIncomes.reduce((acc, cur) => acc + cur.amount, 0);
      data.push([]);
      data.push(["", "合计", "", "", "", "", totalOrder, totalIncome, ""]);
      data.push(["", "应收余额", "", "", "", "", totalOrder - totalIncome, "", ""]);
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, (custName as string).substring(0, 30)); // Sheet name limit 31 chars
    });
    
    XLSX.writeFile(wb, `批量对账单_${startDate}_至_${endDate}.xlsx`);
    showToast("批量对账单导出成功", "success");
  };

  const renderOrderTable = () => {
    if (loading) return <TableSkeleton rows={10} cols={6} />;
    
    return (
      <div className="space-y-4">
        {selectedOrderIds.length > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center text-sm text-indigo-700 dark:text-indigo-300 font-medium">
              <CheckSquare className="mr-2" size={18} />
              已选择 {selectedOrderIds.length} 项
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleBatchInvoiced(1)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors"
              >
                批量标记已开票
              </button>
              <button 
                onClick={() => handleBatchInvoiced(0)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                批量标记未开票
              </button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              <select 
                onChange={(e) => handleBatchStatus(e.target.value)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors outline-none cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>批量更新状态</option>
                <option value="待产">待产</option>
                <option value="氧化中">氧化中</option>
                <option value="已完工">已完工</option>
                <option value="已送货">已送货</option>
              </select>
              <button 
                onClick={handleBatchDelete}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
              >
                批量删除
              </button>
              <button 
                onClick={() => setSelectedOrderIds([])}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto max-h-[600px] border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 shadow-sm z-10">
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                    {selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                  </button>
                </th>
                {visibleColumns.date && <th className="px-6 py-4 font-medium">日期</th>}
              {visibleColumns.customer && <th className="px-6 py-4 font-medium">客户</th>}
              {visibleColumns.product && <th className="px-6 py-4 font-medium">产品</th>}
              {visibleColumns.qty && <th className="px-6 py-4 font-medium text-right">数量</th>}
              {visibleColumns.price && <th className="px-6 py-4 font-medium text-right">单价</th>}
              {visibleColumns.total && <th className="px-6 py-4 font-medium text-right">合计</th>}
              {visibleColumns.tax_rate && <th className="px-6 py-4 font-medium text-right">税率</th>}
              {visibleColumns.status && <th className="px-6 py-4 font-medium text-center">状态</th>}
              {visibleColumns.worker && <th className="px-6 py-4 font-medium">生产员</th>}
              {visibleColumns.invoiced && <th className="px-6 py-4 font-medium text-center">开票</th>}
              {visibleColumns.outsource && <th className="px-6 py-4 font-medium">委外</th>}
              {visibleColumns.fixture_loss && <th className="px-6 py-4 font-medium text-right">挂具损耗</th>}
              {visibleColumns.notes && <th className="px-6 py-4 font-medium">备注</th>}
              <th className="px-6 py-4 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredOrders.map((o) => (
              <tr key={o.id} className={cn(
                "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group",
                selectedOrderIds.includes(o.id) && "bg-indigo-50/50 dark:bg-indigo-900/10"
              )}>
                <td className="px-4 py-4">
                  <button onClick={() => toggleSelectOrder(o.id)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                    {selectedOrderIds.includes(o.id) ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                  </button>
                </td>
                {visibleColumns.date && <td className="px-6 py-4 text-sm font-mono dark:text-slate-400">{o.date}</td>}
                {visibleColumns.customer && <td className="px-6 py-4 text-sm font-medium dark:text-slate-200">{o.customer}</td>}
                {visibleColumns.product && <td className="px-6 py-4 text-sm dark:text-slate-300">{o.product}</td>}
                {visibleColumns.qty && <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-400">{o.qty} {o.unit}</td>}
                {visibleColumns.price && <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-400">{formatCurrency(o.price)}</td>}
                {visibleColumns.total && <td className="px-6 py-4 text-sm text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(o.total)}</td>}
                {visibleColumns.tax_rate && <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-400">{o.tax_rate}%</td>}
                {visibleColumns.status && (
                  <td className="px-6 py-4 text-center">
                    <select 
                      value={o.status || '待产'}
                      onChange={e => handleUpdateStatus(o.id, e.target.value)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-colors bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none",
                        o.status === '已送货' ? "text-emerald-600 dark:text-emerald-400 border-emerald-200" :
                        o.status === '已完工' ? "text-indigo-600 dark:text-indigo-400 border-indigo-200" :
                        "text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <option value="待产">待产</option>
                      <option value="氧化中">氧化中</option>
                      <option value="待检">待检</option>
                      <option value="已完工">已完工</option>
                      <option value="已送货">已送货</option>
                    </select>
                  </td>
                )}
                {visibleColumns.worker && <td className="px-6 py-4 text-sm dark:text-slate-400">{o.worker || "-"}</td>}
                {visibleColumns.invoiced && (
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleToggleInvoiced(o.id, o.invoiced)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                        o.invoiced 
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                      )}
                    >
                      {o.invoiced ? "已开票" : "未开票"}
                    </button>
                  </td>
                )}
                {visibleColumns.outsource && <td className="px-6 py-4 text-sm dark:text-slate-400">
                  {o.outsource ? <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold border border-amber-100 dark:border-amber-900/30">{o.outsource}</span> : "-"}
                </td>}
                {visibleColumns.fixture_loss && <td className="px-6 py-4 text-sm text-right font-mono text-rose-500">{formatCurrency(o.fixture_loss)}</td>}
                {visibleColumns.notes && <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 italic truncate max-w-[150px]">{o.notes || "-"}</td>}
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setPrintingOrder(o)} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="打印送货单">
                      <Printer size={16} />
                    </button>
                    <button onClick={() => copyToWeChat(o)} className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="复制微信分享">
                      <MessageSquare size={16} />
                    </button>
                    <button onClick={() => handleDelete("orders", o.id)} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors" title="删除">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    );
  };
  const filteredIncomes = useMemo(() => incomes.filter(i => 
    i.date >= startDate && i.date <= endDate && 
    (i.customer.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || i.notes.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
  ), [incomes, startDate, endDate, debouncedSearchTerm]);

  const filteredExpenses = useMemo(() => expenses.filter(e => 
    e.date >= startDate && e.date <= endDate && 
    (e.supplier.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || e.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || e.notes.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
  ), [expenses, startDate, endDate, debouncedSearchTerm]);

  const filteredSupplierBills = useMemo(() => supplierBills.filter(b => 
    b.date >= startDate && b.date <= endDate && 
    (b.supplier.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || b.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || b.notes.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
  ), [supplierBills, startDate, endDate, debouncedSearchTerm]);

  const totalIncome = filteredIncomes.reduce((acc, cur) => acc + cur.amount, 0);
  const totalExpense = filteredExpenses.reduce((acc, cur) => acc + cur.amount, 0);
  const totalSales = filteredOrders.reduce((acc, cur) => acc + cur.total, 0);

  // MoM Analysis
  const prevMonthStart = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() - 1, 1).toISOString().split('T')[0];
  const prevMonthEnd = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), 0).toISOString().split('T')[0];

  const prevOrders = orders.filter(o => o.date >= prevMonthStart && o.date <= prevMonthEnd);
  const prevIncomes = incomes.filter(i => i.date >= prevMonthStart && i.date <= prevMonthEnd);
  const prevExpenses = expenses.filter(e => e.date >= prevMonthStart && e.date <= prevMonthEnd);

  const prevTotalSales = prevOrders.reduce((acc, cur) => acc + cur.total, 0);
  const prevTotalIncome = prevIncomes.reduce((acc, cur) => acc + cur.amount, 0);
  const prevTotalExpense = prevExpenses.reduce((acc, cur) => acc + cur.amount, 0);
  const prevProfit = prevTotalSales - prevTotalExpense;

  const salesMoM = prevTotalSales ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const expenseMoM = prevTotalExpense ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : 0;
  const profitMoM = prevProfit ? (((totalSales - totalExpense) - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

  // Pareto Analysis (Customer Revenue)
  const customerRevenue = filteredOrders.reduce((acc: any, cur) => {
    acc[cur.customer] = (acc[cur.customer] || 0) + cur.total;
    return acc;
  }, {});

  const paretoData = Object.keys(customerRevenue)
    .map(name => ({ name, value: customerRevenue[name] }))
    .sort((a, b) => b.value - a.value);

  const totalRevenueForPareto = paretoData.reduce((acc, cur) => acc + cur.value, 0);
  let cumulativeValue = 0;
  const paretoChartData = paretoData.map(d => {
    cumulativeValue += d.value;
    return {
      ...d,
      percentage: totalRevenueForPareto ? (cumulativeValue / totalRevenueForPareto) * 100 : 0
    };
  });

  const expenseByCategory = filteredExpenses.reduce((acc: any, cur) => {
    acc[cur.category] = (acc[cur.category] || 0) + cur.amount;
    return acc;
  }, {});

  const pieData = Object.keys(expenseByCategory).map(name => ({
    name,
    value: expenseByCategory[name]
  }));

  const customerOrders = orders.filter(o => o.customer === selectedCustomer);
  const customerIncomes = incomes.filter(i => i.customer === selectedCustomer);
  const customerDebt = customerOrders.reduce((acc, cur) => acc + cur.total, 0) - customerIncomes.reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-6 transition-colors duration-300">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">开始日期</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">结束日期</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">全局搜索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索客户、产品、备注..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            />
          </div>
        </div>
        <button 
          onClick={exportBatchStatements}
          className="flex items-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-100 dark:border-emerald-800"
        >
          <FileDown size={16} className="mr-2" />
          批量导出对账单
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl w-fit transition-colors duration-300">
        {[
          { id: "summary", label: "月度汇总", icon: PieChartIcon },
          { id: "details", label: "明细报表", icon: List },
          { id: "invoices", label: "开票管理", icon: CheckSquare },
          { id: "statement", label: "客户对账单", icon: FileText },
          { id: "supplier-statement", label: "供应商对账", icon: Truck },
          { id: "yearly", label: "年度分析", icon: TrendingUp },
          { id: "pl", label: "损益表", icon: FileText },
          { id: "balance-sheet", label: "资产负债表", icon: History },
          { id: "trial-balance", label: "试算平衡表", icon: CheckSquare },
          { id: "multi-column", label: "多栏明细账", icon: List },
          { id: "subsidiary-ledger", label: "往来明细账", icon: UserCheck },
          { id: "cash-flow", label: "现金流量表", icon: Wallet },
          { id: "tax", label: "税务管理", icon: FileText },
          { id: "profit-dist", label: "利润分配", icon: HandCoins },
          { id: "health", label: "财务健康看板", icon: Activity },
          { id: "aging", label: "账龄分析", icon: Clock },
          { id: "profit", label: "利润分析", icon: TrendingUp },
          { id: "expense-analysis", label: "支出分析", icon: PieChartIcon },
          { id: "wages", label: "计件工资", icon: HandCoins },
          { id: "audit", label: "操作日志", icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <tab.icon size={16} className="mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Professional Ledger Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="text-xl font-black flex items-center dark:text-slate-100">
                  <ShieldCheck className="mr-3 text-emerald-500" size={24} />
                  财务审计与凭证合规状态
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {stats?.unvouchered?.total === 0 
                    ? "🎉 所有业务单据均已生成会计凭证，账实相符。" 
                    : `⚠️ 尚有 ${stats?.unvouchered?.total} 笔业务单据未同步到会计账簿（未生成凭证）。`}
                </p>
              </div>
              {stats?.unvouchered?.total > 0 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    onClick={async () => {
                      const confirm = window.confirm("确定要为所有待处理单据生成凭证吗？");
                      if (!confirm) return;
                      // Sequence posting
                      if (stats.unvouchered.orders > 0) await handleGenerateVouchers('orders', orders.filter(o => !o.voucher_id).map(o => o.id));
                      if (stats.unvouchered.incomes > 0) await handleGenerateVouchers('incomes', incomes.filter(i => !i.voucher_id).map(i => i.id));
                      if (stats.unvouchered.expenses > 0) await handleGenerateVouchers('expenses', expenses.filter(e => !e.voucher_id).map(e => e.id));
                      if (stats.unvouchered.bills > 0) await handleGenerateVouchers('supplier_bills', supplierBills.filter(b => !b.voucher_id).map(b => b.id));
                    }}
                  >
                    <FileJson className="mr-2" size={14} />
                    一键全量过账
                  </Button>
                </div>
              )}
            </div>
            <div className="bg-indigo-600 p-8 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none text-white flex flex-col justify-center">
              <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">ROE (专业核算)</div>
              <div className="text-3xl font-black font-mono">
                {financialStatements?.profitLoss?.netProfit && financialStatements?.balanceSheet?.equity?.total > 0 
                  ? ((financialStatements.profitLoss.netProfit / financialStatements.balanceSheet.equity.total) * 100).toFixed(2) 
                  : "0.00"}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">区间收入</div>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500 font-mono">{formatCurrency(totalIncome)}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">区间支出</div>
                <div className="text-3xl font-bold text-rose-600 dark:text-rose-500 font-mono">{formatCurrency(totalExpense)}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">区间利润</div>
                <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(totalIncome - totalExpense)}</div>
              </div>
              
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 transition-colors duration-300">
                <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center">
                  <ShieldCheck size={18} className="mr-2 text-emerald-500" />
                  待审计单据明细
                </h4>
                <div className="space-y-4">
                  {[
                    { label: '待入账送货单', count: stats?.unvouchered?.orders, icon: <Truck size={14} />, color: 'text-indigo-500', type: 'orders', list: orders },
                    { label: '待入账收款单', count: stats?.unvouchered?.incomes, icon: <ArrowDownLeft size={14} />, color: 'text-emerald-500', type: 'incomes', list: incomes },
                    { label: '待入账费用单', count: stats?.unvouchered?.expenses, icon: <ArrowUpRight size={14} />, color: 'text-rose-500', type: 'expenses', list: expenses },
                    { label: '待入账应付账单', count: stats?.unvouchered?.bills, icon: <FileText size={14} />, color: 'text-amber-500', type: 'supplier_bills', list: supplierBills }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className={cn("p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm", item.color)}>
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold dark:text-slate-200">{item.label}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.count || 0} 笔待处理</div>
                        </div>
                      </div>
                      {item.count > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleGenerateVouchers(item.type as any, item.list.filter((x: any) => !x.voucher_id).map((x: any) => x.id))}
                        >
                          过账
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleExportFullFinancialReport}
                className="w-full flex items-center justify-center py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200 dark:shadow-none font-bold"
              >
                <Download size={18} className="mr-2" />
                导出标准财务报告 (PDF)
              </button>
            </div>
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <h3 className="text-lg font-semibold mb-8 dark:text-slate-100 flex items-center justify-between">
                  <span>客户产值贡献分析 (Pareto 80/20)</span>
                  <span className="text-[10px] text-slate-400 font-normal">累计百分比反映核心客户群</span>
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paretoChartData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `¥${val/1000}k`} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#10b981' }} tickFormatter={(val) => `${val}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: any, name: string) => name === 'percentage' ? [`${value.toFixed(1)}%`, '累计占比'] : [formatCurrency(value as number), '产值']}
                      />
                      <Bar yAxisId="left" dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                      <Line yAxisId="right" type="monotone" dataKey="percentage" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <h3 className="text-lg font-semibold mb-8 dark:text-slate-100">支出分类分布</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜索客户、产品或备注..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                />
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
                    showFilters 
                      ? "bg-indigo-600 text-white border-indigo-600" 
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Filter size={16} className="mr-2" />
                  高级筛选
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings2 size={18} />
                </button>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                <button onClick={handleExportDetails} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 dark:shadow-none">
                  <Download size={16} className="mr-2" />
                  导出 Excel
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">金额范围</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="number" 
                    placeholder="最小" 
                    value={minAmount}
                    onChange={e => setMinAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                  />
                  <span className="text-slate-400">-</span>
                  <input 
                    type="number" 
                    placeholder="最大" 
                    value={maxAmount}
                    onChange={e => setMaxAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">产品过滤</label>
                <select 
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                >
                  <option value="">全部产品</option>
                  {Array.from(new Set(orders.map(o => o.product))).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">委外类型</label>
                <select 
                  value={selectedOutsource}
                  onChange={e => setSelectedOutsource(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                >
                  <option value="">全部</option>
                  {Array.from(new Set(orders.filter(o => o.outsource).map(o => o.outsource))).map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">开票状态</label>
                <select 
                  value={invoicedFilter}
                  onChange={e => setInvoicedFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                >
                  <option value="all">全部</option>
                  <option value="yes">已开票</option>
                  <option value="no">未开票</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => {
                    setMinAmount("");
                    setMaxAmount("");
                    setSelectedProduct("");
                    setSelectedOutsource("");
                    setSearchTerm("");
                    setInvoicedFilter("all");
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  重置所有筛选
                </button>
              </div>
            </div>
          )}

          {showSettings && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3">显示列设置</label>
              <div className="flex flex-wrap gap-3">
                {Object.entries(visibleColumns).map(([key, visible]) => (
                  <button 
                    key={key}
                    onClick={() => toggleColumn(key as any)}
                    className={cn(
                      "flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                      visible 
                        ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400" 
                        : "bg-slate-100 dark:bg-slate-800 border-transparent text-slate-400 dark:text-slate-500"
                    )}
                  >
                    {visible ? <Eye size={12} className="mr-1.5" /> : <EyeOff size={12} className="mr-1.5" />}
                    {key === 'date' ? '日期' : 
                     key === 'customer' ? '客户' : 
                     key === 'product' ? '产品' : 
                     key === 'qty' ? '数量' : 
                     key === 'price' ? '单价' : 
                     key === 'total' ? '合计' : 
                     key === 'outsource' ? '委外' : 
                     key === 'fixture_loss' ? '挂具损耗' : '备注'}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
            {renderOrderTable()}
            
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                共 <span className="font-bold text-slate-800 dark:text-slate-200">{orderPagination.total}</span> 笔订单
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  disabled={orderPagination.page === 1}
                  onClick={() => fetchOrders(orderPagination.page - 1)}
                  className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors dark:text-slate-400"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-medium dark:text-slate-300">第 {orderPagination.page} / {orderPagination.pages} 页</span>
                <button 
                  disabled={orderPagination.page === orderPagination.pages}
                  onClick={() => fetchOrders(orderPagination.page + 1)}
                  className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-colors dark:text-slate-400"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <h3 className="text-lg font-bold mb-4 flex items-center">
              <CheckSquare size={20} className="mr-2 text-indigo-600" />
              开票信息补录 (Invoice Management)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                    <th className="px-4 py-3">日期</th>
                    <th className="px-4 py-3">客户</th>
                    <th className="px-4 py-3">产品</th>
                    <th className="px-4 py-3 text-right">金额</th>
                    <th className="px-4 py-3">发票号码</th>
                    <th className="px-4 py-3">开票日期</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs">{o.date}</td>
                      <td className="px-4 py-3 font-bold">{o.customer}</td>
                      <td className="px-4 py-3">{o.product}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(o.total)}</td>
                      <td className="px-4 py-3">
                        {editingInvoice?.id === o.id ? (
                          <input 
                            type="text" 
                            value={editingInvoice.invoice_no}
                            onChange={e => setEditingInvoice({...editingInvoice, invoice_no: e.target.value})}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="输入发票号"
                          />
                        ) : (
                          <span className="text-slate-500">{o.invoice_no || "-"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingInvoice?.id === o.id ? (
                          <input 
                            type="date" 
                            value={editingInvoice.invoice_date}
                            onChange={e => setEditingInvoice({...editingInvoice, invoice_date: e.target.value})}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-slate-500">{o.invoice_date || "-"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingInvoice?.id === o.id ? (
                          <div className="flex justify-center space-x-2">
                            <button onClick={handleUpdateInvoice} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditingInvoice(null)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setEditingInvoice({ id: o.id, invoice_no: o.invoice_no || "", invoice_date: o.invoice_date || new Date().toISOString().split('T')[0] })}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Settings2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "statement" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">选择客户生成对账单</label>
            <select 
              value={selectedCustomer} 
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full max-w-md px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            >
              <option value="">-- 请选择客户 --</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {selectedCustomer && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedCustomer} 对账单</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">生成日期: {new Date().toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">当前总欠款</div>
                  <div className={`text-3xl font-bold font-mono ${customerDebt > 0 ? "text-rose-600 dark:text-rose-500" : "text-emerald-600 dark:text-emerald-500"}`}>
                    {formatCurrency(customerDebt)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold mb-4 flex items-center text-blue-600 dark:text-blue-400">
                    <List size={18} className="mr-2" />
                    订单明细
                  </h4>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr className="dark:text-slate-400">
                          <th className="px-4 py-2">日期</th>
                          <th className="px-4 py-2">产品</th>
                          <th className="px-4 py-2 text-right">金额</th>
                          <th className="px-4 py-2 text-center">核对</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {customerOrders.map(o => (
                          <tr key={o.id} className="dark:text-slate-300">
                            <td className="px-4 py-2 font-mono text-xs">{o.date}</td>
                            <td className="px-4 py-2">{o.product}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(o.total)}</td>
                            <td className="px-4 py-2 text-center">
                              <button 
                                onClick={() => handleUpdateReconciled(o.id, o.reconciled === 1 ? 0 : 1)}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  o.reconciled === 1 
                                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" 
                                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                                title={o.reconciled === 1 ? "已核对" : "未核对"}
                              >
                                {o.reconciled === 1 ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 flex items-center text-emerald-600 dark:text-emerald-400">
                    <HandCoins size={18} className="mr-2" />
                    收款明细
                  </h4>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr className="dark:text-slate-400">
                          <th className="px-4 py-2">日期</th>
                          <th className="px-4 py-2">方式</th>
                          <th className="px-4 py-2 text-right">金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {customerIncomes.map(i => (
                          <tr key={i.id} className="dark:text-slate-300">
                            <td className="px-4 py-2 font-mono text-xs">{i.date}</td>
                            <td className="px-4 py-2">{i.bank}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(i.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4">
                <button 
                  onClick={() => setPrintingStatement({ customer: selectedCustomer, type: 'customer' })}
                  className="flex items-center px-6 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                  <Printer size={18} className="mr-2" />
                  打印正式对账单
                </button>
                <button 
                  onClick={handleExportCustomerStatement}
                  className="flex items-center px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                >
                  <Download size={18} className="mr-2" />
                  导出对账单 (Excel)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "supplier-statement" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">选择供应商生成对账单</label>
            <select 
              value={selectedSupplier} 
              onChange={e => setSelectedSupplier(e.target.value)}
              className="w-full max-w-md px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            >
              <option value="">-- 请选择供应商 --</option>
              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {selectedSupplier && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedSupplier} 对账单</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">生成日期: {new Date().toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">当前总应付</div>
                  <div className="text-3xl font-bold font-mono text-orange-600 dark:text-orange-500">
                    {formatCurrency(
                      supplierBills.filter(b => b.supplier === selectedSupplier).reduce((acc, cur) => acc + cur.amount, 0) -
                      expenses.filter(e => e.supplier === selectedSupplier).reduce((acc, cur) => acc + cur.amount, 0)
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold mb-4 flex items-center text-orange-600 dark:text-orange-400">
                    <Truck size={18} className="mr-2" />
                    账单明细 (应付)
                  </h4>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr className="dark:text-slate-400">
                          <th className="px-4 py-2">日期</th>
                          <th className="px-4 py-2">分类</th>
                          <th className="px-4 py-2 text-right">金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {supplierBills.filter(b => b.supplier === selectedSupplier).map(b => (
                          <tr key={b.id} className="dark:text-slate-300">
                            <td className="px-4 py-2 font-mono text-xs">{b.date}</td>
                            <td className="px-4 py-2">{b.category}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(b.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 flex items-center text-rose-600 dark:text-rose-400">
                    <HandCoins size={18} className="mr-2" />
                    付款明细 (已付)
                  </h4>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr className="dark:text-slate-400">
                          <th className="px-4 py-2">日期</th>
                          <th className="px-4 py-2">方式</th>
                          <th className="px-4 py-2 text-right">金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {expenses.filter(e => e.supplier === selectedSupplier).map(e => (
                          <tr key={e.id} className="dark:text-slate-300">
                            <td className="px-4 py-2 font-mono text-xs">{e.date}</td>
                            <td className="px-4 py-2">{e.method}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4">
                <button 
                  onClick={() => setPrintingStatement({ customer: selectedSupplier, type: 'supplier' })}
                  className="flex items-center px-6 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                  <Printer size={18} className="mr-2" />
                  打印正式对账单
                </button>
                <button 
                  onClick={handleExportSupplierStatement}
                  className="flex items-center px-6 py-2 bg-orange-600 dark:bg-orange-500 text-white rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors"
                >
                  <Download size={18} className="mr-2" />
                  导出供应商对账单 (Excel)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "aging" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                <TrendingUp size={18} className="text-emerald-500 dark:text-emerald-400 mr-2" />
                应收账款概况
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                当前未核对订单总额为 <span className="font-bold text-emerald-600 dark:text-emerald-400">{receivableAging.reduce((acc, curr) => acc + curr.value, 0) > 0 ? formatCurrency(receivableAging.reduce((acc, curr) => acc + curr.value, 0)) : "¥0"}</span>。建议及时核对并催收，以保证资金流转。
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                <Clock size={18} className="text-rose-500 dark:text-rose-400 mr-2" />
                应付账款概况
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                当前待付供应商账单总额为 <span className="font-bold text-rose-600 dark:text-rose-400">{payableAging.reduce((acc, curr) => acc + curr.value, 0) > 0 ? formatCurrency(payableAging.reduce((acc, curr) => acc + curr.value, 0)) : "¥0"}</span>。请合理安排付款计划。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Receivable Aging */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">应收账款账龄分析</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">基于订单日期与未核对状态测算</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mb-1">总应收</div>
                  <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {receivableAging.reduce((acc, curr) => acc + curr.value, 0) > 0 ? formatCurrency(receivableAging.reduce((acc, curr) => acc + curr.value, 0)) : "---"}
                  </div>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receivableAging}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `¥${value}`} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc', opacity: 0.1 }}
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: number) => [formatCurrency(value), "应收金额"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                      {receivableAging.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#059669' : index === 2 ? '#047857' : '#064e3b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payable Aging */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">应付账款账龄分析</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">基于供应商账单日期测算</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mb-1">总应付</div>
                  <div className="text-2xl font-mono font-bold text-rose-600 dark:text-rose-400">
                    {payableAging.reduce((acc, curr) => acc + curr.value, 0) > 0 ? formatCurrency(payableAging.reduce((acc, curr) => acc + curr.value, 0)) : "---"}
                  </div>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payableAging}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `¥${value}`} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc', opacity: 0.1 }}
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: number) => [formatCurrency(value), "应付金额"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                      {payableAging.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#f43f5e' : index === 1 ? '#e11d48' : index === 2 ? '#be123c' : '#9f1239'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "yearly" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">年度收支趋势分析</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">展示当前年度各月份的销售、收入与支出对比</p>
              </div>
              <div className="flex space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">销售额</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">实收额</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-rose-500 rounded-full mr-2"></div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">支出额</span>
                </div>
              </div>
            </div>

            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `${val}月`} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `¥${val/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc', opacity: 0.1 }}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} name="销售额" />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="实收额" />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="支出额" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">年度总销售</div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {formatCurrency(yearlyData.reduce((acc, cur) => acc + cur.sales, 0))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">年度总实收</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 font-mono">
                {formatCurrency(yearlyData.reduce((acc, cur) => acc + cur.income, 0))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">年度总支出</div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-500 font-mono">
                {formatCurrency(yearlyData.reduce((acc, cur) => acc + cur.expense, 0))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pl" && renderPLStatement()}
      {activeTab === "balance-sheet" && renderBalanceSheet()}
      {activeTab === "trial-balance" && renderTrialBalance()}
      {activeTab === "multi-column" && renderMultiColumnLedger()}
      {activeTab === "subsidiary-ledger" && renderSubsidiaryLedger()}
      {activeTab === "cash-flow" && renderCashFlowStatement()}
      {activeTab === "tax" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">应交增值税 (预估)</div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                {formatCurrency(taxReport?.vat.net || 0)}
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                销项 {formatCurrency(taxReport?.vat.output || 0)} - 进项 {formatCurrency(taxReport?.vat.input || 0)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">企业所得税 (预估)</div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-500 font-mono">
                {formatCurrency(taxReport?.eit.estimate || 0)}
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                按 25% 标准税率对利润 {formatCurrency(taxReport?.eit.profit || 0)} 进行预估
              </div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium mb-1">税务合规度</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">98%</div>
              <div className="text-[10px] text-emerald-500 mt-2">基于发票录入率与报表勾稽关系</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-6 flex items-center">
              <FileText size={20} className="mr-2 text-indigo-600" />
              税务申报参考明细
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                    <th className="px-6 py-4">申报项目</th>
                    <th className="px-6 py-4 text-right">计税依据</th>
                    <th className="px-6 py-4 text-right">税率</th>
                    <th className="px-6 py-4 text-right">预估税额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="px-6 py-4 font-medium">增值税 (VAT)</td>
                    <td className="px-6 py-4 text-right font-mono">{formatCurrency((taxReport?.vat.output || 0) * 10)}</td>
                    <td className="px-6 py-4 text-right font-mono">13% / 9% / 6%</td>
                    <td className="px-6 py-4 text-right font-mono text-indigo-600">{formatCurrency(taxReport?.vat.net || 0)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium">城市维护建设税</td>
                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(taxReport?.vat.net || 0)}</td>
                    <td className="px-6 py-4 text-right font-mono">7%</td>
                    <td className="px-6 py-4 text-right font-mono text-indigo-600">{formatCurrency((taxReport?.vat.net || 0) * 0.07)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium">教育费附加</td>
                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(taxReport?.vat.net || 0)}</td>
                    <td className="px-6 py-4 text-right font-mono">3%</td>
                    <td className="px-6 py-4 text-right font-mono text-indigo-600">{formatCurrency((taxReport?.vat.net || 0) * 0.03)}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800 font-bold">
                    <td className="px-6 py-4">合计 (Total Taxes)</td>
                    <td colSpan={2} className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-right font-mono text-rose-600">
                      {formatCurrency((taxReport?.vat.net || 0) * 1.1 + (taxReport?.eit.estimate || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "profit-dist" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-6 flex items-center">
              <HandCoins size={20} className="mr-2 text-emerald-600" />
              利润分配管理 (Profit Appropriation)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div className="text-xs text-slate-500 uppercase font-medium mb-1">可供分配利润总额</div>
                  <div className="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
                    {formatCurrency(totalIncome - totalExpense)}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">分配日期</label>
                    <input type="date" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">分配类型</label>
                    <select className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none">
                      <option>提取法定盈余公积 (10%)</option>
                      <option>提取任意盈余公积</option>
                      <option>向投资者分配利润 (分红)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">分配金额</label>
                    <input type="number" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none" placeholder="0.00" />
                  </div>
                  <button className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg">确认执行分配</button>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-sm font-bold text-slate-500 uppercase">历史分配记录</h4>
                <div className="space-y-3">
                  {profitDistributions.map((dist, i) => (
                    <div key={i} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{dist.type}</div>
                        <div className="text-[10px] text-slate-400">{dist.date}</div>
                      </div>
                      <div className="text-lg font-black text-rose-600 font-mono">-{formatCurrency(dist.amount)}</div>
                    </div>
                  ))}
                  {profitDistributions.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic">暂无分配记录</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === "health" && renderHealthCockpit()}

      {activeTab === "expense-analysis" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">支出分类占比</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                      itemStyle={{ color: '#f1f5f9' }}
                      formatter={(value: number) => formatCurrency(value)} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">支出明细统计</h3>
              <div className="space-y-4">
                {expenseBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span className="font-medium dark:text-slate-200">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono dark:text-slate-100">{formatCurrency(item.value)}</div>
                      <div className="text-[10px] text-slate-400">
                        占总支出 {((item.value / expenseBreakdown.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
                {expenseBreakdown.length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic">暂无支出数据</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold dark:text-slate-100">系统操作日志</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">显示最近 100 条操作记录</span>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 shadow-sm">
                <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">时间</th>
                  <th className="px-6 py-4">操作</th>
                  <th className="px-6 py-4">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {auditLogs.map(log => (
                  <tr key={log.id} className="data-row hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4"><span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase">{log.action}</span></td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "wages" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">计件工资报表</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  统计周期: {startDate} 至 {endDate}
                </p>
              </div>
              <button 
                onClick={() => exportToExcel(wages, `计件工资报表_${startDate}_${endDate}`)}
                className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Download size={16} className="mr-2" />
                导出工资表
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">参与计件人数</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{wages.length} 人</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">总计件数量</div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {wages.reduce((acc, cur) => acc + cur.total_qty, 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">总计件笔数</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 font-mono">
                  {wages.reduce((acc, cur) => acc + cur.order_count, 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4 font-medium">生产员姓名</th>
                    <th className="px-6 py-4 font-medium text-right">总计件数量</th>
                    <th className="px-6 py-4 font-medium text-right">订单笔数</th>
                    <th className="px-6 py-4 font-medium text-right">平均单笔产量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {wages.map((w, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium dark:text-slate-200">{w.worker}</td>
                      <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-400">{w.total_qty.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-400">{w.order_count}</td>
                      <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-400">
                        {w.order_count > 0 ? (w.total_qty / w.order_count).toFixed(2) : "0.00"}
                      </td>
                    </tr>
                  ))}
                  {wages.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        该时段内暂无计件数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "profit" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800">
              <h4 className="text-xs font-bold text-indigo-600 uppercase mb-2">盈亏平衡分析 (BEP)</h4>
              <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
                {formatCurrency(totalExpense / (totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 1))}
              </div>
              <p className="text-[10px] text-indigo-500 mt-1">需达到此产值方可覆盖固定成本</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <h4 className="text-xs font-bold text-emerald-600 uppercase mb-2">安全边际率</h4>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                {totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1) : "0.0"}%
              </div>
              <p className="text-[10px] text-emerald-500 mt-1">反映工厂抗经营风险能力</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-2xl border border-rose-100 dark:border-rose-800">
              <h4 className="text-xs font-bold text-rose-600 uppercase mb-2">费用弹性系数</h4>
              <div className="text-xl font-black text-rose-700 dark:text-rose-300 font-mono">
                {(totalExpense / (totalIncome > 0 ? totalIncome : 1)).toFixed(2)}
              </div>
              <p className="text-[10px] text-rose-500 mt-1">每产生1元收入所需的费用支出</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">产品利润贡献 (Top 10)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(orders.reduce((acc: any, cur) => {
                    acc[cur.product] = (acc[cur.product] || 0) + cur.total;
                    return acc;
                  }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `¥${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                      itemStyle={{ color: '#f1f5f9' }}
                      formatter={(value: number) => formatCurrency(value)} 
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">客户产值占比</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(orders.reduce((acc: any, cur) => {
                        acc[cur.customer] = (acc[cur.customer] || 0) + cur.total;
                        return acc;
                      }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 7)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {printingStatement && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800 my-8">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
              <h3 className="text-lg font-bold flex items-center dark:text-slate-100">
                <Printer className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                正式对账单预览
              </h3>
              <button onClick={() => setPrintingStatement(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-12 bg-white dark:bg-slate-900" id="printable-statement">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold tracking-[0.2em] dark:text-slate-100">五金氧化加工厂对账单</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">地址：工厂工业园区 123 号 | 电话：138-XXXX-XXXX</p>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                <div className="space-y-1">
                  <p><span className="text-slate-400">往来单位：</span><span className="font-bold text-lg dark:text-slate-200">{printingStatement.customer}</span></p>
                  <p><span className="text-slate-400">对账周期：</span><span className="dark:text-slate-300">截止至 {new Date().toLocaleDateString()}</span></p>
                </div>
                <div className="text-right space-y-1">
                  <p><span className="text-slate-400">打印日期：</span><span className="dark:text-slate-300">{new Date().toLocaleString()}</span></p>
                  <p><span className="text-slate-400">币种：</span><span className="dark:text-slate-300">人民币 (CNY)</span></p>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="text-sm font-bold mb-3 border-l-4 border-indigo-500 pl-2 dark:text-slate-200">往来明细</h4>
                <table className="w-full border-collapse border border-slate-200 dark:border-slate-700 text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr className="dark:text-slate-400">
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">日期</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">摘要/产品</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">应收/应付</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">已收/已付</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">余额</th>
                    </tr>
                  </thead>
                  <tbody className="dark:text-slate-300">
                    {printingStatement.type === 'customer' ? (
                      <>
                        {orders.filter(o => o.customer === printingStatement.customer).map(o => (
                          <tr key={`o-${o.id}`}>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono">{o.date}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">{o.product} ({o.qty}{o.unit})</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">{formatCurrency(o.total)}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                          </tr>
                        ))}
                        {incomes.filter(i => i.customer === printingStatement.customer).map(i => (
                          <tr key={`i-${i.id}`} className="bg-emerald-50/30 dark:bg-emerald-900/10">
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono">{i.date}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">货款回收 ({i.bank})</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">{formatCurrency(i.amount)}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                          </tr>
                        ))}
                      </>
                    ) : (
                      <>
                        {supplierBills.filter(b => b.supplier === printingStatement.customer).map(b => (
                          <tr key={`b-${b.id}`}>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono">{b.date}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">{b.category}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">{formatCurrency(b.amount)}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                          </tr>
                        ))}
                        {expenses.filter(e => e.supplier === printingStatement.customer).map(e => (
                          <tr key={`e-${e.id}`} className="bg-rose-50/30 dark:bg-rose-900/10">
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono">{e.date}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">支付货款 ({e.method})</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">{formatCurrency(e.amount)}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">-</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                    <tr>
                      <td colSpan={2} className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">合计：</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">
                        {printingStatement.type === 'customer' 
                          ? formatCurrency(orders.filter(o => o.customer === printingStatement.customer).reduce((acc, cur) => acc + cur.total, 0))
                          : formatCurrency(supplierBills.filter(b => b.supplier === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0))}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono">
                        {printingStatement.type === 'customer'
                          ? formatCurrency(incomes.filter(i => i.customer === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0))
                          : formatCurrency(expenses.filter(e => e.supplier === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0))}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-mono text-indigo-600 dark:text-indigo-400">
                        {printingStatement.type === 'customer'
                          ? formatCurrency(orders.filter(o => o.customer === printingStatement.customer).reduce((acc, cur) => acc + cur.total, 0) - incomes.filter(i => i.customer === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0))
                          : formatCurrency(supplierBills.filter(b => b.supplier === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0) - expenses.filter(e => e.supplier === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0))}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">
                        人民币大写：{toChineseNumeral(
                          printingStatement.type === 'customer'
                            ? orders.filter(o => o.customer === printingStatement.customer).reduce((acc, cur) => acc + cur.total, 0) - incomes.filter(i => i.customer === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0)
                            : supplierBills.filter(b => b.supplier === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0) - expenses.filter(e => e.supplier === printingStatement.customer).reduce((acc, cur) => acc + cur.amount, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-12 mt-16 text-sm">
                <div className="space-y-8">
                  <p>往来单位确认（盖章）：</p>
                  <p className="pt-4">日期：____年__月__日</p>
                </div>
                <div className="space-y-8 text-right relative">
                  <p>本厂确认（盖章）：</p>
                  <p className="pt-4">日期：____年__月__日</p>
                  {/* Simulated Stamp */}
                  <div className="absolute right-4 -top-4 w-24 h-24 border-4 border-rose-500/30 rounded-full flex items-center justify-center text-rose-500/30 font-bold text-[10px] transform rotate-12 pointer-events-none">
                    <div className="text-center border-2 border-rose-500/30 rounded-full p-2">
                      财务专用章<br/>五金氧化厂
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-12 pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
                温馨提示：请核对以上账目，如有异议请在 7 个工作日内提出，逾期视为认可。
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4 sticky bottom-0">
              <button 
                onClick={() => setPrintingStatement(null)}
                className="px-6 py-2 text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center"
              >
                <Printer size={18} className="mr-2" />
                立即打印
              </button>
            </div>
          </div>
        </div>
      )}

      {printingOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold flex items-center dark:text-slate-100">
                <Printer className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                送货单预览
              </h3>
              <button onClick={() => setPrintingOrder(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-12 bg-white dark:bg-slate-900" id="printable-delivery-note">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold tracking-widest dark:text-slate-100">五金氧化厂送货单</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">地址：工厂工业园区 123 号 | 电话：138-XXXX-XXXX</p>
              </div>
              <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                <div>
                  <p><span className="text-slate-400 dark:text-slate-500">客户名称：</span><span className="font-bold dark:text-slate-200">{printingOrder.customer}</span></p>
                  <p><span className="text-slate-400 dark:text-slate-500">送货日期：</span><span className="dark:text-slate-300">{printingOrder.date}</span></p>
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 dark:text-slate-500">单据编号：</span><span className="font-mono dark:text-slate-300">DN-{printingOrder.id.toString().padStart(6, '0')}</span></p>
                </div>
              </div>
              <table className="w-full border-collapse border border-slate-200 dark:border-slate-700 text-sm mb-8">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="dark:text-slate-400">
                    <th className="border border-slate-200 dark:border-slate-700 px-4 py-2">产品名称</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-4 py-2">规格型号</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-center">数量</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-center">单位</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-right">单价</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-right">金额</th>
                  </tr>
                </thead>
                <tbody className="dark:text-slate-300">
                  <tr>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-4 font-medium">{printingOrder.product}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-4">{printingOrder.spec || "-"}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-4 text-center font-mono">{printingOrder.qty}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-4 text-center">{printingOrder.unit}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-4 text-right font-mono">{formatCurrency(printingOrder.price)}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-4 text-right font-mono font-bold">{formatCurrency(printingOrder.total)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="dark:text-slate-200">
                    <td colSpan={5} className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-right font-bold">合计金额：</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(printingOrder.total)}</td>
                  </tr>
                  <tr className="dark:text-slate-200">
                    <td colSpan={6} className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-left font-bold">人民币大写：{toChineseNumeral(printingOrder.total)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="grid grid-cols-3 gap-4 text-[10px] text-slate-500 dark:text-slate-400 mt-12 border-t border-dashed border-slate-200 pt-4">
                <p>送货人签字：________________</p>
                <p>收货人签字：________________</p>
                <div className="text-right space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">第一联：存根 (白) | 第二联：客户 (红) | 第三联：财务 (黄)</p>
                  <p>温馨提示：请核对产品规格及数量，如有问题请及时反馈。</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4">
              <button 
                onClick={() => setPrintingOrder(null)}
                className="px-6 py-2 text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors flex items-center"
              >
                <Printer size={18} className="mr-2" />
                立即打印
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
