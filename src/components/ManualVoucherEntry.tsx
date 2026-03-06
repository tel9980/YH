import React, { useState, useEffect } from "react";
import { formatCurrency, cn } from "../lib/utils";
import { Plus, Trash2, Save, X, Calculator, Calendar, FileText } from "lucide-react";
import { useToast } from "./Toast";

interface Account {
  id: string;
  name: string;
}

interface VoucherLine {
  account_id: string;
  debit: number;
  credit: number;
}

export default function ManualVoucherEntry({ onComplete }: { onComplete: () => void }) {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNo, setVoucherNo] = useState(`记-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-001`);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>([
    { account_id: "", debit: 0, credit: 0 },
    { account_id: "", debit: 0, credit: 0 }
  ]);

  useEffect(() => {
    fetch("/api/accounts").then(res => res.json()).then(setAccounts);
  }, []);

  const addLine = () => setLines([...lines, { account_id: "", debit: 0, credit: 0 }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  
  const updateLine = (idx: number, field: keyof VoucherLine, value: any) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    setLines(newLines);
  };

  const totalDebit = lines.reduce((acc, cur) => acc + (Number(cur.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, cur) => acc + (Number(cur.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = async () => {
    if (!isBalanced) {
      showToast("凭证借贷不平衡或金额为零", "error");
      return;
    }
    if (lines.some(l => !l.account_id)) {
      showToast("请选择所有行的科目", "error");
      return;
    }

    try {
      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, voucher_no: voucherNo, notes, lines })
      });
      if (res.ok) {
        showToast("记账凭证已保存", "success");
        onComplete();
      } else {
        const err = await res.json();
        showToast(err.error || "保存失败", "error");
      }
    } catch (e) {
      showToast("保存失败", "error");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold flex items-center">
          <Calculator className="mr-2 text-indigo-600" />
          手工记账凭证录入
        </h3>
        <button onClick={onComplete} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
            <Calendar size={12} className="mr-1" /> 凭证日期
          </label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
            <FileText size={12} className="mr-1" /> 凭证字号
          </label>
          <input 
            type="text" 
            value={voucherNo} 
            onChange={e => setVoucherNo(e.target.value)}
            placeholder="记-202403-001"
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
             摘要
          </label>
          <input 
            type="text" 
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            placeholder="输入凭证摘要..."
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto mb-8">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-4 w-1/3">会计科目</th>
              <th className="px-4 py-4 text-right">借方金额 (Debit)</th>
              <th className="px-4 py-4 text-right">贷方金额 (Credit)</th>
              <th className="px-4 py-4 text-center w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {lines.map((line, idx) => (
              <tr key={idx} className="group">
                <td className="px-2 py-3">
                  <select 
                    value={line.account_id}
                    onChange={e => updateLine(idx, "account_id", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">选择科目...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-3">
                  <input 
                    type="number" 
                    value={line.debit || ""}
                    onChange={e => updateLine(idx, "debit", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-600"
                  />
                </td>
                <td className="px-2 py-3">
                  <input 
                    type="number" 
                    value={line.credit || ""}
                    onChange={e => updateLine(idx, "credit", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none text-rose-600"
                  />
                </td>
                <td className="px-2 py-3 text-center">
                  <button 
                    onClick={() => removeLine(idx)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
              <td className="px-4 py-4 flex items-center">
                <button onClick={addLine} className="text-xs text-indigo-600 flex items-center hover:underline">
                  <Plus size={14} className="mr-1" /> 添加分录
                </button>
                <span className="ml-auto text-sm">合计 (Total)</span>
              </td>
              <td className="px-4 py-4 text-right font-mono text-indigo-600">{formatCurrency(totalDebit)}</td>
              <td className="px-4 py-4 text-right font-mono text-rose-600">{formatCurrency(totalCredit)}</td>
              <td className="px-4 py-4 text-center">
                {isBalanced ? (
                  <span className="text-[10px] text-emerald-600 uppercase tracking-widest">Balanced ✅</span>
                ) : (
                  <span className="text-[10px] text-rose-500 uppercase tracking-widest italic animate-pulse">Unbalanced ❌</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end space-x-4">
        <button 
          onClick={onComplete}
          className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          取消
        </button>
        <button 
          onClick={handleSubmit}
          className="flex items-center px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          <Save size={18} className="mr-2" />
          保存凭证
        </button>
      </div>
    </div>
  );
}
