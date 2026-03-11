import React, { useState, useEffect } from "react";
import { FixedAsset } from "../types";
import { formatCurrency, cn } from "../lib/utils";
import { Plus, Trash2, Calendar, Wallet, History, AlertCircle, Building2 } from "lucide-react";
import { useToast } from "./Toast";

export default function FixedAssets() {
  const { showToast } = useToast();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_no: "",
    name: "",
    category: "机器设备",
    acquisition_date: new Date().toISOString().split('T')[0],
    cost: "",
    depreciation_method: "straight_line",
    useful_life: "60", // 5 years = 60 months
    salvage_value: "0",
    department_id: ""
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v7/fixed-assets");
      const data = await res.json();
      setAssets(data);
    } catch (e) {
      showToast("加载固定资产失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v7/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAsset,
          cost: parseFloat(newAsset.cost),
          useful_life: parseInt(newAsset.useful_life),
          salvage_value: parseFloat(newAsset.salvage_value),
          department_id: newAsset.department_id ? parseInt(newAsset.department_id) : null
        })
      });
      if (res.ok) {
        showToast("固定资产添加成功", "success");
        setShowAddForm(false);
        setNewAsset({
          asset_no: "",
          name: "",
          category: "机器设备",
          acquisition_date: new Date().toISOString().split('T')[0],
          cost: "",
          depreciation_method: "straight_line",
          useful_life: "60",
          salvage_value: "0",
          department_id: ""
        });
        fetchAssets();
      }
    } catch (e) {
      showToast("添加失败", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除该固定资产吗？")) return;
    try {
      const res = await fetch(`/api/v7/fixed-assets/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("已删除", "success");
        fetchAssets();
      }
    } catch (e) {
      showToast("删除失败", "error");
    }
  };

  const getDepreciationMethodLabel = (method: string) => {
    switch (method) {
      case 'straight_line': return '平均年限法 (直线法)';
      case 'double_declining': return '双倍余额递减法';
      case 'sum_of_years': return '年数总和法';
      default: return method;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-indigo-600 dark:text-indigo-400">
          <Building2 className="mr-3" size={28} />
          <h3 className="text-2xl font-bold">固定资产管理 (专业合规版)</h3>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          <Plus size={18} className="mr-2" />
          新增资产
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddAsset} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">资产编号</label>
              <input 
                type="text" 
                value={newAsset.asset_no}
                onChange={e => setNewAsset({...newAsset, asset_no: e.target.value})}
                placeholder="自动生成"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">资产名称</label>
              <input 
                required
                type="text" 
                value={newAsset.name}
                onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                placeholder="如：阳极氧化生产线"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">资产类别</label>
              <select 
                value={newAsset.category}
                onChange={e => setNewAsset({...newAsset, category: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              >
                <option value="机器设备">机器设备</option>
                <option value="运输工具">运输工具</option>
                <option value="电子设备">电子设备</option>
                <option value="房屋建筑物">房屋建筑物</option>
                <option value="管理用具">管理用具</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">购入日期</label>
              <input 
                required
                type="date" 
                value={newAsset.acquisition_date}
                onChange={e => setNewAsset({...newAsset, acquisition_date: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">原始成本 (元)</label>
              <input 
                required
                type="number" 
                value={newAsset.cost}
                onChange={e => setNewAsset({...newAsset, cost: e.target.value})}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">预计净残值 (元)</label>
              <input 
                required
                type="number" 
                value={newAsset.salvage_value}
                onChange={e => setNewAsset({...newAsset, salvage_value: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">使用月数</label>
              <input 
                required
                type="number" 
                value={newAsset.useful_life}
                onChange={e => setNewAsset({...newAsset, useful_life: e.target.value})}
                placeholder="如：60"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">折旧方法</label>
              <select 
                value={newAsset.depreciation_method}
                onChange={e => setNewAsset({...newAsset, depreciation_method: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              >
                <option value="straight_line">平均年限法 (直线法)</option>
                <option value="double_declining">双倍余额递减法</option>
                <option value="sum_of_years">年数总和法</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button 
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2 text-slate-500 font-bold hover:text-slate-700 transition-colors"
            >
              取消
            </button>
            <button 
              type="submit"
              className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              确认添加
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                <th className="px-6 py-4">资产信息</th>
                <th className="px-6 py-4">购入/折旧信息</th>
                <th className="px-6 py-4 text-right">原始成本</th>
                <th className="px-6 py-4 text-right">累计折旧</th>
                <th className="px-6 py-4 text-right">账面净值</th>
                <th className="px-6 py-4 text-center">状态</th>
                <th className="px-6 py-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {assets.map((asset) => {
                return (
                  <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{asset.name}</div>
                      <div className="text-[10px] text-slate-400">编号: {asset.asset_no} | 类别: {asset.category}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm dark:text-slate-400">{asset.acquisition_date}</div>
                      <div className="text-[10px] text-slate-400">
                        {getDepreciationMethodLabel(asset.depreciation_method)} | {asset.useful_life}月
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-bold dark:text-slate-200">{formatCurrency(asset.cost)}</td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-rose-500">{formatCurrency(asset.accumulated_depreciation)}</td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-bold text-emerald-600">{formatCurrency(asset.net_book_value)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        asset.status === '在用' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                        asset.status === '报废' ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDelete(asset.id)}
                          title="删除"
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    暂无固定资产记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center text-amber-600 mb-4">
            <AlertCircle size={20} className="mr-2" />
            <h4 className="font-bold">专业会计准则合规提醒</h4>
          </div>
          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 leading-relaxed">
            <li>1. **计提时点**：固定资产应当按月计提折旧，当月增加的固定资产，当月不计提折旧，从下月起计提；当月减少的固定资产，当月仍计提折旧，从下月起不计提。</li>
            <li>2. **计提基数**：系统自动根据设置的折旧方法（直线法、双倍余额递减法、年数总和法）在月末结账时自动生成计提凭证。</li>
            <li>3. **折旧费分配**：管理用具的折旧计入管理费用，生产设备的折旧计入制造费用并参与成本分配。</li>
            <li>4. **提足折旧**：固定资产提足折旧后，不论能否继续使用，均不再计提折旧。提前报废的固定资产，也不再补提折旧。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
