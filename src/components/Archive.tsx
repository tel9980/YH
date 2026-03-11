import React, { useState, useEffect } from "react";
import { Archive as ArchiveIcon, Lock, CheckCircle2, Calendar, Download, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "./Toast";
import { cn } from "@/lib/utils";

interface ArchiveRecord {
  id: number;
  month: string;
  archived_at: string;
}

export default function Archive() {
  const { showToast } = useToast();
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [yearlySummary, setYearlySummary] = useState<any[]>([]);
  const [prevYearSummary, setPrevYearSummary] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/archives");
      const data = await res.json();
      setArchives(data);
    } catch (err) {
      showToast("获取归档失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlySummary = async (year: string) => {
    try {
      const [currentRes, prevRes] = await Promise.all([
        fetch(`/api/yearly-summary?year=${year}`),
        fetch(`/api/yearly-summary?year=${parseInt(year) - 1}`)
      ]);
      const currentData = await currentRes.json();
      const prevData = await prevRes.json();
      setYearlySummary(currentData);
      setPrevYearSummary(prevData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchArchives();
    fetchYearlySummary(selectedYear);
  }, [selectedYear]);

  const totalSales = yearlySummary.reduce((acc, cur) => acc + cur.sales, 0);
  const prevTotalSales = prevYearSummary.reduce((acc, cur) => acc + cur.sales, 0);
  const salesYoY = prevTotalSales ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

  const totalExpense = yearlySummary.reduce((acc, cur) => acc + cur.expense, 0);
  const prevTotalExpense = prevYearSummary.reduce((acc, cur) => acc + cur.expense, 0);
  const expenseYoY = prevTotalExpense ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : 0;

  const totalProfit = totalSales - totalExpense;
  const prevTotalProfit = prevTotalSales - prevTotalExpense;
  const profitYoY = prevTotalProfit ? ((totalProfit - prevTotalProfit) / Math.abs(prevTotalProfit)) * 100 : 0;

  const bestMonth = [...yearlySummary].sort((a, b) => b.sales - a.sales)[0];

  const handleExportYearlyReport = () => {
    const data = yearlySummary.map(m => ({
      月份: `${m.month}月`,
      销售额: m.sales,
      实收额: m.income,
      支出额: m.expense,
      利润: m.sales - m.expense
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${selectedYear}年度总结`);
    XLSX.writeFile(wb, `${selectedYear}年度财务报表.xlsx`);
    showToast("年度报表导出成功", "success");
  };

  const handleArchive = async () => {
    const monthToArchive = prompt("请输入要归档的月份 (格式: YYYY-MM)", currentMonth);
    if (!monthToArchive) return;

    if (archives.some(a => a.month === monthToArchive)) {
      showToast("该月份已归档，无法重复操作。", "warning");
      return;
    }

    if (!confirm(`确定要对 ${monthToArchive} 进行月结归档吗？\n归档后该月数据将锁定，不可修改。`)) {
      return;
    }

    try {
      const res = await fetch("/api/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthToArchive })
      });

      if (res.ok) {
        showToast(`${monthToArchive} 归档成功！`, "success");
        fetchArchives();
      } else {
        showToast("归档失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleYearlyClosing = async () => {
    const yearToClose = prompt("请输入要结转的年份 (格式: YYYY)", new Date().getFullYear().toString());
    if (!yearToClose) return;

    if (!confirm(`确定要执行 ${yearToClose} 年度结转吗？\n系统将生成年度财务快照并锁定该年度所有月份。`)) {
      return;
    }

    try {
      // For simplicity, we'll archive each month of that year
      const months = Array.from({ length: 12 }, (_, i) => `${yearToClose}-${(i + 1).toString().padStart(2, '0')}`);
      
      showToast(`正在执行 ${yearToClose} 年度结转...`, "info");
      
      let successCount = 0;
      for (const month of months) {
        if (archives.some(a => a.month === month)) continue;
        
        const res = await fetch("/api/archives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month })
        });
        if (res.ok) successCount++;
      }

      showToast(`${yearToClose} 年度结转完成，锁定 ${successCount} 个月份。`, "success");
      fetchArchives();
    } catch (err) {
      showToast("年度结转失败", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center text-indigo-600 dark:text-indigo-400">
            <ArchiveIcon className="mr-3" size={28} />
            <h3 className="text-2xl font-bold">财务结转与归档</h3>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleYearlyClosing}
              className="bg-amber-600 dark:bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-amber-700 dark:hover:bg-amber-600 transition-all flex items-center shadow-lg shadow-amber-100 dark:shadow-none"
            >
              <Calendar size={18} className="mr-2" />
              年度结转
            </button>
            <button 
              onClick={handleArchive}
              className="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex items-center shadow-lg shadow-indigo-100 dark:shadow-none"
            >
              <Lock size={18} className="mr-2" />
              执行月结
            </button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 mb-8">
          <div className="flex items-start">
            <AlertCircle className="text-amber-500 dark:text-amber-400 mr-3 mt-0.5" size={20} />
            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">结转说明：</p>
              <p>1. **月结归档**：锁定指定月份数据，变为只读状态。</p>
              <p>2. **年度结转**：批量锁定该年度所有未归档月份，并生成年度财务汇总快照。</p>
              <p>3. 建议在每年 1 月对上一年度进行最终核对并执行年度结转。</p>
            </div>
          </div>
        </div>

        <h4 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">已归档记录</h4>
        <div className="space-y-3">
          {archives.map((archive) => (
            <div key={archive.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mr-4">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{archive.month} 财务月报</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center mt-0.5">
                    <Calendar size={12} className="mr-1" />
                    归档时间: {new Date(archive.archived_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                <Download size={18} />
              </button>
            </div>
          ))}
          {archives.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 italic">
              暂无归档记录
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="mr-3" size={24} />
            <h3 className="text-xl font-bold">年度财务概览 ({selectedYear})</h3>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleExportYearlyReport}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center"
            >
              <Download size={16} className="mr-2" />
              导出年度报表
            </button>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm dark:text-slate-100"
            >
              {[...Array(5)].map((_, i) => {
                const y = (new Date().getFullYear() - i).toString();
                return <option key={y} value={y}>{y} 年</option>;
              })}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold mb-1">年度总销售</div>
            <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
              ¥ {totalSales.toLocaleString()}
            </div>
            {salesYoY !== 0 && (
              <div className={cn("text-[10px] font-bold mt-1", salesYoY > 0 ? "text-emerald-600" : "text-rose-600")}>
                YoY {salesYoY > 0 ? "↑" : "↓"} {Math.abs(salesYoY).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold mb-1">年度总实收</div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
              ¥ {yearlySummary.reduce((acc, cur) => acc + cur.income, 0).toLocaleString()}
            </div>
          </div>
          <div className="p-6 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800">
            <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold mb-1">年度总支出</div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">
              ¥ {totalExpense.toLocaleString()}
            </div>
            {expenseYoY !== 0 && (
              <div className={cn("text-[10px] font-bold mt-1", expenseYoY < 0 ? "text-emerald-600" : "text-rose-600")}>
                YoY {expenseYoY > 0 ? "↑" : "↓"} {Math.abs(expenseYoY).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold mb-1">最佳月份</div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
              {bestMonth ? `${bestMonth.month}月` : "-"}
            </div>
            {bestMonth && (
              <div className="text-[10px] text-amber-600/70 font-bold mt-1">
                产值 ¥{bestMonth.sales.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold text-[10px] border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">月份</th>
                <th className="px-4 py-3 text-right">销售额</th>
                <th className="px-4 py-3 text-right">实收额</th>
                <th className="px-4 py-3 text-right">支出额</th>
                <th className="px-4 py-3 text-right">毛利 (销售-支出)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {yearlySummary.map((m) => (
                <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-bold dark:text-slate-200">{m.month}月</td>
                  <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">¥{m.sales.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-500">¥{m.income.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-500">¥{m.expense.toLocaleString()}</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-mono font-bold",
                    m.sales - m.expense >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    ¥{(m.sales - m.expense).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
