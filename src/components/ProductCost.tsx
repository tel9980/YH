import React, { useState, useEffect } from "react";
import { DollarSign, Save, Package, TrendingUp, AlertCircle } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { ProductCost as ProductCostType, Product } from "@/types";
import { useToast } from "./Toast";

export default function ProductCost() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productCosts, setProductCosts] = useState<Map<number, ProductCostType>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [costForm, setCostForm] = useState<Partial<ProductCostType>>({
    costing_method: 'standard',
    standard_material_cost: 0,
    standard_labor_cost: 0,
    standard_overhead_cost: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes] = await Promise.all([
        fetch("/api/products").then(res => res.json()),
      ]);
      setProducts(productsRes);

      // Fetch cost data for each product
      const costsMap = new Map<number, ProductCostType>();
      for (const product of productsRes) {
        try {
          const costRes = await fetch(`/api/v7/product-costs/${product.id}`);
          if (costRes.ok) {
            const cost = await costRes.json();
            costsMap.set(product.id, cost);
          }
        } catch (err) {
          // Product might not have cost data yet
        }
      }
      setProductCosts(costsMap);
    } catch (err) {
      showToast("加载数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (productId: number) => {
    const existingCost = productCosts.get(productId);
    if (existingCost) {
      setCostForm(existingCost);
    } else {
      setCostForm({
        costing_method: 'standard',
        standard_material_cost: 0,
        standard_labor_cost: 0,
        standard_overhead_cost: 0,
      });
    }
    setEditingProduct(productId);
  };

  const handleSave = async () => {
    if (editingProduct === null) return;

    const totalCost = (costForm.standard_material_cost || 0) + 
                     (costForm.standard_labor_cost || 0) + 
                     (costForm.standard_overhead_cost || 0);

    try {
      const res = await fetch(`/api/v7/product-costs/${editingProduct}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...costForm,
          standard_total_cost: totalCost,
        }),
      });

      if (res.ok) {
        showToast("产品成本设置成功！", "success");
        setEditingProduct(null);
        fetchData();
      } else {
        showToast("保存失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const calculateTotalCost = () => {
    return (costForm.standard_material_cost || 0) + 
           (costForm.standard_labor_cost || 0) + 
           (costForm.standard_overhead_cost || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <DollarSign className="mr-2 text-indigo-500" size={28} />
            产品标准成本设置
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            为每个产品设置标准成本，用于成本差异分析
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-start">
          <AlertCircle className="text-blue-500 mr-2 mt-0.5" size={18} />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>标准成本法：</strong>按预先设定的标准成本入库，月末计算实际成本与标准成本的差异。
            适用于生产流程稳定、成本可预测的产品。
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  产品名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  成本方法
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  标准材料成本
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  标准人工成本
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  标准制造费用
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  标准总成本
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {products.map((product) => {
                const cost = productCosts.get(product.id);
                const isEditing = editingProduct === product.id;

                return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="text-slate-400 mr-2" size={16} />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          value={costForm.costing_method}
                          onChange={(e) => setCostForm({ ...costForm, costing_method: e.target.value as 'standard' | 'actual' })}
                          className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        >
                          <option value="standard">标准成本法</option>
                          <option value="actual">实际成本法</option>
                        </select>
                      ) : (
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium",
                          cost?.costing_method === 'standard' 
                            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        )}>
                          {cost?.costing_method === 'standard' ? '标准成本' : cost?.costing_method === 'actual' ? '实际成本' : '未设置'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={costForm.standard_material_cost || 0}
                          onChange={(e) => setCostForm({ ...costForm, standard_material_cost: parseFloat(e.target.value) || 0 })}
                          className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 w-24 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      ) : (
                        <span className="text-sm font-mono text-slate-900 dark:text-slate-100">
                          {cost ? formatCurrency(cost.standard_material_cost || 0) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={costForm.standard_labor_cost || 0}
                          onChange={(e) => setCostForm({ ...costForm, standard_labor_cost: parseFloat(e.target.value) || 0 })}
                          className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 w-24 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      ) : (
                        <span className="text-sm font-mono text-slate-900 dark:text-slate-100">
                          {cost ? formatCurrency(cost.standard_labor_cost || 0) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={costForm.standard_overhead_cost || 0}
                          onChange={(e) => setCostForm({ ...costForm, standard_overhead_cost: parseFloat(e.target.value) || 0 })}
                          className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 w-24 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      ) : (
                        <span className="text-sm font-mono text-slate-900 dark:text-slate-100">
                          {cost ? formatCurrency(cost.standard_overhead_cost || 0) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {isEditing 
                          ? formatCurrency(calculateTotalCost())
                          : cost ? formatCurrency(cost.standard_total_cost || 0) : '-'
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={handleSave}
                            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                          >
                            <Save size={14} className="mr-1" />
                            保存
                          </button>
                          <button
                            onClick={() => setEditingProduct(null)}
                            className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(product.id!)}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          {cost ? '编辑' : '设置'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-4 opacity-20" />
            <p>暂无产品数据，请先在产品库中添加产品</p>
          </div>
        )}
      </div>
    </div>
  );
}
