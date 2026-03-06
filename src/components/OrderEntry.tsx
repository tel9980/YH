import React, { useState, useEffect, useRef } from "react";
import { Product, Customer } from "@/src/types";
import { Save, Info, History, Plus, Trash2, Package, FileSpreadsheet, Search } from "lucide-react";
import { formatCurrency } from "@/src/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "./Toast";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

interface OrderItem {
  id: string;
  product: string;
  spec: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  fixture_loss: number;
  outsource: string[];
  notes: string;
  attachment_url: string;
  invoiced: number;
  tax_rate: number;
  status: string;
  worker: string;
}

export default function OrderEntry() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customer, setCustomer] = useState("");
  const [customerInfo, setCustomerInfo] = useState<{ credit_limit: number, balance: number } | null>(null);
  const [globalTaxRate, setGlobalTaxRate] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([
    { id: Math.random().toString(), product: "", spec: "", qty: 0, unit: "件", price: 0, total: 0, fixture_loss: 0, outsource: [], notes: "", attachment_url: "", invoiced: 0, tax_rate: 0, status: "待产", worker: "" }
  ]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+s": () => handleSubmit(new Event('submit') as any),
    "ctrl+n": () => addItem(),
  });

  useEffect(() => {
    fetch("/api/products").then(res => res.json()).then(setProducts);
    fetch("/api/customers").then(res => res.json()).then(setCustomers);
  }, []);

  useEffect(() => {
    if (customer) {
      fetch(`/api/customers/${encodeURIComponent(customer)}/balance`)
        .then(res => res.json())
        .then(setCustomerInfo);
    } else {
      setCustomerInfo(null);
    }
  }, [customer]);

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newItems: OrderItem[] = data.map((row, idx) => {
          const product = row["产品名称"] || row["产品"] || "";
          const spec = row["规格"] || row["spec"] || "";
          const qty = parseFloat(row["数量"]) || 0;
          const unit = row["单位"] || "件";
          const price = parseFloat(row["单价"]) || 0;
          const notes = row["备注"] || "";
          const worker = row["生产员"] || "";
          
          return {
            id: Math.random().toString(),
            product,
            spec,
            qty,
            unit,
            price,
            total: qty * price,
            fixture_loss: 0,
            outsource: [],
            notes,
            attachment_url: "",
            invoiced: 0,
            tax_rate: globalTaxRate,
            status: "待产",
            worker
          };
        });

        if (newItems.length > 0) {
          setItems(newItems);
          showToast(`成功从 Excel 导入 ${newItems.length} 条记录`, "success");
        }
      } catch (err) {
        showToast("Excel 解析失败，请检查格式", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  const [customerSearch, setCustomerSearch] = useState("");
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.pinyin && c.pinyin.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const [productSearch, setProductSearch] = useState<{ [key: string]: string }>({});
  const getFilteredProducts = (search: string) => products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.pinyin && p.pinyin.toLowerCase().includes(search.toLowerCase()))
  );

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), product: "", spec: "", qty: 0, unit: "件", price: 0, total: 0, fixture_loss: 0, outsource: [], notes: "", attachment_url: "", invoiced: 0, tax_rate: globalTaxRate, status: "待产", worker: "" }]);
    showToast("已添加新行", "info");
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    } else {
      showToast("至少保留一行", "warning");
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        if (field === "product") {
          const p = products.find(i => i.name === value);
          if (p) {
            newItem.unit = p.unit;
            newItem.price = p.default_price;
            
            // Intelligent suggestion: fetch last price for this customer/product
            if (customer) {
              fetch(`/api/last-price?customer=${encodeURIComponent(customer)}&product=${encodeURIComponent(value)}`)
                .then(res => res.json())
                .then(lastPrice => {
                  if (lastPrice) {
                    updateItem(id, "price", lastPrice.price);
                    showToast(`已自动填充该客户上次成交价: ${lastPrice.price}`, "info");
                  }
                });
            }
          }
        }
        newItem.total = (newItem.qty * newItem.price) + (newItem.fixture_loss || 0);
        return newItem;
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((acc, cur) => acc + cur.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e.preventDefault) e.preventDefault();
    if (!customer || items.some(i => !i.product || i.qty <= 0)) {
      showToast("请填写完整客户和产品信息", "error");
      return;
    }
    try {
      const res = await fetch("/api/orders/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, 
          customer, 
          items: items.map(i => ({
            ...i,
            tax_rate: globalTaxRate,
            outsource: i.outsource.join(",")
          }))
        })
      });
      if (res.ok) {
        showToast("批量订单保存成功！", "success");
        setItems([{ id: Math.random().toString(), product: "", qty: 0, unit: "件", price: 0, total: 0, fixture_loss: 0, outsource: [], notes: "", attachment_url: "", invoiced: 0, tax_rate: globalTaxRate, status: "待产", worker: "" }]);
      } else {
        showToast("保存失败，请重试", "error");
      }
    } catch (err) {
      showToast("网络错误，保存失败", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center text-indigo-600 dark:text-indigo-400">
            <Package className="mr-2" size={24} />
            <h3 className="text-xl font-bold">批量录单 (送货单模式)</h3>
          </div>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded border border-slate-200 dark:border-slate-700">Ctrl+S 保存</span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] rounded border border-slate-200 dark:border-slate-700">Ctrl+N 加行</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">送货日期</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">客户名称</label>
              <div className="relative">
                <input 
                  value={customerSearch || customer} 
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setCustomer(e.target.value);
                  }}
                  onFocus={() => setCustomerSearch(customer)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                  placeholder="搜索名称或拼音首字母"
                />
                {customerSearch && filteredCustomers.length > 0 && customerSearch !== customer && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomer(c.name);
                          setCustomerSearch("");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm dark:text-slate-200 border-b border-slate-50 dark:border-slate-800 last:border-0"
                      >
                        <div className="font-bold">{c.name}</div>
                        {c.pinyin && <div className="text-[10px] text-slate-400 uppercase">{c.pinyin}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customerInfo && customerInfo.credit_limit > 0 && (
                <div className={`mt-2 text-[10px] font-bold flex items-center ${customerInfo.balance > customerInfo.credit_limit ? "text-rose-600" : "text-emerald-600"}`}>
                  <Info size={12} className="mr-1" />
                  信用额度: {formatCurrency(customerInfo.credit_limit)} | 当前欠款: {formatCurrency(customerInfo.balance)}
                  {customerInfo.balance > customerInfo.credit_limit && " (已超额!)"}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">税率 (%)</label>
              <div className="flex items-center space-x-2">
                <select 
                  value={globalTaxRate}
                  onChange={e => setGlobalTaxRate(Number(e.target.value))}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                >
                  <option value={0}>0% (不含税/现金)</option>
                  <option value={3}>3% (普票)</option>
                  <option value={6}>6% (专票-服务)</option>
                  <option value={13}>13% (专票-加工)</option>
                </select>
                <button 
                  type="button"
                  onClick={() => {
                    const p = prompt("请输入含税单价，将自动转换为不含税单价：");
                    if (p && !isNaN(Number(p))) {
                      const inclusive = Number(p);
                      const exclusive = inclusive / (1 + globalTaxRate / 100);
                      alert(`不含税单价为: ${exclusive.toFixed(4)}`);
                    }
                  }}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  title="含税价转不含税价"
                >
                  <Info size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4 font-medium">产品名称</th>
                  <th className="pb-4 font-medium">规格</th>
                  <th className="pb-4 font-medium w-24">数量</th>
                  <th className="pb-4 font-medium w-24">单位</th>
                  <th className="pb-4 font-medium w-28">单价</th>
                  <th className="pb-4 font-medium w-24">挂具费</th>
                  <th className="pb-4 font-medium w-32">委外工序</th>
                  <th className="pb-4 font-medium">备注/附件</th>
                  <th className="pb-4 font-medium text-center w-28">状态</th>
                  <th className="pb-4 font-medium w-24">生产员</th>
                  <th className="pb-4 font-medium text-right w-32">小计</th>
                  <th className="pb-4 font-medium text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {items.map((item, index) => (
                  <tr key={item.id} className="group">
                    <td className="py-4 pr-4">
                      <div className="relative">
                        <input 
                          value={productSearch[item.id] || item.product}
                          onChange={e => {
                            setProductSearch(prev => ({ ...prev, [item.id]: e.target.value }));
                            updateItem(item.id, "product", e.target.value);
                          }}
                          onFocus={() => setProductSearch(prev => ({ ...prev, [item.id]: item.product }))}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-slate-100"
                          placeholder="输入产品或拼音"
                        />
                        {productSearch[item.id] && getFilteredProducts(productSearch[item.id]).length > 0 && productSearch[item.id] !== item.product && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {getFilteredProducts(productSearch[item.id]).map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  updateItem(item.id, "product", p.name);
                                  updateItem(item.id, "spec", p.spec || "");
                                  updateItem(item.id, "unit", p.unit || "件");
                                  updateItem(item.id, "price", p.default_price || 0);
                                  setProductSearch(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-xs dark:text-slate-200 border-b border-slate-50 dark:border-slate-800 last:border-0"
                              >
                                <div className="font-bold">{p.name}</div>
                                {p.pinyin && <div className="text-[10px] text-slate-400 uppercase">{p.pinyin}</div>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="text"
                        value={item.spec}
                        onChange={e => updateItem(item.id, "spec", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-slate-100"
                        placeholder="规格"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="number"
                        step="0.1"
                        value={item.qty}
                        onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono dark:text-slate-100"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <select 
                        value={item.unit}
                        onChange={e => updateItem(item.id, "unit", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-slate-100"
                      >
                        {["件","条","只","个","米长","米重","公斤","平方米"].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={e => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono dark:text-slate-100"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="number"
                        step="0.1"
                        value={item.fixture_loss}
                        onChange={e => updateItem(item.id, "fixture_loss", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono dark:text-slate-100"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {["喷砂", "拉丝", "抛光"].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const newOutsource = item.outsource.includes(opt)
                                ? item.outsource.filter(i => i !== opt)
                                : [...item.outsource, opt];
                              updateItem(item.id, "outsource", newOutsource);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              item.outsource.includes(opt) 
                                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400" 
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-2">
                        <input 
                          value={item.notes}
                          onChange={e => updateItem(item.id, "notes", e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-slate-100"
                          placeholder="备注"
                        />
                        <input 
                          value={item.attachment_url}
                          onChange={e => updateItem(item.id, "attachment_url", e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-[10px] font-mono dark:text-slate-100"
                          placeholder="附件链接/图片Base64"
                        />
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <select 
                        value={item.status}
                        onChange={e => updateItem(item.id, "status", e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                      >
                        <option value="待产">待产</option>
                        <option value="氧化中">氧化中</option>
                        <option value="待检">待检</option>
                        <option value="已完工">已完工</option>
                        <option value="已送货">已送货</option>
                      </select>
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="text" 
                        value={item.worker}
                        onChange={e => updateItem(item.id, "worker", e.target.value)}
                        placeholder="姓名"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-xs dark:text-slate-100"
                      />
                    </td>
                    <td className="py-4 text-right font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-4 text-center">
                      <button 
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id="products-list">
            {products.map(p => <option key={p.id} value={p.name} />)}
          </datalist>

          <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-4">
              <button 
                type="button"
                onClick={addItem}
                className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                <Plus size={18} className="mr-2" />
                添加一行
              </button>
              <label className="flex items-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-sm font-medium cursor-pointer">
                <FileSpreadsheet size={18} className="mr-2" />
                Excel 导入
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
              </label>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">本次送货总计</div>
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(totalAmount)}</div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center"
          >
            <Save size={24} className="mr-2" />
            保存整单
          </button>
        </form>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex items-start">
        <Info size={18} className="text-indigo-600 dark:text-indigo-400 mr-3 mt-0.5" />
        <div className="text-sm text-indigo-700 dark:text-indigo-300">
          <p className="font-bold mb-1">💡 小贴士：</p>
          <p>1. 批量录单适合一次送货包含多个品种的情况。</p>
          <p>2. 输入产品名称时会自动匹配库中单价和单位。</p>
          <p>3. 委外工序点击即可选中，再次点击取消。</p>
          <p>4. <b>快捷键：</b>Ctrl+S 保存，Ctrl+N 添加新行。</p>
        </div>
      </div>
    </div>
  );
}
