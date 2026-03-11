import React, { useState, useEffect, useRef } from "react";
import { formatCurrency, cn } from "../lib/utils";
import { Plus, Trash2, Save, X, Calculator, Calendar, FileText, BookTemplate, Search, Printer, Paperclip, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import PrintPreview from "./Reports/PrintPreview";

interface Account {
  id: string;
  name: string;
  auxiliary_types?: { type: string; required: boolean }[];
}

interface VoucherLine {
  account_id: string;
  debit: number;
  credit: number;
  auxiliary_data?: {
    customer_id?: number;
    supplier_id?: number;
    department_id?: number;
    project_id?: number;
    inventory_id?: number;
  };
  notes?: string;
}

interface VoucherTemplate {
  id: number;
  name: string;
  description: string;
  voucher_type: string;
}

export default function ManualVoucherEntry({ onComplete }: { onComplete: () => void }) {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNo, setVoucherNo] = useState(`记-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-001`);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>([
    { account_id: "", debit: 0, credit: 0, auxiliary_data: {} },
    { account_id: "", debit: 0, credit: 0, auxiliary_data: {} }
  ]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState<{ [key: number]: string }>({});
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Insert') {
        e.preventDefault();
        addLine();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lines, date, voucherNo, notes]);

  useEffect(() => {
    // Load accounts, templates, customers, and suppliers
    Promise.all([
      fetch("/api/v7/accounts").then(res => res.json()),
      fetch("/api/v7/voucher-templates").then(res => res.json()).catch(() => []),
      fetch("/api/customers").then(res => res.json()).catch(() => []),
      fetch("/api/suppliers").then(res => res.json()).catch(() => [])
    ]).then(([accountsData, templatesData, customersData, suppliersData]) => {
      setAccounts(accountsData);
      setTemplates(templatesData);
      setCustomers(customersData);
      setSuppliers(suppliersData);
    });
  }, []);

  const addLine = () => setLines([...lines, { account_id: "", debit: 0, credit: 0, auxiliary_data: {} }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  
  const updateLine = (idx: number, field: keyof VoucherLine, value: any) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    
    // Auto-balance feature: if current line is last line and unbalanced, 
    // suggest the balancing amount for the other side if current side is 0
    if (idx === lines.length - 1 && lines.length > 1) {
      const prevDebit = lines.slice(0, -1).reduce((acc, cur) => acc + (Number(cur.debit) || 0), 0);
      const prevCredit = lines.slice(0, -1).reduce((acc, cur) => acc + (Number(cur.credit) || 0), 0);
      
      if (field === "debit" && Number(value) > 0 && newLines[idx].credit === 0) {
        // user just entered debit, but we want the TOTAL to balance
      }
    }
    setLines(newLines);
  };

  const autoBalance = (idx: number) => {
    const currentLines = [...lines];
    const totalD = currentLines.reduce((acc, cur, i) => i === idx ? acc : acc + (Number(cur.debit) || 0), 0);
    const totalC = currentLines.reduce((acc, cur, i) => i === idx ? acc : acc + (Number(cur.credit) || 0), 0);
    
    const diff = totalC - totalD;
    if (diff > 0) {
      currentLines[idx] = { ...currentLines[idx], debit: Number(diff.toFixed(2)), credit: 0 };
    } else if (diff < 0) {
      currentLines[idx] = { ...currentLines[idx], debit: 0, credit: Number(Math.abs(diff).toFixed(2)) };
    }
    setLines(currentLines);
  };

  const updateAuxiliaryData = (idx: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[idx] = {
      ...newLines[idx],
      auxiliary_data: {
        ...newLines[idx].auxiliary_data,
        [field]: value
      }
    };
    setLines(newLines);
  };

  // Smart account search - supports code, name, and pinyin
  const filterAccounts = (searchTerm: string) => {
    if (!searchTerm) return accounts;
    const term = searchTerm.toLowerCase();
    return accounts.filter(acc => 
      acc.id.toLowerCase().includes(term) ||
      acc.name.toLowerCase().includes(term)
    );
  };

  // Apply template
  const applyTemplate = async (templateId: number) => {
    try {
      const res = await fetch("/api/v7/voucher-templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          data: { amount: 0 }, // User will fill in amounts
          date,
          notes
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.valid && result.voucher) {
          setLines(result.voucher.lines.map((line: any) => ({
            ...line,
            auxiliary_data: line.auxiliary_data || {}
          })));
          setNotes(result.voucher.notes || notes);
          showToast("模板已应用", "success");
          setShowTemplates(false);
        }
      }
    } catch (e) {
      showToast("应用模板失败", "error");
    }
  };

  // Get account by ID
  const getAccount = (accountId: string): Account | undefined => {
    return accounts.find(acc => acc.id === accountId);
  };

  // Check if account requires auxiliary data
  const requiresAuxiliary = (accountId: string, type: string): boolean => {
    const account = getAccount(accountId);
    if (!account || !account.auxiliary_types) return false;
    return account.auxiliary_types.some(aux => aux.type === type && aux.required);
  };

  const totalDebit = lines.reduce((acc, cur) => acc + (Number(cur.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, cur) => acc + (Number(cur.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/system/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAttachmentUrl(data.url);
        showToast("附件上传成功", "success");
      }
    } catch (e) {
      showToast("上传失败", "error");
    } finally {
      setIsUploading(false);
    }
  };

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
        body: JSON.stringify({ 
          date, 
          voucher_no: voucherNo, 
          notes, 
          lines,
          attachment_url: attachmentUrl 
        })
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
        <div className="flex items-center space-x-2">
          {templates.length > 0 && (
            <button 
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <BookTemplate size={16} className="mr-1" />
              选择模板
            </button>
          )}
          <button onClick={onComplete} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Template Selection */}
      {showTemplates && templates.length > 0 && (
        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-3">选择凭证模板</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                className="text-left p-3 bg-white dark:bg-slate-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors border border-purple-100 dark:border-purple-800"
              >
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{template.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{template.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
            <Paperclip size={12} className="mr-1" /> 原始附件
          </label>
          <div className="flex items-center space-x-2">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            {attachmentUrl ? (
              <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800 w-full overflow-hidden">
                <span className="text-xs text-emerald-600 truncate flex-1">{attachmentUrl.split('/').pop()}</span>
                <button onClick={() => setAttachmentUrl(null)} className="text-rose-500 hover:text-rose-700">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center justify-center px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 text-sm"
              >
                {isUploading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
                上传附件
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mb-8">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-4 w-1/4">会计科目</th>
              <th className="px-4 py-4 w-1/6">辅助核算</th>
              <th className="px-4 py-4 text-right">借方金额 (Debit)</th>
              <th className="px-4 py-4 text-right">贷方金额 (Credit)</th>
              <th className="px-4 py-4 text-center w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {lines.map((line, idx) => {
              const account = getAccount(line.account_id);
              const needsCustomer = requiresAuxiliary(line.account_id, 'customer');
              const needsSupplier = requiresAuxiliary(line.account_id, 'supplier');
              
              return (
                <tr key={idx} className="group">
                  <td className="px-2 py-3 align-top">
                    {/* Smart Account Search */}
                    <div className="relative">
                      <input
                        type="text"
                        value={accountSearchTerm[idx] !== undefined ? accountSearchTerm[idx] : (account?.id || "")}
                        onChange={e => {
                          setAccountSearchTerm({ ...accountSearchTerm, [idx]: e.target.value });
                        }}
                        onFocus={() => setActiveLineIdx(idx)}
                        onBlur={() => {
                          // Delay clearing so click works
                          setTimeout(() => {
                            if (activeLineIdx === idx) setActiveLineIdx(null);
                          }, 200);
                        }}
                        placeholder="搜索编码/名称..."
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      {activeLineIdx === idx && (accountSearchTerm[idx] || "") !== "" && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                          {filterAccounts(accountSearchTerm[idx]).slice(0, 10).map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                updateLine(idx, "account_id", acc.id);
                                setAccountSearchTerm({ ...accountSearchTerm, [idx]: acc.id });
                                setActiveLineIdx(null);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm border-b border-slate-50 dark:border-slate-800 last:border-0"
                            >
                              <div className="font-mono text-indigo-600 font-bold">{acc.id}</div>
                              <div className="text-slate-700 dark:text-slate-300 text-xs">{acc.name}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    {/* Auxiliary Data Inputs */}
                    <div className="space-y-1">
                      {needsCustomer && (
                        <select
                          value={line.auxiliary_data?.customer_id || ""}
                          onChange={e => updateAuxiliaryData(idx, "customer_id", parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">选择客户...</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                      {needsSupplier && (
                        <select
                          value={line.auxiliary_data?.supplier_id || ""}
                          onChange={e => updateAuxiliaryData(idx, "supplier_id", parseInt(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">选择供应商...</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                      {!needsCustomer && !needsSupplier && (
                        <span className="text-xs text-slate-400 italic">无</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="relative group/input">
                      <input 
                        type="number" 
                        value={line.debit || ""}
                        onChange={e => updateLine(idx, "debit", e.target.value)}
                        onDoubleClick={() => autoBalance(idx)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-600"
                      />
                      <button 
                        onClick={() => autoBalance(idx)}
                        title="双击或点击此按钮自动平衡"
                        className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/input:opacity-100 transition-opacity"
                      >
                        <Calculator size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="relative group/input">
                      <input 
                        type="number" 
                        value={line.credit || ""}
                        onChange={e => updateLine(idx, "credit", e.target.value)}
                        onDoubleClick={() => autoBalance(idx)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none text-rose-600"
                      />
                      <button 
                        onClick={() => autoBalance(idx)}
                        title="双击或点击此按钮自动平衡"
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover/input:opacity-100 transition-opacity"
                      >
                        <Calculator size={12} />
                      </button>
                    </div>
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
              );
            })}
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
          onClick={() => setShowPrintPreview(true)}
          className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center"
        >
          <Printer size={18} className="mr-2" />
          打印预览
        </button>
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

      {showPrintPreview && (
        <PrintPreview 
          reportType="voucher"
          reportData={{
            date,
            voucher_no: voucherNo,
            notes,
            lines: lines.map(l => ({
              ...l,
              account_name: getAccount(l.account_id)?.name,
              auxiliary_name: l.auxiliary_data?.customer_id ? customers.find(c => c.id === l.auxiliary_data.customer_id)?.name :
                              l.auxiliary_data?.supplier_id ? suppliers.find(s => s.id === l.auxiliary_data.supplier_id)?.name : null
            })),
            total_debit: totalDebit,
            total_credit: totalCredit
          }}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
