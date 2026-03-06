import React, { useState, useEffect } from "react";
import { Supplier } from "@/src/types";
import { Save, CreditCard } from "lucide-react";
import { useToast } from "./Toast";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

interface Account {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function ExpenseEntry() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+s": () => handleSubmit(new Event('submit') as any),
  });

  useEffect(() => {
    fetch("/api/suppliers").then(res => res.json()).then(setSuppliers);
    fetch("/api/accounts").then(res => res.json()).then(data => {
      setAccounts(data);
      if (data.length > 0) setAccountId(data.find(a => a.parent_id)?.id || "");
    });
    fetch("/api/payment-methods").then(res => res.json()).then(data => {
      setMethods(data);
      if (data.length > 0) setMethod(data[0].name);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e.preventDefault) e.preventDefault();
    if (!supplier || amount <= 0 || !accountId) {
      showToast("请填写完整会计科目、供应商和金额", "warning");
      return;
    }
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, account_id: accountId, supplier, amount, method, notes })
      });
      if (res.ok) {
        showToast("支出记录保存成功！", "success");
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
        <div className="flex items-center text-rose-600 dark:text-rose-400">
          <CreditCard className="mr-2" size={24} />
          <h3 className="text-xl font-bold">各项支出录入</h3>
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">会计科目</label>
              <select 
                value={accountId} 
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
              >
                <option value="">请选择科目</option>
                {accounts.filter(acc => acc.parent_id).map(acc => ( // 只显示末级科目
                  <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">供应商</label>
              <input 
                list="suppliers-list"
                value={supplier} 
                onChange={e => setSupplier(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                placeholder="选择或输入供应商"
              />
              <datalist id="suppliers-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">支出金额</label>
              <input 
                type="number" 
                step="0.01"
                value={amount} 
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">支付方式</label>
              <select 
                value={method} 
                onChange={e => setMethod(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
              >
                {methods.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
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
            placeholder="支出详情说明..."
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-rose-600 dark:bg-rose-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-rose-700 dark:hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 dark:shadow-none flex items-center justify-center"
        >
          <CreditCard size={24} className="mr-2" />
          保存支出
        </button>
      </form>
    </div>
  );
}
