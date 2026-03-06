import React, { useState, useEffect, useRef } from "react";
import { Product } from "@/src/types";
import { formatCurrency } from "@/src/lib/utils";
import { Plus, Save, TrendingUp, History, X, FileUp } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "./Toast";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

export default function ProductLibrary() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [unit, setUnit] = useState("件");
  const [price, setPrice] = useState(0);
  const [bulkPercent, setBulkPercent] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ date: string, price: number, customer: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+s": () => handleSubmit(new Event('submit') as any),
  });

  const fetchProducts = () => {
    fetch("/api/products").then(res => res.json()).then(setProducts);
  };

  useEffect(fetchProducts, []);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e.preventDefault) e.preventDefault();
    if (!name) {
      showToast("请输入产品名称", "warning");
      return;
    }
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, spec, pinyin, unit, default_price: price })
      });
      if (res.ok) {
        showToast("产品保存成功！", "success");
        setName("");
        setSpec("");
        setPinyin("");
        setPrice(0);
        fetchProducts();
      } else {
        showToast("保存失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleBulkUpdate = async () => {
    if (bulkPercent === 0) return;
    
    // Use custom confirmation if possible, but standard confirm is okay for now if we don't have a custom modal
    if (!confirm(`确定要将所有产品的默认单价调整 ${bulkPercent}% 吗？`)) return;
    
    try {
      const res = await fetch("/api/bulk-price-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percentage: bulkPercent })
      });
      if (res.ok) {
        showToast("价格调整成功！", "success");
        setBulkPercent(0);
        fetchProducts();
      } else {
        showToast("调整失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const viewHistory = async (p: Product) => {
    setSelectedProduct(p);
    try {
      const res = await fetch(`/api/price-history?product=${encodeURIComponent(p.name)}`);
      const data = await res.json();
      setPriceHistory(data);
    } catch (err) {
      showToast("获取历史记录失败", "error");
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
          name: row["产品名称"] || row["name"],
          spec: row["规格"] || row["spec"] || "",
          pinyin: row["拼音"] || row["pinyin"] || "",
          unit: row["单位"] || row["unit"] || "件",
          default_price: parseFloat(row["默认单价"] || row["price"]) || 0
        }));

        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "products", data: mappedData })
        });

        if (res.ok) {
          showToast("导入成功！", "success");
          fetchProducts();
        } else {
          showToast("导入失败", "error");
        }
      } catch (err) {
        showToast("解析文件失败", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDelete = async (p: Product) => {
    if (confirm(`确定要删除产品 "${p.name}" 吗？`)) {
      try {
        const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("产品已删除", "success");
          fetchProducts();
        } else {
          showToast("删除失败", "error");
        }
      } catch (err) {
        showToast("网络错误", "error");
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">产品库</h2>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-400 mr-2">Excel 需包含：名称、单位、单价</span>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800"
          >
            <FileUp size={16} className="mr-2" />
            Excel 导入
          </button>
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded border border-slate-200 dark:border-slate-700">Ctrl+S 保存</span>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImport} 
          className="hidden" 
          accept=".xlsx,.xls" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 dark:text-slate-100">新增产品</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">产品名称</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                placeholder="例如：铝型材黑氧化"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">规格型号</label>
              <input 
                type="text" 
                value={spec} 
                onChange={e => setSpec(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                placeholder="例如：10x20x1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">拼音首字母</label>
              <input 
                type="text" 
                value={pinyin} 
                onChange={e => setPinyin(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 uppercase"
                placeholder="例如：LXC"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">默认单位</label>
                <select 
                  value={unit} 
                  onChange={e => setUnit(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                >
                  {["件","条","只","个","米长","米重","公斤","平方米"].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">默认单价</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={price} 
                  onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono dark:text-slate-100"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors flex items-center justify-center"
            >
              <Save size={18} className="mr-2" />
              保存产品
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-6 flex items-center dark:text-slate-100">
            <TrendingUp className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
            批量调价
          </h3>
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">根据成本波动（如酸价上涨）统一调整所有产品的默认单价。</p>
            <div className="flex items-center space-x-2">
              <input 
                type="number" 
                value={bulkPercent} 
                onChange={e => setBulkPercent(parseFloat(e.target.value) || 0)}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono dark:text-slate-100"
                placeholder="百分比 (如 5)"
              />
              <span className="text-slate-500 dark:text-slate-400 font-bold">%</span>
            </div>
            {bulkPercent !== 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/30 text-[10px] text-amber-700 dark:text-amber-400">
                <p className="font-bold mb-1">价格预览：</p>
                <div className="space-y-1">
                  {products.slice(0, 3).map(p => (
                    <p key={p.id}>{p.name}: {formatCurrency(p.default_price)} → <span className="font-bold">{formatCurrency(p.default_price * (1 + bulkPercent/100))}</span></p>
                  ))}
                  {products.length > 3 && <p>...等 {products.length} 项</p>}
                </div>
              </div>
            )}
            <button 
              onClick={handleBulkUpdate}
              className="w-full bg-slate-900 dark:bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              执行调价
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">产品名称</th>
              <th className="px-6 py-4 font-medium">规格</th>
              <th className="px-6 py-4 font-medium">拼音</th>
              <th className="px-6 py-4 font-medium">单位</th>
              <th className="px-6 py-4 font-medium text-right">默认单价</th>
              <th className="px-6 py-4 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium dark:text-slate-200">{p.name}</td>
                <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{p.spec || "-"}</td>
                <td className="px-6 py-4 text-xs text-slate-400 uppercase font-mono">{p.pinyin || "-"}</td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{p.unit}</td>
                <td className="px-6 py-4 text-sm text-right font-mono dark:text-slate-300">{formatCurrency(p.default_price)}</td>
                <td className="px-6 py-4 text-center space-x-2">
                  <button 
                    onClick={() => viewHistory(p)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="查看价格历史"
                  >
                    <History size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(p)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title="删除产品"
                  >
                    <X size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Price History Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold flex items-center dark:text-slate-100">
                <History className="mr-2 text-indigo-600 dark:text-indigo-400" size={20} />
                {selectedProduct.name} - 价格历史
              </h3>
              <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {priceHistory.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold">
                    <tr className="border-b border-slate-50 dark:border-slate-800">
                      <th className="pb-3">日期</th>
                      <th className="pb-3">客户</th>
                      <th className="pb-3 text-right">成交单价</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {priceHistory.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 text-sm font-mono dark:text-slate-400">{h.date}</td>
                        <td className="py-3 text-sm dark:text-slate-300">{h.customer}</td>
                        <td className="py-3 text-sm text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(h.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic">暂无历史订单记录</div>
              )}
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setSelectedProduct(null)}
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
