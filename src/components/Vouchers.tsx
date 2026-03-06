import React, { useState, useEffect } from "react";
import { formatCurrency, cn } from "../lib/utils";
import { FileText, Printer, Search, Calendar, User, CreditCard, Plus, ArrowLeft } from "lucide-react";
import { useToast } from "./Toast";
import ManualVoucherEntry from "./ManualVoucherEntry";

interface VoucherLine {
  id: number;
  account_id: string;
  debit: number;
  credit: number;
}

interface Voucher {
  id: number;
  date: string;
  entity: string;
  amount: number;
  method: string;
  notes: string;
  type: string;
  debit_account?: string;
  credit_account?: string;
  lines?: VoucherLine[];
}

export default function Vouchers() {
  const { showToast } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vouchers");
      const data = await res.json();
      setVouchers(data);
    } catch (e) {
      showToast("加载凭证失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const filteredVouchers = vouchers.filter(v => 
    v.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.id.toString().includes(searchTerm)
  );

  const renderVoucherDetail = (v: Voucher) => {
    const isManual = v.type === '记账凭证';
    
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl border-4 border-double border-slate-200 dark:border-slate-800 max-w-3xl mx-auto font-serif">
        <div className="text-center border-b-2 border-slate-900 dark:border-slate-700 pb-4 mb-6">
          <h2 className="text-3xl font-black tracking-[0.5em] text-slate-900 dark:text-slate-100 uppercase">{v.type}</h2>
          <div className="flex justify-between mt-4 text-sm font-bold text-slate-500">
            <span>日期: {v.date}</span>
            <span>凭证编号: {isManual ? v.entity : (v.type === '收款凭证' ? '收' : '付') + '-' + v.id.toString().padStart(4, '0')}</span>
          </div>
        </div>

        <table className="w-full border-collapse border-2 border-slate-900 dark:border-slate-700">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm">摘要</th>
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm">会计科目</th>
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm text-right">借方金额</th>
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm text-right">贷方金额</th>
            </tr>
          </thead>
          <tbody>
            {!isManual ? (
              <>
                <tr>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm align-top row-span-2">
                    {v.notes || `收到 ${v.entity} 款项`}
                  </td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm">
                    <div className="font-bold">{v.debit_account}</div>
                  </td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono font-bold">
                    {formatCurrency(v.amount)}
                  </td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono"></td>
                </tr>
                <tr>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm border-l-0">
                    <div className="font-bold pl-8">{v.credit_account}</div>
                  </td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono"></td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono font-bold">
                    {formatCurrency(v.amount)}
                  </td>
                </tr>
              </>
            ) : (
              v.lines?.map((line, idx) => (
                <tr key={idx}>
                  {idx === 0 && (
                    <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm align-top" rowSpan={v.lines?.length}>
                      {v.notes}
                    </td>
                  )}
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm">
                    <div className={cn("font-bold", line.credit > 0 && "pl-8")}>{line.account_id}</div>
                  </td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono font-bold">
                    {line.debit > 0 ? formatCurrency(line.debit) : ""}
                  </td>
                  <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono font-bold">
                    {line.credit > 0 ? formatCurrency(line.credit) : ""}
                  </td>
                </tr>
              ))
            )}
            <tr className="font-bold bg-slate-50 dark:bg-slate-800">
              <td colSpan={2} className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm">合计 (Total):</td>
              <td className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm text-right font-mono">{formatCurrency(v.amount)}</td>
              <td className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm text-right font-mono">{formatCurrency(v.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between mt-8 text-xs font-bold text-slate-600">
          <span>财务主管: _________</span>
          <span>记账: _________</span>
          <span>出纳: _________</span>
          <span>审核: _________</span>
          <span>制单: 小会计AI</span>
        </div>

        <div className="mt-10 flex justify-center no-print">
          <button 
            onClick={() => window.print()}
            className="flex items-center px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl"
          >
            <Printer size={20} className="mr-2" />
            立即打印凭证
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center text-rose-600 dark:text-rose-400">
          <FileText className="mr-3" size={28} />
          <h3 className="text-2xl font-bold">记账凭证 (Accounting Vouchers)</h3>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowManualEntry(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus size={16} className="mr-2" />
            手工凭证录入
          </button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="搜索摘要、单位..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

      {showManualEntry ? (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <ManualVoucherEntry 
            onComplete={() => {
              setShowManualEntry(false);
              fetchVouchers();
            }} 
          />
        </div>
      ) : selectedVoucher ? (
        <div className="animate-in fade-in zoom-in duration-300">
          <button 
            onClick={() => setSelectedVoucher(null)}
            className="mb-4 text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center no-print"
          >
            <ArrowLeft size={16} className="mr-1" /> 返回凭证列表
          </button>
          {renderVoucherDetail(selectedVoucher)}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  <th className="px-6 py-4">凭证字号</th>
                  <th className="px-6 py-4">日期</th>
                  <th className="px-6 py-4">摘要</th>
                  <th className="px-6 py-4 text-right">金额</th>
                  <th className="px-6 py-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVouchers.map((v) => (
                  <tr key={`${v.type}-${v.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold",
                        v.type === '收款凭证' ? "bg-emerald-100 text-emerald-700" : 
                        v.type === '付款凭证' ? "bg-rose-100 text-rose-700" :
                        "bg-indigo-100 text-indigo-700"
                      )}>
                        {v.type === '记账凭证' ? v.entity : (v.type === '收款凭证' ? '收' : '付') + '-' + v.id.toString().padStart(4, '0')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{v.date}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{v.type === '记账凭证' ? '手工凭证' : v.entity}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{v.notes || '无备注'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-black text-slate-900 dark:text-slate-100">
                      {formatCurrency(v.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setSelectedVoucher(v)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
