import React, { useState, useEffect } from 'react';
import { FileCheck, Download, Search, Calendar, Users, Truck } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { ReconciliationStatement } from '../../types';

export default function Reconciliation() {
  const { showToast } = useToast();
  const [type, setType] = useState<'customer' | 'supplier'>('customer');
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<ReconciliationStatement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEntities();
  }, [type]);

  useEffect(() => {
    if (selectedEntity) {
      fetchStatement();
    }
  }, [selectedEntity, startDate, endDate, type]);

  const fetchEntities = async () => {
    try {
      const endpoint = type === 'customer' ? '/api/customers' : '/api/suppliers';
      const response = await fetch(endpoint);
      const data = await response.json();
      setEntities(data);
      if (data.length > 0) {
        setSelectedEntity(data[0].id);
      } else {
        setSelectedEntity(null);
        setStatement(null);
      }
    } catch (error) {
      showToast(`加载${type === 'customer' ? '客户' : '供应商'}列表失败`, 'error');
    }
  };

  const fetchStatement = async () => {
    if (!selectedEntity) return;
    
    setLoading(true);
    try {
      const endpoint = type === 'customer' 
        ? `/api/v7/reconciliation/customer/${selectedEntity}`
        : `/api/v7/reconciliation/supplier/${selectedEntity}`;
      
      const response = await fetch(`${endpoint}?start_date=${startDate}&end_date=${endDate}`);
      const data = await response.json();
      setStatement(data);
    } catch (error) {
      showToast('加载对账单失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!statement) return;
    
    try {
      const response = await fetch(
        `/api/v7/reports/export/${format}?reportType=reconciliation&type=${type}&entity_id=${selectedEntity}&start_date=${startDate}&end_date=${endDate}`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `往来对账单_${statement.entity_name}_${startDate}_${endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`${format.toUpperCase()} 导出成功`, 'success');
    } catch (error) {
      showToast('导出失败', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">往来对账单</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            生成客户和供应商往来对账单
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            disabled={!statement}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            导出 Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!statement}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            导出 PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              对账类型
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('customer')}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  type === 'customer'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Users size={16} />
                客户
              </button>
              <button
                onClick={() => setType('supplier')}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  type === 'supplier'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Truck size={16} />
                供应商
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {type === 'customer' ? <Users size={16} className="inline mr-1" /> : <Truck size={16} className="inline mr-1" />}
              选择{type === 'customer' ? '客户' : '供应商'}
            </label>
            <select
              value={selectedEntity || ''}
              onChange={(e) => setSelectedEntity(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              开始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              结束日期
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Statement Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : statement ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header Info */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <FileCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {statement.entity_name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {type === 'customer' ? '客户往来对账单' : '供应商往来对账单'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 dark:text-slate-400">对账期间</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {startDate} 至 {endDate}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">期初余额</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  ¥{statement.opening_balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">本期发生额</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  ¥{statement.transactions.reduce((sum, t) => sum + (type === 'customer' ? t.debit - t.credit : t.credit - t.debit), 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">期末余额</p>
                <p className={`text-2xl font-bold mt-1 ${
                  statement.closing_balance > 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : statement.closing_balance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}>
                  ¥{statement.closing_balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    日期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    业务类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    单据号
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {type === 'customer' ? '应收' : '应付'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {type === 'customer' ? '实收' : '实付'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    余额
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {statement.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      该期间无交易记录
                    </td>
                  </tr>
                ) : (
                  statement.transactions.map((transaction, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        {transaction.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === '销售订单' || transaction.type === '采购订单'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        {transaction.reference_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900 dark:text-slate-100">
                        {transaction.debit > 0 ? transaction.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900 dark:text-slate-100">
                        {transaction.credit > 0 ? transaction.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                        {transaction.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong>说明：</strong>
              {type === 'customer' 
                ? '期末余额为正数表示客户欠款，为负数表示预收款项。'
                : '期末余额为正数表示应付款项，为负数表示预付款项。'
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Search size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            请选择{type === 'customer' ? '客户' : '供应商'}和日期范围生成对账单
          </p>
        </div>
      )}
    </div>
  );
}
