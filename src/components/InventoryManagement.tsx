import React, { useState, useEffect, useRef } from "react";
import { Package, AlertTriangle, Plus, Minus, History, Save, FileUp, X, ClipboardList, User, Download } from "lucide-react";
import { formatCurrency, cn } from "@/src/lib/utils";
import * as XLSX from "xlsx";
import { InventoryItem, InventoryTransaction, MaterialRequisition } from "@/src/types";
import { useToast } from "./Toast";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

export default function InventoryManagement() {
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [requisitions, setRequisitions] = useState<MaterialRequisition[]>([]);
  const [activeTab, setActiveTab] = useState<"inventory" | "requisitions">("inventory");
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: "", stock: 0, unit: "kg", low_threshold: 100, unit_cost: 0 });
  const [newRequisition, setNewRequisition] = useState({ item_name: "", qty: 0, worker: "", notes: "", date: new Date().toISOString().split('T')[0] });
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustData, setAdjustData] = useState({ delta: 0, type: "入库", notes: "" });
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+s": () => handleAddProduct(new Event('submit') as any),
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      showToast("获取库存失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/inventory/transactions");
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      // Silent error for transactions
    }
  };

  const fetchRequisitions = async () => {
    try {
      const res = await fetch("/api/material-requisitions");
      const data = await res.json();
      setRequisitions(data);
    } catch (err) {
      // Silent error
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchTransactions();
    fetchRequisitions();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    if (e.preventDefault) e.preventDefault();
    if (!newItem.name) {
      showToast("请输入项目名称", "warning");
      return;
    }
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        showToast("库存项目保存成功！", "success");
        setNewItem({ name: "", stock: 0, unit: "kg", low_threshold: 100, unit_cost: 0 });
        fetchInventory();
      } else {
        showToast("保存失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const adjustStock = async (id: number, delta: number, type?: string, notes?: string) => {
    try {
      const res = await fetch(`/api/inventory/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, type, notes })
      });
      if (res.ok) {
        showToast("库存调整成功！", "success");
        fetchInventory();
        fetchTransactions();
        setSelectedItem(null);
      } else {
        showToast("调整失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleAddRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequisition.item_name || !newRequisition.worker || newRequisition.qty <= 0) {
      showToast("请填写完整领料信息", "warning");
      return;
    }
    try {
      const res = await fetch("/api/material-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRequisition)
      });
      if (res.ok) {
        showToast("领料记录已保存，库存已自动扣除", "success");
        setNewRequisition({ item_name: "", qty: 0, worker: "", notes: "", date: new Date().toISOString().split('T')[0] });
        fetchInventory();
        fetchTransactions();
        fetchRequisitions();
      }
    } catch (e) {
      showToast("保存失败", "error");
    }
  };

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
        const data = XLSX.utils.sheet_to_json(ws);
        
        const mappedData = data.map((row: any) => ({
          name: row["名称"] || row["name"],
          stock: parseFloat(row["库存"] || row["stock"]) || 0,
          unit: row["单位"] || row["unit"] || "kg",
          low_threshold: parseFloat(row["预警线"] || row["low_threshold"]) || 100,
          unit_cost: parseFloat(row["成本单价"] || row["unit_cost"]) || 0
        }));

        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "inventory", data: mappedData })
        });

        if (res.ok) {
          showToast("导入成功！", "success");
          fetchInventory();
        } else {
          showToast("导入失败", "error");
        }
      } catch (err) {
        showToast("解析文件失败", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">库存与物料</h2>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab("inventory")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "inventory" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              库存清单
            </button>
            <button 
              onClick={() => setActiveTab("requisitions")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeTab === "requisitions" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              领料单
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <History size={16} className="mr-2" />
            变动历史
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800"
          >
            <FileUp size={16} className="mr-2" />
            Excel 导入
          </button>
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded border border-slate-200 dark:border-slate-700">Ctrl+S 保存</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".xlsx,.xls" 
          />
        </div>
      </div>

      {activeTab === "inventory" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add New Item Form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center">
                <Plus className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                新增库存项目
              </h3>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">项目名称 (如: 三酸, 片碱)</label>
                  <input 
                    type="text" 
                    value={newItem.name}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                    placeholder="输入名称"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">初始库存</label>
                    <input 
                      type="number" 
                      value={newItem.stock}
                      onChange={e => setNewItem({...newItem, stock: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">单位</label>
                    <input 
                      type="text" 
                      value={newItem.unit}
                      onChange={e => setNewItem({...newItem, unit: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                      placeholder="kg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">低库存预警阈值</label>
                  <input 
                    type="number" 
                    value={newItem.low_threshold}
                    onChange={e => setNewItem({...newItem, low_threshold: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">成本单价 (元/单位)</label>
                  <input 
                    type="number" 
                    value={newItem.unit_cost}
                    onChange={e => setNewItem({...newItem, unit_cost: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 font-mono"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex items-center justify-center"
                >
                  <Save size={18} className="mr-2" />
                  保存项目
                </button>
              </form>
            </div>
          </div>

          {/* Inventory List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                  <Package className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                  库存清单
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest">库存总价值</div>
                    <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(items.reduce((acc, curr) => acc + (curr.stock * curr.unit_cost), 0))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest">
                    实时更新
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100 dark:border-slate-800">
                      <th className="p-6 font-medium">项目名称</th>
                      <th className="p-6 font-medium text-center">当前库存</th>
                      <th className="p-6 font-medium text-center">成本单价</th>
                      <th className="p-6 font-medium text-center">预警线</th>
                      <th className="p-6 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-6">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">{item.unit}</div>
                        </td>
                        <td className="p-6 text-center">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-mono font-bold ${
                            item.stock < item.low_threshold 
                              ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" 
                              : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {item.stock < item.low_threshold && <AlertTriangle size={14} className="mr-1.5" />}
                            {item.stock} {item.unit}
                          </div>
                        </td>
                        <td className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 font-mono">
                          {formatCurrency(item.unit_cost)}
                        </td>
                        <td className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 font-mono">
                          {item.low_threshold} {item.unit}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={() => {
                                setSelectedItem(item);
                                setAdjustData({ delta: 0, type: "入库", notes: "" });
                              }}
                              className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title="调整库存"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500 italic">
                          暂无库存项目，请在左侧添加。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center">
                <ClipboardList className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                物料领用登记
              </h3>
              <form onSubmit={handleAddRequisition} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">领用日期</label>
                  <input 
                    type="date" 
                    value={newRequisition.date}
                    onChange={e => setNewRequisition({...newRequisition, date: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">选择物料</label>
                  <select 
                    value={newRequisition.item_name}
                    onChange={e => setNewRequisition({...newRequisition, item_name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                    required
                  >
                    <option value="">-- 请选择物料 --</option>
                    {items.map(i => (
                      <option key={i.id} value={i.name}>{i.name} (余: {i.stock}{i.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">领用数量</label>
                    <input 
                      type="number" 
                      value={newRequisition.qty}
                      onChange={e => setNewRequisition({...newRequisition, qty: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">领用人</label>
                    <input 
                      type="text" 
                      value={newRequisition.worker}
                      onChange={e => setNewRequisition({...newRequisition, worker: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                      placeholder="姓名"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">用途/备注</label>
                  <input 
                    type="text" 
                    value={newRequisition.notes}
                    onChange={e => setNewRequisition({...newRequisition, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                    placeholder="如: 1号氧化线添加"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex items-center justify-center"
                >
                  <Save size={18} className="mr-2" />
                  保存领料单
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                  <ClipboardList className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                  领料记录
                </h3>
                <button 
                  onClick={() => {
                    const data = requisitions.map(r => ({ "日期": r.date, "物料": r.item_name, "数量": r.qty, "领用人": r.worker, "备注": r.notes }));
                    const ws = XLSX.utils.json_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "领料记录");
                    XLSX.writeFile(wb, `领料记录_${new Date().toISOString().split('T')[0]}.xlsx`);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center hover:underline"
                >
                  <Download size={14} className="mr-1" />
                  导出 Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 font-medium">日期</th>
                      <th className="px-6 py-4 font-medium">物料</th>
                      <th className="px-6 py-4 text-right">数量</th>
                      <th className="px-6 py-4">领用人</th>
                      <th className="px-6 py-4">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {requisitions.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{r.date}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{r.item_name}</td>
                        <td className="px-6 py-4 text-sm text-right font-mono font-bold text-rose-600 dark:text-rose-400">-{r.qty}</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          <div className="flex items-center">
                            <User size={14} className="mr-1.5 text-slate-400" />
                            {r.worker}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{r.notes}</td>
                      </tr>
                    ))}
                    {requisitions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500 italic">
                          暂无领料记录
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl flex items-start border border-amber-100 dark:border-amber-900/30">
        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mr-3 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-400">
          <p className="font-bold mb-1">库存预警说明：</p>
          <p>当库存量低于设定的预警线时，系统会自动在首页仪表盘显示提醒，并在此清单中以红色高亮显示。请及时联系供应商采购。</p>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold dark:text-slate-100">调整库存: {selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">变动类型</label>
                  <select 
                    value={adjustData.type}
                    onChange={e => setAdjustData({...adjustData, type: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                  >
                    <option value="入库">入库 (+)</option>
                    <option value="出库">出库 (-)</option>
                    <option value="盘点">盘点 (修正)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">变动数量</label>
                  <input 
                    type="number" 
                    value={adjustData.delta}
                    onChange={e => setAdjustData({...adjustData, delta: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">备注</label>
                <input 
                  type="text" 
                  value={adjustData.notes}
                  onChange={e => setAdjustData({...adjustData, notes: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                  placeholder="如: 采购入库, 生产领用"
                />
              </div>
              <div className="pt-4 flex space-x-3">
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    const finalDelta = adjustData.type === "出库" ? -Math.abs(adjustData.delta) : adjustData.delta;
                    adjustStock(selectedItem.id, finalDelta, adjustData.type, adjustData.notes);
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                >
                  确认调整
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold flex items-center dark:text-slate-100">
                <History className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                库存变动历史
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 shadow-sm">
                  <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">时间</th>
                    <th className="px-6 py-4">项目</th>
                    <th className="px-6 py-4">类型</th>
                    <th className="px-6 py-4 text-right">变动量</th>
                    <th className="px-6 py-4">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{t.item_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.type === "入库" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : 
                          t.type === "出库" ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-mono font-bold text-right ${
                        t.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : t.delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"
                      }`}>
                        {t.delta > 0 ? "+" : ""}{t.delta}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{t.notes}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500 italic">暂无变动记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowHistory(false)}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
