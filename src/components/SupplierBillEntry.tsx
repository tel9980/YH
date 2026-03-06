import React, { useState, useEffect } from "react";
import { Supplier } from "@/src/types";
import { Save, Truck } from "lucide-react";
import { useToast } from "./Toast";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

export default function SupplierBillEntry() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+s": () => handleSubmit(new Event('submit') as any),
  });

  useEffect(() => {
    fetch("/api/suppliers").then(res => res.json()).then(setSuppliers);
    fetch("/api/categories?type=expense").then(res => res.json()).then(data => {
      setCategories(data);
      if (data.length > 0) setCategory(data[0].name);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e.preventDefault) e.preventDefault();
    if (!supplier || amount <= 0) {
      showToast("请填写完整供应商和金额", "warning");
      return;
    }
    try {
      const res = await fetch("/api/supplier-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, supplier, category, amount, notes })
      });
      if (res.ok) {
        showToast("应付账单保存成功！", "success");
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
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center text-indigo-600 dark:text-indigo-400">
          <Truck className="mr-2" size={24} />
          <h3 className="text-xl font-bold">应付账单录入 (采购/委外)</h3>
        </div>
        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded border border-slate-200 dark:border-slate-700">Ctrl+S 保存</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">分类</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            >
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">账单金额</label>
            <input 
              type="number" 
              step="0.01"
              value={amount} 
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">备注</label>
          <textarea 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 dark:text-slate-100"
            placeholder="采购详情或备注..."
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          <Save size={20} className="mr-2" />
          保存账单
        </button>
      </form>
    </div>
  );
}
