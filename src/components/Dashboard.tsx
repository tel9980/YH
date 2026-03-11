import React, { useEffect, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  Package, 
  Truck,
  Sparkles,
  ClipboardList,
  HandCoins,
  Wallet,
  Boxes,
  Lock,
  Bot,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Copy,
  ShieldCheck,
  ShieldAlert as ShieldAlertIcon,
  PieChart as PieChartIcon,
  Plus
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { Stats, BankBalance, Overdue, TopProduct } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { Skeleton, CardSkeleton } from "./Skeleton";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface CashFlowPrediction {
  predictedIncome: number;
  predictedExpense: number;
  predictedCollection: number;
  netFlow: number;
}

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [prediction, setPrediction] = useState<CashFlowPrediction | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [healthCheck, setHealthCheck] = useState<any>(null);
  const [workerLeaderboard, setWorkerLeaderboard] = useState<any[]>([]);
  const [inventoryValuation, setInventoryValuation] = useState<number>(0);
  const [creditAlerts, setCreditAlerts] = useState<any[]>([]);
  const [costVarianceAlerts, setCostVarianceAlerts] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [productionSummary, setProductionSummary] = useState<any[]>([]);
  const [dupont, setDupont] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, bankRes, overdueRes, topRes, predictRes, trendRes, expenseRes, healthRes, workerRes, valuationRes, creditRes, lowStockRes, prodRes, dupontRes] = await Promise.all([
          fetch("/api/stats").then(res => res.json()),
          fetch("/api/bank-balances").then(res => res.json()),
          fetch("/api/overdue").then(res => res.json()),
          fetch("/api/top-products").then(res => res.json()),
          fetch("/api/cashflow-prediction").then(res => res.json()),
          fetch("/api/monthly-trend").then(res => res.json()),
          fetch("/api/expense-breakdown").then(res => res.json()),
          fetch("/api/health-check").then(res => res.json()),
          fetch("/api/worker-leaderboard").then(res => res.json()),
          fetch("/api/inventory-valuation").then(res => res.json()),
          fetch("/api/credit-alerts").then(res => res.json()),
          fetch("/api/low-stock").then(res => res.json()),
          fetch("/api/production-summary").then(res => res.json()),
          fetch("/api/dupont-metrics").then(res => res.json())
        ]);
        setStats(statsRes);
        setBankBalances(bankRes);
        setOverdue(overdueRes);
        setTopProducts(topRes);
        setPrediction(predictRes);
        setMonthlyTrend(trendRes);
        setExpenseBreakdown(expenseRes);
        setHealthCheck(healthRes);
        setWorkerLeaderboard(workerRes);
        setInventoryValuation(valuationRes.totalValue);
        setCreditAlerts(creditRes);
        setLowStock(lowStockRes);
        setProductionSummary(prodRes);
        setDupont(dupontRes);

        // Fetch cost variance alerts
        try {
          const variancesRes = await fetch("/api/v7/cost-variances");
          if (variancesRes.ok) {
            const variances = await variancesRes.json();
            const alerts = variances.filter((v: any) => Math.abs(v.variance_rate) > 10 && !v.processed);
            setCostVarianceAlerts(alerts);
          }
        } catch (err) {
          // Cost variance API might not be available yet
        }
      } catch (e) {
        showToast("加载数据失败", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleBackup = async () => {
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xiaokuaiji_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("数据备份成功！", "success");
    } catch (e) {
      showToast("备份失败，请重试", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6">
          {Array.from({ length: 7 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-80 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* Quick Start Guide for Beginners */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 flex items-center">
            <Sparkles className="mr-2" size={20} />
            小会计快速上手指南
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => setActiveTab("products")}
              className="text-xs font-medium px-3 py-1 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 transition-colors"
            >
              录入产品库
            </button>
            <button 
              onClick={() => setActiveTab("contacts")}
              className="text-xs font-medium px-3 py-1 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 transition-colors"
            >
              录入客户名单
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <GuideStep step={1} title="基础设置" desc="录入产品单价和客户名单，后续录单更快捷。" />
          <GuideStep step={2} title="录单" desc="记录客户来料加工详情，支持多种计价单位。" />
          <GuideStep step={3} title="收款" desc="客户付加工费时记录。支持G银行、N银行及微信。" />
          <GuideStep step={4} title="付款" desc="支付房租、水电、材料费或工资时记录支出。" />
          <GuideStep step={5} title="查账" desc="在报表中心查看利润或对账，或问智能助手。" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
        <StatCard title="总收入" value={stats.totalIncome} icon={TrendingUp} color="text-emerald-600 dark:text-emerald-400" mom={stats.mom.income} />
        <StatCard title="总支出" value={stats.totalExpense} icon={TrendingDown} color="text-rose-600 dark:text-rose-400" mom={stats.mom.expense} />
        <StatCard title="毛利" value={stats.profit} icon={DollarSign} color="text-indigo-600 dark:text-indigo-400" mom={stats.mom.profit} />
        <StatCard title="应收账款" value={stats.totalReceivable} icon={AlertCircle} color="text-amber-600 dark:text-amber-400" />
        <StatCard title="应付账款" value={stats.totalPayable} icon={Truck} color="text-orange-600 dark:text-orange-400" />
        <StatCard title="库存价值" value={inventoryValuation} icon={Boxes} color="text-emerald-500 dark:text-emerald-400" />
        <StatCard title="待委外" value={stats.outsourceCount} icon={Package} color="text-slate-600 dark:text-slate-400" />
        <div className={cn(
          "p-6 rounded-2xl shadow-sm border transition-all duration-300",
          stats.inventoryAlerts > 0 
            ? "border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20" 
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2 rounded-lg", stats.inventoryAlerts > 0 ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500")}>
              <Package size={20} />
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-medium">库存预警</div>
          <div className={cn("text-2xl font-bold font-mono", stats.inventoryAlerts > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100")}>
            {stats.inventoryAlerts} <span className="text-sm font-normal">项</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <Sparkles className="mr-2 text-indigo-500" size={20} />
            快捷操作
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickActionButton label="批量录单" icon={ClipboardList} color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" onClick={() => setActiveTab("orders")} />
            <QuickActionButton label="记录收款" icon={HandCoins} color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" onClick={() => setActiveTab("incomes")} />
            <QuickActionButton label="记录支出" icon={Wallet} color="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" onClick={() => setActiveTab("expenses")} />
            <QuickActionButton label="库存调整" icon={Boxes} color="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" onClick={() => setActiveTab("inventory")} />
            <QuickActionButton label="月结归档" icon={Lock} color="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" onClick={() => setActiveTab("archive")} />
            <QuickActionButton label="数据备份" icon={Download} color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" onClick={handleBackup} />
            <QuickActionButton label="问 AI" icon={Bot} color="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400" onClick={() => setActiveTab("ai")} />
          </div>
        </div>

        {/* Cash Flow Prediction */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center dark:text-slate-100">
              <Calendar className="mr-2 text-blue-500" size={20} />
              下月资金预测
            </h3>
            <button 
              onClick={() => {
                if (!prediction) return;
                const text = `资金预测报告：\n预计收入：${formatCurrency(prediction.predictedIncome)}\n预计支出：${formatCurrency(prediction.predictedExpense)}\n预计净流向：${formatCurrency(prediction.netFlow)}`;
                navigator.clipboard.writeText(text);
                showToast("预测报告已复制到剪贴板", "success");
              }}
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="复制预测报告"
            >
              <Copy size={16} />
            </button>
          </div>
          {prediction && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">预计收入</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(prediction.predictedIncome)}</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">预计支出</div>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">{formatCurrency(prediction.predictedExpense)}</div>
                </div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">预计净现金流</span>
                  <span className={cn("text-lg font-bold font-mono", prediction.netFlow >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {formatCurrency(prediction.netFlow)}
                  </span>
                </div>
                <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">基于过去3个月平均收支及当前应收账款回收率(70%)预测。</p>
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { name: '上月', val: prediction.predictedIncome * 0.9 },
                    { name: '本月', val: prediction.predictedIncome },
                    { name: '预测', val: prediction.predictedIncome * 1.1 }
                  ]}>
                    <Area type="monotone" dataKey="val" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Bank Balances */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">💳 银行实时余额</h3>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {bankBalances.map((bank, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{bank.bank}</div>
                <div className="text-lg font-bold font-mono dark:text-slate-100">{formatCurrency(bank.balance)}</div>
              </div>
            ))}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bankBalances}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="balance"
                  nameKey="bank"
                >
                  {bankBalances.map((entry, index) => (
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Expense Breakdown */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <PieChartIcon className="mr-2 text-rose-500" size={20} />
            支出构成分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
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
            <div className="space-y-3">
              {expenseBreakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.name}</span>
                  </div>
                  <span className="text-sm font-mono font-bold dark:text-slate-200">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Health Check */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <ShieldCheck className="mr-2 text-emerald-500" size={20} />
            财务健康体检 (Health Check)
          </h3>
          {healthCheck && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <HealthItem 
                title="异常库存" 
                value={healthCheck.negativeInventory} 
                label="项负库存" 
                isGood={healthCheck.negativeInventory === 0} 
                onClick={() => setActiveTab("inventory")}
              />
              <HealthItem 
                title="零价订单" 
                value={healthCheck.zeroPriceOrders} 
                label="笔待核价" 
                isGood={healthCheck.zeroPriceOrders === 0} 
                onClick={() => setActiveTab("reports")}
              />
              <HealthItem 
                title="长期欠款" 
                value={healthCheck.overdueReceivables} 
                label="笔超90天" 
                isGood={healthCheck.overdueReceivables === 0} 
                onClick={() => setActiveTab("reports")}
              />
              <HealthItem 
                title="低库存" 
                value={lowStock.length} 
                label="项待采购" 
                isGood={lowStock.length === 0} 
                onClick={() => setActiveTab("inventory")}
              />
            </div>
          )}
          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-start text-xs text-slate-500 dark:text-slate-400">
              <Bot size={14} className="mr-2 text-indigo-500 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">AI 智能诊断：</span>
                {healthCheck?.negativeInventory > 0 ? "检测到负库存，请及时进行库存盘点，否则会影响利润核算的准确性。" : 
                 healthCheck?.overdueReceivables > 0 ? "有长期未收回款项，建议尽快联系客户对账并确认回款计划。" : 
                 healthCheck?.zeroPriceOrders > 0 ? "存在零价订单，请及时录入单价以确保收入统计完整。" :
                 "当前系统环境及财务指标表现优异，建议保持每周备份数据的习惯。"}
              </div>
            </div>
          </div>
        </div>

        {/* Credit Alerts */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <ShieldAlertIcon className="mr-2 text-rose-500" size={20} />
            信用风险预警
          </h3>
          <div className="space-y-4">
            {creditAlerts.map((alert, i) => (
              <div key={i} className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{alert.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded font-bold uppercase">超额</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">当前欠款: {formatCurrency(alert.balance)}</span>
                  <span className="text-slate-500 dark:text-slate-400">信用额度: {formatCurrency(alert.credit_limit)}</span>
                </div>
              </div>
            ))}
            {creditAlerts.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic">
                <ShieldCheck size={48} className="mx-auto mb-4 opacity-20 text-emerald-500" />
                所有客户信用良好
              </div>
            )}
          </div>
        </div>

        {/* Cost Variance Alerts */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <TrendingUp className="mr-2 text-amber-500" size={20} />
            成本差异预警
          </h3>
          <div className="space-y-4">
            {costVarianceAlerts.map((alert, i) => (
              <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">产品 #{alert.product_id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded font-bold uppercase">
                    {alert.variance_rate >= 0 ? '+' : ''}{alert.variance_rate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">期间: {alert.period}</span>
                  <span className="text-slate-500 dark:text-slate-400">差异: {formatCurrency(alert.total_variance)}</span>
                </div>
              </div>
            ))}
            {costVarianceAlerts.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic">
                <ShieldCheck size={48} className="mx-auto mb-4 opacity-20 text-emerald-500" />
                成本控制良好
              </div>
            )}
          </div>
          {costVarianceAlerts.length > 0 && (
            <button 
              onClick={() => setActiveTab("cost-variance")}
              className="w-full mt-4 py-2 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors border-t border-slate-100 dark:border-slate-800 pt-4"
            >
              查看详细分析 →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Production Status Summary */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <ClipboardList className="mr-2 text-indigo-500" size={20} />
            生产进度看板
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {["待产", "生产中", "已完成", "已送货"].map(status => {
              const data = productionSummary.find(s => s.status === status) || { count: 0, total_qty: 0 };
              return (
                <div key={status} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">{status}</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{data.count} <span className="text-xs font-normal text-slate-400">单</span></div>
                  <div className="text-[10px] text-slate-500 mt-1">{data.total_qty.toLocaleString()} 件</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <AlertCircle className="mr-2 text-orange-500" size={20} />
            库存预警 (低库存)
          </h3>
          <div className="space-y-3">
            {lowStock.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/30">
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                  <div className="text-[10px] text-orange-600 dark:text-orange-400">当前: {item.stock} {item.unit} | 阈值: {item.low_threshold}</div>
                </div>
                <button 
                  onClick={() => setActiveTab("inventory")}
                  className="p-1.5 bg-white dark:bg-slate-800 text-orange-600 rounded-lg shadow-sm border border-orange-100 dark:border-orange-900/50"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic">
                <ShieldCheck size={48} className="mx-auto mb-4 opacity-20 text-emerald-500" />
                原材料库存充足
              </div>
            )}
          </div>
        </div>

        {/* Worker Leaderboard */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <Sparkles className="mr-2 text-amber-500" size={20} />
            生产员龙虎榜
          </h3>
          <div className="space-y-6">
            {workerLeaderboard.map((worker, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3",
                    i === 0 ? "bg-amber-100 text-amber-600" : 
                    i === 1 ? "bg-slate-100 text-slate-600" : 
                    i === 2 ? "bg-orange-100 text-orange-600" : 
                    "bg-slate-50 text-slate-400"
                  )}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold dark:text-slate-200">{worker.name}</div>
                    <div className="text-[10px] text-slate-400">{worker.orderCount} 笔订单</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{worker.totalQty.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">总产量</div>
                </div>
              </div>
            ))}
            {workerLeaderboard.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic">暂无生产数据</div>
            )}
          </div>
          <button 
            onClick={() => setActiveTab("reports")}
            className="w-full mt-8 py-2 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors border-t border-slate-100 dark:border-slate-800 pt-4"
          >
            查看完整工资报表 →
          </button>
        </div>

        {/* DuPont Analysis */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <TrendingUp className="mr-2 text-indigo-500" size={20} />
            杜邦财务分析 (DuPont Analysis)
          </h3>
          {dupont && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div className="flex justify-between items-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">净资产收益率 (ROE)</span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{(dupont.roe * 100).toFixed(2)}%</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">销售净利率</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{(dupont.netProfitMargin * 100).toFixed(2)}%</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">资产周转率</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{dupont.assetTurnover.toFixed(2)}次</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">权益乘数</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{dupont.equityMultiplier.toFixed(2)}倍</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  杜邦分析法揭示了企业盈利能力的根源：
                  <br /><br />
                  1. <span className="font-bold text-slate-700 dark:text-slate-300">销售净利率</span> 反映了产品的竞争力和成本管控能力。
                  <br />
                  2. <span className="font-bold text-slate-700 dark:text-slate-300">资产周转率</span> 反映了工厂资产的使用效率（产值/总资产）。
                  <br />
                  3. <span className="font-bold text-slate-700 dark:text-slate-300">权益乘数</span> 反映了财务杠杆的使用情况。
                </p>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-[10px] text-emerald-700 dark:text-emerald-300">
                  <Sparkles size={12} className="inline mr-1 mb-0.5" />
                  当前 ROE 为 {(dupont.roe * 100).toFixed(2)}%，说明每 1 元自有资金带来了 {dupont.roe.toFixed(3)} 元的净收益。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">收支趋势 (近6个月)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `¥${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => formatCurrency(value)} 
                />
                <Line type="monotone" dataKey="income" name="收入" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="expense" name="支出" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="order" name="产值" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">产品收入 Top 5</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="product" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `¥${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => formatCurrency(value)} 
                />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overdue Panel */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <AlertCircle className="mr-2 text-rose-500" size={20} />
            警报面板 (欠款 {">"} 5000)
          </h3>
          {overdue.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-medium">客户</th>
                    <th className="pb-3 font-medium text-right">欠款金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {overdue.map((item, i) => (
                    <tr key={i} className="group">
                      <td className="py-3 text-sm font-medium dark:text-slate-200">{item.customer}</td>
                      <td className="py-3 text-sm text-right text-rose-600 dark:text-rose-400 font-mono">{formatCurrency(item.debt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl">✅ 无高额欠款</div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthItem({ title, value, label, isGood, onClick }: { title: string, value: number, label: string, isGood: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border transition-all text-left group",
        isGood 
          ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30" 
          : "bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</span>
        {isGood ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldAlertIcon size={16} className="text-rose-500 animate-pulse" />}
      </div>
      <div className={cn("text-xl font-bold font-mono", isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {value} <span className="text-xs font-normal">{label}</span>
      </div>
      <div className="mt-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">点击查看详情 →</div>
    </button>
  );
}

function GuideStep({ step, title, desc }: { step: number, title: string, desc: string }) {
  return (
    <div className="space-y-2">
      <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center">
        <span className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs mr-2">{step}</span>
        {title}
      </div>
      <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80">{desc}</p>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, mom }: { title: string, value: number, icon: any, color: string, mom?: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg bg-slate-50 dark:bg-slate-800", color)}>
          <Icon size={20} />
        </div>
        {mom !== undefined && (
          <div className={cn(
            "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
            mom >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600"
          )}>
            {mom >= 0 ? <ArrowUpRight size={10} className="mr-0.5" /> : <ArrowDownRight size={10} className="mr-0.5" />}
            {Math.abs(mom).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-medium">{title}</div>
      <div className="text-2xl font-bold font-mono dark:text-slate-100">{formatCurrency(value)}</div>
    </div>
  );
}

function QuickActionButton({ label, icon: Icon, color, onClick }: { label: string, icon: any, color: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
      "flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:scale-105 active:scale-95",
      color
    )}>
      <Icon size={24} className="mb-2" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}
