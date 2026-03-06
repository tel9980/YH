import React, { useState, useEffect } from "react";
import { Customer } from "@/src/types";
import { Save, Wallet, Info } from "lucide-react";
import { formatCurrency } from "@/src/lib/utils";
import { useToast } from "./Toast";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

export default function IncomeEntry() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState(0);
  const [bank, setBank] = useState("");
  const [notes, setNotes] = useState("");
  const [debt, setDebt] = useState(0);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+s": () => handleSubmit(new Event('submit') as any),
  });

  useEffect(() => {
    fetch("/api/customers").then(res => res.json()).then(setCustomers);
    fetch("/api/payment-methods").then(res => res.json()).then(data => {
      setMethods(data);
      if (data.length > 0) setBank(data[0].name);
    });
  }, []);

  useEffect(() => {
    if (customer) {
      // Simple debt calculation: orders total - incomes total for this customer
      Promise.all([
        fetch("/api/orders").then(res => res.json()),
        fetch("/api/incomes").then(res => res.json())
      ]).then(([ordersData, incomesData]) => {
        const o = (ordersData.orders || ordersData).filter((i: any) => i.customer === customer).reduce((acc: number, cur: any) => acc + cur.total, 0);
        const i = incomesData.filter((i: any) => i.customer === customer).reduce((acc: number, cur: any) => acc + cur.amount, 0);
        setDebt(o - i);
      });
    } else {
      setDebt(0);
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e.preventDefault) e.preventDefault();
    if (!customer || amount <= 0) {
      showToast("请填写完整客户和金额", "warning");
      return;
    }
    try {
      const res = await fetch("/api/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, customer, amount, bank, notes })
      });
      if (res.ok) {
        showToast("收款记录保存成功！", "success");
        setAmount(0);
        setNotes("");
      } else {
        showToast("保存失败，请重试", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center text-emerald-600 dark:text-emerald-400">
          <Wallet className="mr-2" size={24} />
          <h3 className="text-xl font-bold">客户收款录入</h3>
        </div>
        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded border border-slate-200 dark:border-slate-700">Ctrl+S 保存</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">日期</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">客户</label>
              <input 
                list="customers-list"
                value={customer} 
                onChange={e => setCustomer(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                placeholder="选择或输入客户"
              />
              <datalist id="customers-list">
                {customers.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-4">
            {customer && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <div className="text-xs text-amber-600 dark:text-amber-400 uppercase font-medium mb-1 flex items-center">
                  <Info size={12} className="mr-1" />
                  该客户当前欠款
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">{formatCurrency(debt)}</div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">收款金额</label>
              <input 
                type="number" 
                step="0.01"
                value={amount} 
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">银行/支付方式</label>
              <select 
                value={bank} 
                onChange={e => setBank(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
              >
                {methods.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">备注</label>
          <input 
            type="text"
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            placeholder="例如：支付10月加工费、支票号等"
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-emerald-600 dark:bg-emerald-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center"
        >
          <Wallet size={24} className="mr-2" />
          保存收款
        </button>
      </form>
    </div>
  );
}
