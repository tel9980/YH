import React, { useState, useEffect } from "react";
import { ClipboardList, Plus, Eye, Package, Calendar, DollarSign, TrendingUp, FileText } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { ProductionOrder, Product } from "@/types";
import { useToast } from "./Toast";

export default function ProductionOrders() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [costDetails, setCostDetails] = useState<any>(null);
  const [newOrder, setNewOrder] = useState({
    order_no: `PO${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-001`,
    product_id: 0,
    quantity: 0,
    start_date: new Date().toISOString().split('T')[0],
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

      // Fetch production orders
      try {
        const ordersRes = await fetch("/api/v7/production-orders");
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData);
        }
      } catch (err) {
        // Production orders might not exist yet
      }
    } catch (err) {
      showToast("加载数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.product_id || newOrder.quantity <= 0) {
      showToast("请填写完整信息", "warning");
      return;
    }

    try {
      const res = await fetch("/api/v7/production-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newOrder,
          status: 'in_progress',
          actual_material_cost: 0,
          actual_labor_cost: 0,
          actual_overhead_cost: 0,
          actual_total_cost: 0,
        }),
      });

      if (res.ok) {
        showToast("生产订单创建成功！", "success");
        setShowCreateForm(false);
        setNewOrder({
          order_no: `PO${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orders.length + 2).padStart(3, '0')}`,
          product_id: 0,
          quantity: 0,
          start_date: new Date().toISOString().split('T')[0],
        });
        fetchData();
      } else {
        showToast("创建失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    }
  };

  const handleViewDetails = async (order: ProductionOrder) => {
    setSelectedOrder(order);
    try {
      const res = await fetch(`/api/v7/production-orders/${order.id}/cost-details`);
      if (res.ok) {
        const details = await res.json();
        setCostDetails(details);
      }
    } catch (err) {
      showToast("获取成本明细失败", "error");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      completed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
      closed: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    };
    const labels = {
      in_progress: "生产中",
      completed: "已完成",
      closed: "已关闭",
    };
    return (
      <span className={cn("text-xs px-2 py-1 rounded-full font-medium", styles[status as keyof typeof styles])}>
        {labels[status as keyof typeof labels]}
      </span>
    );
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
            <ClipboardList className="mr-2 text-indigo-500" size={28} />
            生产订单管理
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            管理生产订单，跟踪成本归集和分配
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
        >
          <Plus size={18} className="mr-2" />
          新建生产订单
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">新建生产订单</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  订单编号
                </label>
                <input
                  type="text"
                  value={newOrder.order_no}
                  onChange={(e) => setNewOrder({ ...newOrder, order_no: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  产品
                </label>
                <select
                  value={newOrder.product_id}
                  onChange={(e) => setNewOrder({ ...newOrder, product_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  required
                >
                  <option value={0}>请选择产品</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  生产数量
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newOrder.quantity}
                  onChange={(e) => setNewOrder({ ...newOrder, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  开工日期
                </label>
                <input
                  type="date"
                  value={newOrder.start_date}
                  onChange={(e) => setNewOrder({ ...newOrder, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">生产订单详情</h3>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setCostDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">订单编号</div>
                  <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{selectedOrder.order_no}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">状态</div>
                  <div>{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">产品</div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {products.find(p => p.id === selectedOrder.product_id)?.name || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">生产数量</div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedOrder.quantity}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">开工日期</div>
                  <div className="text-sm text-slate-900 dark:text-slate-100">{selectedOrder.start_date}</div>
                </div>
                {selectedOrder.completion_date && (
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">完工日期</div>
                    <div className="text-sm text-slate-900 dark:text-slate-100">{selectedOrder.completion_date}</div>
                  </div>
                )}
              </div>

              {/* Cost Summary */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                  <DollarSign size={16} className="mr-2 text-indigo-500" />
                  成本汇总
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">直接材料成本</div>
                    <div className="text-lg font-mono font-bold text-blue-700 dark:text-blue-300">
                      {formatCurrency(selectedOrder.actual_material_cost)}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">直接人工成本</div>
                    <div className="text-lg font-mono font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(selectedOrder.actual_labor_cost)}
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">制造费用</div>
                    <div className="text-lg font-mono font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(selectedOrder.actual_overhead_cost)}
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">总成本</div>
                    <div className="text-lg font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {formatCurrency(selectedOrder.actual_total_cost)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Details */}
              {costDetails && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                    <FileText size={16} className="mr-2 text-indigo-500" />
                    成本明细
                  </h4>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {/* Cost details would be displayed here */}
                    <p className="italic">成本明细数据将在此显示</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  订单编号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  产品
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  开工日期
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  实际总成本
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-slate-900 dark:text-slate-100">{order.order_no}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="text-slate-400 mr-2" size={16} />
                      <span className="text-sm text-slate-900 dark:text-slate-100">
                        {products.find(p => p.id === order.product_id)?.name || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-mono text-slate-900 dark:text-slate-100">{order.quantity}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="text-slate-400 mr-2" size={14} />
                      <span className="text-sm text-slate-600 dark:text-slate-400">{order.start_date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(order.actual_total_cost)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewDetails(order)}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center mx-auto"
                    >
                      <Eye size={14} className="mr-1" />
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
            <p>暂无生产订单</p>
          </div>
        )}
      </div>
    </div>
  );
}
