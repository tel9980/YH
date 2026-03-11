/**
 * 增值税申报表页面
 * VAT Report Page
 */

import React, { useState, useEffect } from 'react';
import type { VATReport } from '../../types';

export default function VATReportPage() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [report, setReport] = useState<VATReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (period) {
      loadReport();
    }
  }, [period]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v7/tax/vat-report?period=${period}`);
      if (!response.ok) throw new Error('加载报表失败');

      const data = await response.json();
      setReport(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">增值税申报表</h1>
          
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">期间：</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={loadReport}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '加载中...' : '查询'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 border border-red-200 rounded">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">加载中...</div>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-6">
            {/* 主要数据 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">销项税额</div>
                <div className="text-2xl font-bold text-blue-900">
                  ¥{formatCurrency(report.output_vat)}
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">进项税额</div>
                <div className="text-2xl font-bold text-green-900">
                  ¥{formatCurrency(report.input_vat)}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-600 mb-1">应纳税额</div>
                <div className="text-2xl font-bold text-purple-900">
                  ¥{formatCurrency(report.vat_payable)}
                </div>
              </div>
            </div>

            {/* 详细数据表格 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      项目
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金额 (元)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      销售额（不含税）
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(report.details.sales_amount)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                      销项税额
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-900">
                      {formatCurrency(report.output_vat)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      采购额（不含税）
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(report.details.purchase_amount)}
                    </td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                      进项税额
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-900">
                      {formatCurrency(report.input_vat)}
                    </td>
                  </tr>
                  {report.details.input_vat_transfer_out > 0 && (
                    <tr className="bg-yellow-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-900">
                        进项税额转出
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-yellow-900">
                        {formatCurrency(report.details.input_vat_transfer_out)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-purple-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-900">
                      应纳税额
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-purple-900">
                      {formatCurrency(report.vat_payable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 计算公式说明 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">计算公式</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p>应纳税额 = 销项税额 - 进项税额 + 进项税额转出</p>
                <p className="text-xs text-gray-500 mt-2">
                  * 销项税额来自已完工或已送货的销售订单
                </p>
                <p className="text-xs text-gray-500">
                  * 进项税额来自原材料采购、设备采购等可抵扣项目
                </p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                打印报表
              </button>
              <button
                onClick={() => {
                  // TODO: 实现导出功能
                  alert('导出功能开发中');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                导出 Excel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
