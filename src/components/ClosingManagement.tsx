import React, { useState, useEffect } from "react";
import { formatCurrency, cn } from "../lib/utils";
import { Lock, Unlock, CheckCircle2, AlertTriangle, Calendar, History, ShieldCheck } from "lucide-react";
import { useToast } from "./Toast";

interface ClosingPeriod {
  month: string;
  closed_at: string;
  status: 'closed' | 'open';
}

export default function ClosingManagement() {
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<ClosingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/closing-periods");
      const data = await res.json();
      setPeriods(data);
    } catch (e) {
      showToast("加载结账记录失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleClose = async () => {
    if (!confirm(`确定要对 ${selectedMonth} 进行财务结账吗？结账后将无法修改该月数据。`)) return;
    try {
      const res = await fetch("/api/closing-periods/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth })
      });
      if (res.ok) {
        showToast(`${selectedMonth} 结账成功`, "success");
        fetchPeriods();
      }
    } catch (e) {
      showToast("结账失败", "error");
    }
  };

  const handleGenerateClosingVouchers = async () => {
    if (!confirm(`确定要为 ${selectedMonth} 自动生成损益结转凭证吗？`)) return;
    try {
      const res = await fetch("/api/generate-closing-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`已生成损益结转凭证`, "success");
      } else {
        showToast(data.message || "生成失败", "warning");
      }
    } catch (e) {
      showToast("生成失败", "error");
    }
  };

  const handleGenerateDepreciation = async () => {
    if (!confirm(`确定要为 ${selectedMonth} 自动计提固定资产折旧吗？`)) return;
    try {
      const res = await fetch("/api/generate-depreciation-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`已计提折旧：${formatCurrency(data.amount)}`, "success");
      } else {
        showToast(data.message || "计提失败", "warning");
      }
    } catch (e) {
      showToast("计提失败", "error");
    }
  };

  const handleReopen = async (month: string) => {
    if (!confirm(`确定要反结账 ${month} 吗？反结账将允许修改该月数据，请谨慎操作。`)) return;
    try {
      const res = await fetch("/api/closing-periods/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month })
      });
      if (res.ok) {
        showToast(`${month} 已重新开放`, "success");
        fetchPeriods();
      }
    } catch (e) {
      showToast("操作失败", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-slate-800 dark:text-slate-100">
          <ShieldCheck className="mr-3 text-indigo-600" size={28} />
          <h3 className="text-2xl font-bold">财务结账管理 (Monthly Closing)</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Closing Action Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h4 className="text-lg font-bold mb-4 flex items-center">
              <Lock size={18} className="mr-2 text-indigo-600" />
              执行月度结账
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">选择结账月份</label>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                <div className="flex items-start">
                  <AlertTriangle className="text-amber-600 mt-0.5 mr-2 shrink-0" size={16} />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    结账是财务管理的严肃环节。结账前请确保本月损益结转与折旧已处理。结账后，系统将**封锁**该月份的所有送货、收付款及支出记录，禁止任何形式的增删改。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleGenerateDepreciation}
                  disabled={periods.some(p => p.month === selectedMonth && p.status === 'closed')}
                  className="py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl font-bold hover:bg-emerald-100 transition-all text-xs border border-emerald-100 dark:border-emerald-800"
                >
                  计提本月折旧
                </button>
                <button 
                  onClick={handleGenerateClosingVouchers}
                  disabled={periods.some(p => p.month === selectedMonth && p.status === 'closed')}
                  className="py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 transition-all text-xs border border-indigo-100 dark:border-indigo-800"
                >
                  生成损益结转
                </button>
              </div>

              <button 
                onClick={handleClose}
                disabled={periods.some(p => p.month === selectedMonth && p.status === 'closed')}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                {periods.some(p => p.month === selectedMonth && p.status === 'closed') ? "该月已结账" : "立即执行结账"}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">结账自检清单</h4>
            <ul className="space-y-3">
              {[
                "所有送货单已核对单价",
                "本月银行流水已核对完毕",
                "所有供应商欠款已入账",
                "固定资产折旧已计提"
              ].map((item, i) => (
                <li key={i} className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                  <CheckCircle2 size={14} className="mr-2 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* History List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center">
              <History size={18} className="mr-2 text-slate-400" />
              <span className="text-sm font-bold text-slate-500">结账历史记录</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="px-6 py-4">会计期间</th>
                    <th className="px-6 py-4">结账时间</th>
                    <th className="px-6 py-4">状态</th>
                    <th className="px-6 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periods.map((p) => (
                    <tr key={p.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{p.month}</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">{new Date(p.closed_at).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold",
                          p.status === 'closed' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {p.status === 'closed' ? "已结账 (封存)" : "已开放 (反结账)"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {p.status === 'closed' ? (
                          <button 
                            onClick={() => handleReopen(p.month)}
                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center justify-center mx-auto"
                          >
                            <Unlock size={14} className="mr-1" />
                            反结账
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">不可用</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {periods.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">暂无结账历史记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
