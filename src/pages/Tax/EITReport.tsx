/**
 * 企业所得税申报表页面
 * Enterprise Income Tax Report Page
 */

import React, { useState, useEffect } from 'react';
import type { EITReport } from '../../types';

export default function EITReportPage() {
  const [viewMode, setViewMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [report, setReport] = useState<EITReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [viewMode, period, year, quarter]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      let url: string;
      if (viewMode === 'monthly') {
        url = `/api/v7/tax/eit-report?period=${period}`;
      } else {
        url = `/api/v7/tax/eit-report/quarterly?year=${year}&quarter=${quarter}`;
      }

      const response = await fetch(url);
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
          <h1 className="text-2xl font-bold">企业所得税申报表</h1>
          
          <div className="flex items-center space-x-3">
            {/* 视图模式切换 */}
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-2 text-sm ${
                  viewMode === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                月度
              </button>
              <button
                onClick={() => setViewMode('quarterly')}
                className={`px-4 py-2 text-sm ${
                  viewMode === 'quarterly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                季度
              </button>
            </div>

            {/* 期间选择 */}
            {viewMode === 'monthly' ? (
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  min="2000"
                  max="2100"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-700">年</span>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">第一季度</option>
                  <option value="2">第二季度</option>
                  <option value="3">第三季度</option>
                  <option value="4">第四季度</option>
                </select>
              </div>
            )}

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
            {/* 主要指标 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">应纳税所得额</div>
                <div className="text-2xl font-bold text-blue-900">
                  ¥{formatCurrency(report.taxable_income)}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-600 mb-1">应纳企业所得税</div>
                <div className="text-2xl font-bold text-purple-900">
                  ¥{formatCurrency(report.eit_payable)}
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
                  <tr className="bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                      营业收入
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-900">
                      {formatCurrency(report.revenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 pl-12">
                      减：营业成本
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(report.cost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 pl-12">
                      减：期间费用
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(report.expense)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                      应纳税所得额
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-900">
                      {formatCurrency(report.taxable_income)}
                    </td>
                  </tr>
                  <tr className="bg-purple-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-900">
                      应纳企业所得税
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-purple-900">
                      {formatCurrency(report.eit_payable)}
                    </td>
                  </tr>
                  {viewMode === 'quarterly' && report.prepaid_eit > 0 && (
                    <>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 pl-12">
                          减：已预缴税额
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(report.prepaid_eit)}
                        </td>
                      </tr>
                      <tr className="bg-yellow-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-900">
                          本期应补（退）税额
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-yellow-900">
                          {formatCurrency(report.eit_payable - report.prepaid_eit)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* 计算说明 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">计算公式</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p>应纳税所得额 = 营业收入 - 营业成本 - 期间费用</p>
                <p>应纳企业所得税 = 应纳税所得额 × 税率</p>
                {viewMode === 'quarterly' && (
                  <p className="text-xs text-gray-500 mt-2">
                    * 企业所得税按季度预缴，年度汇算清缴
                  </p>
                )}
              </div>
            </div>

            {/* 税率说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">税率说明</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• 一般企业：25%</p>
                <p>• 小型微利企业：应纳税所得额不超过100万元的部分，减按12.5%计入应纳税所得额，按20%税率缴纳（实际税负2.5%）</p>
                <p>• 小型微利企业：应纳税所得额超过100万元但不超过300万元的部分，减按25%计入应纳税所得额，按20%税率缴纳（实际税负5%）</p>
                <p>• 高新技术企业：15%</p>
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
