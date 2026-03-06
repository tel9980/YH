import React, { useState, useEffect } from "react";
import { formatCurrency, cn } from "../lib/utils";
import { History, ArrowUpRight, ArrowDownLeft, Wallet, Search } from "lucide-react";
import { useToast } from "./Toast";

interface JournalEntry {
  date: string;
  notes: string;
  amount: number;
  type: 'in' | 'out';
}

export default function CashJournal() {
  const { showToast } = useToast();
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [journalRes, methodsRes] = await Promise.all([
        fetch(`/api/cash-journal${selectedMethod ? `?method=${selectedMethod}` : ''}`),
        fetch("/api/payment-methods")
      ]);
      const journalData = await journalRes.json();
      const methodsData = await methodsRes.json();
      setJournal(journalData);
      setMethods(methodsData);
    } catch (e) {
      showToast("加载数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMethod]);

  let currentBalance = 0;
  const journalWithBalance = journal.map(entry => {
    if (entry.type === 'in') currentBalance += entry.amount;
    else currentBalance -= entry.amount;
    return { ...entry, balance: currentBalance };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-emerald-600 dark:text-emerald-400">
          <History className="mr-3" size={28} />
          <h3 className="text-2xl font-bold">出纳日记账 (Cash & Bank Journal)</h3>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold"
          >
            <option value="">全部账户 (All Accounts)</option>
            {methods.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold mb-1">本期收入</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
            {formatCurrency(journal.filter(e => e.type === 'in').reduce((acc, cur) => acc + cur.amount, 0))}
          </div>
        </div>
        <div className="p-6 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800">
          <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold mb-1">本期支出</div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">
            {formatCurrency(journal.filter(e => e.type === 'out').reduce((acc, cur) => acc + cur.amount, 0))}
          </div>
        </div>
        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold mb-1">期末余额</div>
          <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
            {formatCurrency(currentBalance)}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                <th className="px-6 py-4">日期</th>
                <th className="px-6 py-4">摘要/备注</th>
                <th className="px-6 py-4 text-right">收入 (借)</th>
                <th className="px-6 py-4 text-right">支出 (贷)</th>
                <th className="px-6 py-4 text-right">余额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {journalWithBalance.reverse().map((entry, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{entry.date}</td>
                  <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-bold">{entry.notes || '-'}</td>
                  <td className="px-6 py-4 text-sm text-right font-mono text-emerald-600">
                    {entry.type === 'in' ? formatCurrency(entry.amount) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-mono text-rose-600">
                    {entry.type === 'out' ? formatCurrency(entry.amount) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-mono font-black dark:text-slate-100">
                    {formatCurrency(entry.balance)}
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
