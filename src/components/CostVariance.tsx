import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Calendar, Package, DollarSign, BarChart3 } from "lucide-react";
import { formatCurrency, cn } from "@/src/lib/utils";
import { CostVariance as CostVarianceType, Product } from "@/src/types";
import { useToast } from "./Toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function CostVariance() {
  const { showToast } = useToast();
  const [variances, setVariances] = useState<CostVarianceType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedProduct, setSelectedProduct] = useState<number>(0);

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

      // Fetch variances
      try {
        const variancesRes = await fetch("/api/v7/cost-variances");
        if (variancesRes.ok) {
          const variancesData = await variancesRes.json();
          setVariances(variancesData);
        }
      } catch (err) {
        // Variances might not exist yet
      }
    } catch (err) {
      showToast("加载数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!selectedProduct) {
      showToast("请选择产品", "warning");
      return;
    }

    try {
      const res = await fetch("/api/v7/cost-variances/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: selectedPeriod,
          productId: selectedProduct,
        }),
      });

      if (res.ok) {
        showToast("成本差异计算完成！", "success");
        fetchData();
      } else {
        showToast("计算失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleProcess = async (varianceId: number) => {
    try {
      const res = await fetch(`/api/v7/cost-variances/${varianceId}/process`, {
        method: "POST",
      });

      if (res.ok) {
        showToast("成本差异已处理，凭证已生成", "success");
        fetchData();
      } else {
        showToast("处理失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const getVarianceColor = (rate: number) => {
    if (Math.abs(rate) > 10) return "text-rose-600 dark:text-rose-400";
    if (Math.abs(rate) > 5) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const getVarianceBgColor = (rate: number) => {
    if (Math.abs(rate) > 10) return "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/30";
    if (Math.abs(rate) > 5) return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30";
    return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30";
  };

  const chartData = variances.map(v => ({
    name: products.find(p => p.id === v.product_id)?.name || `产品${v.product_id}`,
    材料差异: v.material_price_variance + v.material_quantity_variance,
    人工差异: v.labor_efficiency_variance,
    制造费用差异: v.overhead_variance,
    总差异: v.total_variance,
  }));

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
            <TrendingUp className="mr-2 text-indigo-500" size={28} />
            成本差异分析
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            分析实际成本与标准成本的差异，识别成本控制问题
          </p>
        </div>
      </div>

      {/* Calculate Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">计算成本差异</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              会计期间
            </label>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              产品
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value={0}>请选择产品</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              计算差异
            </button>
          </div>
        </div>
      </div>

      {/* Variance Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center">
            <BarChart3 className="mr-2 text-indigo-500" size={20} />
            成本差异趋势图
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="材料差异" fill="#3b82f6" />
                <Bar dataKey="人工差异" fill="#10b981" />
                <Bar dataKey="制造费用差异" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Variance Alerts */}
      {variances.filter(v => Math.abs(v.variance_rate) > 10).length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/30">
          <div className="flex items-start">
            <AlertTriangle className="text-rose-500 mr-3 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-bold text-rose-800 dark:text-rose-300 mb-2">
                成本差异预警
              </h3>
              <p className="text-sm text-rose-700 dark:text-rose-400">
                检测到 {variances.filter(v => Math.abs(v.variance_rate) > 10).length} 个产品的成本差异率超过 10%，
                建议及时分析原因并采取纠正措施。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Variances Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  期间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  产品
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  材料差异
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  人工差异
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  制造费用差异
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  总差异
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  差异率
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {variances.map((variance) => {
                const materialVariance = variance.material_price_variance + variance.material_quantity_variance;
                return (
                  <tr key={variance.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="text-slate-400 mr-2" size={14} />
                        <span className="text-sm text-slate-900 dark:text-slate-100">{variance.period}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="text-slate-400 mr-2" size={16} />
                        <span className="text-sm text-slate-900 dark:text-slate-100">
                          {products.find(p => p.id === variance.product_id)?.name || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={cn("text-sm font-mono", getVarianceColor(materialVariance))}>
                        {materialVariance >= 0 ? '+' : ''}{formatCurrency(materialVariance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={cn("text-sm font-mono", getVarianceColor(variance.labor_efficiency_variance))}>
                        {variance.labor_efficiency_variance >= 0 ? '+' : ''}{formatCurrency(variance.labor_efficiency_variance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={cn("text-sm font-mono", getVarianceColor(variance.overhead_variance))}>
                        {variance.overhead_variance >= 0 ? '+' : ''}{formatCurrency(variance.overhead_variance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={cn("text-sm font-mono font-bold", getVarianceColor(variance.total_variance))}>
                        {variance.total_variance >= 0 ? '+' : ''}{formatCurrency(variance.total_variance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-bold", getVarianceBgColor(variance.variance_rate))}>
                        {variance.total_variance >= 0 ? (
                          <TrendingUp size={12} className="mr-1" />
                        ) : (
                          <TrendingDown size={12} className="mr-1" />
                        )}
                        {variance.variance_rate >= 0 ? '+' : ''}{variance.variance_rate.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        variance.processed
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      )}>
                        {variance.processed ? '已处理' : '待处理'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {!variance.processed && (
                        <button
                          onClick={() => handleProcess(variance.id!)}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          处理差异
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {variances.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
            <p>暂无成本差异数据</p>
            <p className="text-xs mt-2">请先计算成本差异</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-start">
          <DollarSign className="text-blue-500 mr-2 mt-0.5" size={18} />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>成本差异分析说明：</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>材料差异 = 材料价格差异 + 材料数量差异</li>
              <li>人工差异 = 实际人工成本 - 标准人工成本</li>
              <li>制造费用差异 = 实际制造费用 - 标准制造费用</li>
              <li>差异率 = 总差异 / 标准总成本 × 100%</li>
              <li>差异率超过 ±10% 时会触发预警</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
