import React, { useState, useEffect } from 'react';
import { Building2, Download, Search, Calendar } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { SubsidiaryLedger } from '../../types';

export default function DepartmentLedger() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState<SubsidiaryLedger | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedDepartment && selectedAccount) {
      fetchLedger();
    }
  }, [selectedDepartment, selectedAccount, startDate, endDate]);

  const fetchDepartments = async () => {
    try {
      // Mock departments - in real app, fetch from API
      const mockDepartments = [
        { id: 1, name: '生产部' },
        { id: 2, name: '销售部' },
        { id: 3, name: '管理部' },
        { id: 4, name: '研发部' }
      ];
      setDepartments(mockDepartments);
      if (mockDepartments.length > 0) {
        setSelectedDepartment(mockDepartments[0].id);
      }
    } catch (error) {
      showToast('加载部门列表失败', 'error');
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      // Filter accounts that support department auxiliary accounting
      const departmentAccounts = data.filter((acc: any) => 
        acc.auxiliary_types && acc.auxiliary_types.includes('department')
      );
      setAccounts(departmentAccounts);
      if (departmentAccounts.length > 0) {
        setSelectedAccount(departmentAccounts[0].id);
      }
    } catch (error) {
      showToast('加载科目列表失败', 'error');
    }
  };

  const fetchLedger = async () => {
    if (!selectedDepartment || !selectedAccount) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v7/subsidiary-ledger?account_id=${selectedAccount}&auxiliary_type=department&auxiliary_id=${selectedDepartment}&start_date=${startDate}&end_date=${endDate}`
      );
      const data = await response.json();
      setLedger(data);
    } catch (error) {
      showToast('加载部门明细账失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!ledger) return;
    
    try {
      const response = await fetch(
        `/api/v7/reports/export/${format}?reportType=department_ledger&department_id=${selectedDepartment}&account_id=${selectedAccount}&start_date=${startDate}&end_date=${endDate}`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `部门明细账_${ledger.auxiliary_name}_${startDate}_${endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">部门核算明细账</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            按部门查询费用和成本明细账
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            disabled={!ledger}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            导出 Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!ledger}
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
              <Building2 size={16} className="inline mr-1" />
              选择部门
            </label>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              选择科目
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.id} - {account.name}
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

      {/* Ledger Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : ledger ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Summary */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">期初余额</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  ¥{ledger.opening_balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">本期发生额</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  ¥{ledger.transactions.reduce((sum, t) => sum + t.debit - t.credit, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">期末余额</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ¥{ledger.closing_balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    凭证号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    摘要
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    借方
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    贷方
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    余额
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {ledger.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      该期间无交易记录
                    </td>
                  </tr>
                ) : (
                  ledger.transactions.map((transaction, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        {transaction.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        {transaction.voucher_no}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100">
                        {transaction.notes}
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
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Search size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">请选择部门、科目和日期范围查询明细账</p>
        </div>
      )}
    </div>
  );
}
