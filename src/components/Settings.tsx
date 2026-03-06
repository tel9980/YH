import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Plus, Trash2, CreditCard, Tag } from "lucide-react";
import { useToast } from "./Toast";

export default function Settings() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, methRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/payment-methods")
      ]);
      setCategories(await catRes.json());
      setMethods(await methRes.json());
    } catch (e) {
      showToast("加载基础数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addCategory = async () => {
    if (!newCategory) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory, type: "expense" })
      });
      if (res.ok) {
        showToast("分类添加成功", "success");
        setNewCategory("");
        fetchData();
      }
    } catch (e) {
      showToast("添加失败", "error");
    }
  };

  const deleteCategory = async (id: number) => {
    if (!window.confirm("确定要删除该分类吗？")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("分类已删除", "success");
        fetchData();
      }
    } catch (e) {
      showToast("删除失败", "error");
    }
  };

  const addMethod = async () => {
    if (!newMethod) return;
    try {
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMethod })
      });
      if (res.ok) {
        showToast("支付方式添加成功", "success");
        setNewMethod("");
        fetchData();
      }
    } catch (e) {
      showToast("添加失败", "error");
    }
  };

  const deleteMethod = async (id: number) => {
    if (!window.confirm("确定要删除该支付方式吗？")) return;
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("支付方式已删除", "success");
        fetchData();
      }
    } catch (e) {
      showToast("删除失败", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center dark:text-slate-100">
          <SettingsIcon className="mr-2 text-indigo-600 dark:text-indigo-400" size={28} />
          系统基础数据设置
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          配置您的支出分类和支付方式，让录单更符合您的工厂习惯。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Categories Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center mb-6 text-indigo-600 dark:text-indigo-400">
            <Tag className="mr-2" size={20} />
            <h3 className="text-lg font-bold">支出分类管理</h3>
          </div>
          
          <div className="flex space-x-2 mb-6">
            <input 
              type="text" 
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="输入新分类名称..."
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            />
            <button 
              onClick={addCategory}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
            >
              <Plus size={18} className="mr-1" />
              添加
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group">
                <span className="text-slate-700 dark:text-slate-200 font-medium">{cat.name}</span>
                <button 
                  onClick={() => deleteCategory(cat.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {categories.length === 0 && !loading && (
              <div className="text-center py-8 text-slate-400 italic text-sm">暂无分类数据</div>
            )}
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center mb-6 text-emerald-600 dark:text-emerald-400">
            <CreditCard className="mr-2" size={20} />
            <h3 className="text-lg font-bold">支付方式/银行管理</h3>
          </div>
          
          <div className="flex space-x-2 mb-6">
            <input 
              type="text" 
              value={newMethod}
              onChange={e => setNewMethod(e.target.value)}
              placeholder="输入新支付方式..."
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            />
            <button 
              onClick={addMethod}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center"
            >
              <Plus size={18} className="mr-1" />
              添加
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {methods.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group">
                <span className="text-slate-700 dark:text-slate-200 font-medium">{m.name}</span>
                <button 
                  onClick={() => deleteMethod(m.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {methods.length === 0 && !loading && (
              <div className="text-center py-8 text-slate-400 italic text-sm">暂无支付方式数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
