/**
 * 税务风险提示页面
 * Tax Risk Alerts Page
 */

import React, { useState, useEffect } from 'react';

interface TaxRiskAlert {
  risk_type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export default function TaxRisks() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [alerts, setAlerts] = useState<TaxRiskAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (period) {
      loadAlerts();
    }
  }, [period]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v7/tax/risk-alerts?period=${period}`);
      if (!response.ok) throw new Error('加载风险提示失败');

      const data = await response.json();
      setAlerts(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中风险';
      case 'low':
        return '低风险';
      default:
        return '未知';
    }
  };

  const getRiskTypeLabel = (riskType: string) => {
    const labels: Record<string, string> = {
      high_input_vat_ratio: '进项税额占比异常',
      low_tax_burden_rate: '税负率偏低',
      negative_taxable_income: '应纳税所得额为负',
      high_cost_ratio: '成本占比过高'
    };
    return labels[riskType] || riskType;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">税务风险提示</h1>
          
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">期间：</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={loadAlerts}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '检查中...' : '检查风险'}
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
            <div className="text-gray-500">检查中...</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-6xl mb-4">✅</div>
                <div className="text-xl font-medium text-gray-900 mb-2">
                  未发现税务风险
                </div>
                <div className="text-sm text-gray-500">
                  本期税务数据正常，未发现异常情况
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 风险统计 */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-sm text-red-600 mb-1">高风险</div>
                    <div className="text-2xl font-bold text-red-900">
                      {alerts.filter(a => a.severity === 'high').length}
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-sm text-yellow-600 mb-1">中风险</div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {alerts.filter(a => a.severity === 'medium').length}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-600 mb-1">低风险</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {alerts.filter(a => a.severity === 'low').length}
                    </div>
                  </div>
                </div>

                {/* 风险列表 */}
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start">
                        <div className="text-2xl mr-3">{getSeverityIcon(alert.severity)}</div>
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="font-medium text-lg">
                              {getRiskTypeLabel(alert.risk_type)}
                            </span>
                            <span className="ml-2 px-2 py-1 text-xs font-medium rounded">
                              {getSeverityLabel(alert.severity)}
                            </span>
                          </div>
                          <div className="mb-3">
                            <div className="font-medium mb-1">风险描述：</div>
                            <div className="text-sm">{alert.description}</div>
                          </div>
                          <div>
                            <div className="font-medium mb-1">建议措施：</div>
                            <div className="text-sm">{alert.suggestion}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 风险说明 */}
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">风险检查说明</h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p>• 进项税额占比异常：进项税额占销项税额比例过高可能引起税务关注</p>
                <p>• 税负率偏低：增值税税负率低于行业平均水平可能存在风险</p>
                <p>• 应纳税所得额为负：企业处于亏损状态，需关注成本费用合理性</p>
                <p>• 成本占比过高：成本占收入比例过高，毛利率偏低</p>
              </div>
            </div>

            {/* 行业参考指标 */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">制造业参考指标</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• 增值税税负率：2% - 5%</p>
                <p>• 进项税额占比：60% - 80%</p>
                <p>• 毛利率：15% - 30%</p>
                <p>• 期间费用率：10% - 20%</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
