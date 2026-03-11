import React, { useState, useEffect } from "react";
import { formatCurrency, cn } from "../lib/utils";
import { FileText, Printer, Search, Calendar, User, CreditCard, Plus, ArrowLeft, CheckCircle, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "./Toast";
import ManualVoucherEntry from "./ManualVoucherEntry";
import PrintPreview from "./Reports/PrintPreview";

interface VoucherLine {
  id: number;
  account_id: string;
  debit: number;
  credit: number;
  auxiliary_data?: any;
  notes?: string;
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
  status?: string;
  voucher_type?: string;
  approved_by?: string;
  approved_at?: string;
  voucher_no?: string;
  attachment_url?: string;
}

export default function Vouchers() {
  const { showToast } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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
    (v.entity || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.notes || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.id.toString().includes(searchTerm)
  );

  const approveVoucher = async (voucherId: number) => {
    try {
      const res = await fetch(`/api/v7/vouchers/${voucherId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "管理员" })
      });
      
      if (res.ok) {
        showToast("凭证已审核", "success");
        fetchVouchers();
      } else {
        const err = await res.json();
        showToast(err.error || "审核失败", "error");
      }
    } catch (e) {
      showToast("审核失败", "error");
    }
  };

  const reverseVoucher = async (voucherId: number) => {
    const reason = prompt("请输入冲销原因:", "凭证录入错误");
    if (reason === null) return;

    try {
      const res = await fetch(`/api/v7/vouchers/${voucherId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "管理员", reason })
      });
      
      if (res.ok) {
        showToast("凭证已冲销并生成红字凭证", "success");
        fetchVouchers();
      } else {
        const err = await res.json();
        showToast(err.error || "冲销失败", "error");
      }
    } catch (e) {
      showToast("冲销失败", "error");
    }
  };

  const deleteVoucher = async (voucherId: number) => {
    if (!confirm("确定要删除这张未审核凭证吗？")) return;
    
    try {
      const res = await fetch(`/api/v7/vouchers/${voucherId}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        showToast("凭证已删除", "success");
        fetchVouchers();
      } else {
        const err = await res.json();
        showToast(err.error || "删除失败", "error");
      }
    } catch (e) {
      showToast("删除失败", "error");
    }
  };

  const renderVoucherDetail = (v: Voucher) => {
    const isApproved = v.status === 'approved';
    const isReversed = v.status === 'reversed';
    const isReverseVoucher = v.voucher_type === 'reverse';
    
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl border-4 border-double border-slate-200 dark:border-slate-800 max-w-4xl mx-auto font-serif relative overflow-hidden">
        {isReversed && (
          <div className="absolute top-10 right-10 border-4 border-rose-500 text-rose-500 px-4 py-2 rounded-lg font-bold text-xl rotate-12 opacity-50 select-none">
            已冲销
          </div>
        )}
        {isReverseVoucher && (
          <div className="absolute top-10 right-10 border-4 border-rose-500 text-rose-500 px-4 py-2 rounded-lg font-bold text-xl rotate-12 opacity-50 select-none">
            冲销凭证 (红字)
          </div>
        )}
        
        <div className="text-center border-b-2 border-slate-900 dark:border-slate-700 pb-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1"></div>
            <h2 className="text-3xl font-black tracking-[0.5em] text-slate-900 dark:text-slate-100 uppercase flex-1 text-center">记 账 凭 证</h2>
            <div className="flex-1 flex justify-end">
              {isApproved && !isReversed && (
                <span className="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                  <CheckCircle size={14} className="mr-1" />
                  已审核
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-4 text-sm font-bold text-slate-500">
            <span>日期: {v.date}</span>
            <span>凭证编号: {v.entity}</span>
          </div>
        </div>

        <table className="w-full border-collapse border-2 border-slate-900 dark:border-slate-700">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm w-1/3">摘要</th>
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm w-1/3">会计科目</th>
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm text-right w-1/6">借方金额</th>
              <th className="border-2 border-slate-900 dark:border-slate-700 p-2 text-sm text-right w-1/6">贷方金额</th>
            </tr>
          </thead>
          <tbody>
            {v.lines?.map((line, idx) => (
              <tr key={idx} className="h-12">
                <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm align-top">
                  {line.notes || v.notes}
                </td>
                <td className="border-2 border-slate-900 dark:border-slate-700 p-4 text-sm">
                  <div className={cn("font-bold", line.credit > 0 && "pl-8")}>{line.account_id}</div>
                </td>
                <td className={cn(
                  "border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono font-bold",
                  line.debit < 0 && "text-rose-600"
                )}>
                  {line.debit !== 0 ? formatCurrency(line.debit) : ""}
                </td>
                <td className={cn(
                  "border-2 border-slate-900 dark:border-slate-700 p-4 text-sm text-right font-mono font-bold",
                  line.credit < 0 && "text-rose-600"
                )}>
                  {line.credit !== 0 ? formatCurrency(line.credit) : ""}
                </td>
              </tr>
            ))}
            {/* 填充空白行以保持美观 */}
            {Array.from({ length: Math.max(0, 5 - (v.lines?.length || 0)) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-12">
                <td className="border-2 border-slate-900 dark:border-slate-700"></td>
                <td className="border-2 border-slate-900 dark:border-slate-700"></td>
                <td className="border-2 border-slate-900 dark:border-slate-700"></td>
                <td className="border-2 border-slate-900 dark:border-slate-700"></td>
              </tr>
            ))}
            <tr className="font-bold bg-slate-50 dark:bg-slate-800 h-12">
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
          <span>审核: {v.approved_by || '_________'}</span>
          <span>制单: {isReverseVoucher ? '系统冲销' : '管理员'}</span>
        </div>

        {v.attachment_url && (
          <div className="mt-6 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 no-print">
            <div className="text-xs font-bold text-slate-400 mb-2 flex items-center">
              <Paperclip size={12} className="mr-1" /> 关联附件 (Voucher Attachment)
            </div>
            <a 
              href={v.attachment_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <FileText size={14} className="mr-2" />
              查看原始单据: {v.attachment_url.split('/').pop()}
            </a>
          </div>
        )}

        <div className="mt-10 flex justify-center space-x-4 no-print">
          {!isApproved && !isReversed && (
            <>
              <button 
                onClick={() => approveVoucher(v.id)}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-xl"
              >
                <CheckCircle size={20} className="mr-2" />
                审核凭证
              </button>
              <button 
                onClick={() => deleteVoucher(v.id)}
                className="flex items-center px-6 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all"
              >
                <Trash2 size={20} className="mr-2" />
                删除凭证
              </button>
            </>
          )}
          {isApproved && !isReversed && !isReverseVoucher && (
            <button 
              onClick={() => reverseVoucher(v.id)}
              className="flex items-center px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-xl"
            >
              <RotateCcw size={20} className="mr-2" />
              冲销 (红字)
            </button>
          )}
          <button 
            onClick={() => setShowPrintPreview(true)}
            className="flex items-center px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl"
          >
            <Printer size={20} className="mr-2" />
            专业打印预览
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
                  <th className="px-6 py-4 text-center">状态</th>
                  <th className="px-6 py-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVouchers.map((v) => (
                  <tr key={`${v.type}-${v.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold",
                          v.voucher_type === 'reverse' ? "bg-rose-100 text-rose-700" :
                          v.status === 'reversed' ? "bg-slate-100 text-slate-500 line-through" :
                          "bg-indigo-100 text-indigo-700"
                        )}>
                          {v.entity}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{v.date}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{v.notes || '无备注'}</div>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-sm text-right font-mono font-black",
                      v.amount < 0 ? "text-rose-600" : "text-slate-900 dark:text-slate-100"
                    )}>
                      {formatCurrency(v.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        v.status === 'approved' ? "bg-emerald-100 text-emerald-600" :
                        v.status === 'reversed' ? "bg-rose-100 text-rose-600" :
                        "bg-amber-100 text-amber-600"
                      )}>
                        {v.status === 'approved' ? '已审核' : v.status === 'reversed' ? '已冲销' : '待审核'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setSelectedVoucher(v)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <FileText size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPrintPreview && selectedVoucher && (
        <PrintPreview 
          reportType="voucher"
          reportData={{
            ...selectedVoucher,
            voucher_no: selectedVoucher.entity,
            total_debit: selectedVoucher.amount,
            total_credit: selectedVoucher.amount
          }}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
