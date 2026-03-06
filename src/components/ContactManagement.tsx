import React, { useState, useEffect, useRef } from "react";
import { Customer, Supplier } from "@/src/types";
import { Users, Truck, Trash2, Search, Plus, FileUp, ShieldAlert, Edit2, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "./Toast";
import { formatCurrency } from "@/src/lib/utils";

export default function ContactManagement() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">("customers");
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [newPinyin, setNewPinyin] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLimit, setEditLimit] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    fetch("/api/customers").then(res => res.json()).then(setCustomers);
    fetch("/api/suppliers").then(res => res.json()).then(setSuppliers);
  };

  useEffect(fetchData, []);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let successCount = 0;
        for (const row of data) {
          const name = row["名称"] || row["Name"] || row["客户名称"] || row["供应商名称"];
          const pinyin = row["拼音"] || row["Pinyin"] || "";
          if (name) {
            const res = await fetch(`/api/${activeTab}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, pinyin })
            });
            if (res.ok) successCount++;
          }
        }
        showToast(`成功导入 ${successCount} 条数据`, "success");
        fetchData();
      } catch (err) {
        showToast("导入失败，请检查文件格式", "error");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      const res = await fetch(`/api/${activeTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, pinyin: newPinyin })
      });
      if (res.ok) {
        showToast("添加成功", "success");
        setNewName("");
        setNewPinyin("");
        fetchData();
      } else {
        showToast("添加失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleDelete = async (type: "customers" | "suppliers", id: number) => {
    if (!confirm("确定要删除该往来单位吗？如果该单位已有订单或收支记录，删除可能会导致数据关联问题。")) return;
    try {
      const res = await fetch(`/api/${type}/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("删除成功", "success");
        fetchData();
      } else {
        showToast("删除失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleUpdateLimit = async (id: number) => {
    try {
      const res = await fetch(`/api/customers/${id}/credit-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_limit: editLimit })
      });
      if (res.ok) {
        showToast("信用额度已更新", "success");
        setEditingId(null);
        fetchData();
      }
    } catch (e) {
      showToast("更新失败", "error");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.pinyin && c.pinyin.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 transition-colors duration-300">
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "customers" 
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users size={16} className="mr-2" />
            客户管理
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "suppliers" 
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Truck size={16} className="mr-2" />
            供应商管理
          </button>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={`搜索${activeTab === "customers" ? "客户" : "供应商"}名称...`}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold dark:text-slate-100">快速添加{activeTab === "customers" ? "客户" : "供应商"}</h3>
          <div className="flex space-x-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              className="hidden" 
              accept=".xlsx, .xls" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <FileUp size={14} className="mr-1.5" />
              Excel 导入
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mb-4">提示：Excel 需包含“名称”列。支持批量导入客户或供应商。</p>
        <form onSubmit={handleAdd} className="flex gap-4">
          <input 
            type="text" 
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={`输入新${activeTab === "customers" ? "客户" : "供应商"}名称...`}
            className="flex-[2] px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
          />
          <input 
            type="text" 
            value={newPinyin}
            onChange={e => setNewPinyin(e.target.value)}
            placeholder="拼音首字母 (可选)"
            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 uppercase"
          />
          <button 
            type="submit"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus size={18} className="mr-2" />
            添加
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">名称</th>
              <th className="px-6 py-4 font-medium">拼音</th>
              {activeTab === "customers" && <th className="px-6 py-4 font-medium text-right">信用额度</th>}
              <th className="px-6 py-4 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(activeTab === "customers" ? filteredCustomers : filteredSuppliers).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{item.name}</td>
                <td className="px-6 py-4 text-xs text-slate-400 uppercase font-mono">{item.pinyin || "-"}</td>
                {activeTab === "customers" && (
                  <td className="px-6 py-4 text-sm text-right font-mono">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-end space-x-2">
                        <input 
                          type="number"
                          value={editLimit}
                          onChange={e => setEditLimit(Number(e.target.value))}
                          className="w-24 px-2 py-1 bg-white dark:bg-slate-800 border border-indigo-300 rounded outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleUpdateLimit(item.id)} className="text-emerald-600"><Check size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end group">
                        <span className={item.credit_limit > 0 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400"}>
                          {item.credit_limit > 0 ? formatCurrency(item.credit_limit) : "未设置"}
                        </span>
                        <button 
                          onClick={() => { setEditingId(item.id); setEditLimit(item.credit_limit); }}
                          className="ml-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleDelete(activeTab, item.id)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {(activeTab === "customers" ? filteredCustomers : filteredSuppliers).length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
