import React, { useState, useEffect } from 'react';
import { ClosingPeriod, ClosingCheckItem, ClosingReport } from '../../types';

/**
 * 月末结账流程界面
 * 需求：4.1, 4.2, 4.6, 4.7
 * 
 * 功能：
 * - 显示结账检查清单
 * - 显示结账步骤进度
 * - 显示结账报告
 * - 添加反结账功能
 */
export default function ClosingProcess() {
  const [period, setPeriod] = useState<string>('');
  const [closingStatus, setClosingStatus] = useState<'idle' | 'checking' | 'processing' | 'completed' | 'error'>('idle');
  const [checklist, setChecklist] = useState<ClosingCheckItem[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [report, setReport] = useState<ClosingReport | null>(null);
  const [error, setError] = useState<string>('');
  const [isClosed, setIsClosed] = useState<boolean>(false);

  // 结账步骤定义
  const closingSteps = [
    '计提固定资产折旧',
    '分配制造费用',
    '结转生产成本',
    '处理成本差异',
    '结转损益类科目',
    '计提所得税'
  ];

  // 初始化：设置当前月份
  useEffect(() => {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setPeriod(currentPeriod);
    checkPeriodStatus(currentPeriod);
  }, []);

  // 检查期间是否已结账
  const checkPeriodStatus = async (selectedPeriod: string) => {
    try {
      const response = await fetch(`/api/v7/closing/check/${selectedPeriod}`);
      const data = await response.json();
      setIsClosed(data.isClosed);
      
      if (data.isClosed) {
        // 如果已结账，加载结账报告
        loadClosingReport(selectedPeriod);
      }
    } catch (err: any) {
      console.error('检查期间状态失败:', err);
    }
  };

  // 加载结账报告
  const loadClosingReport = async (selectedPeriod: string) => {
    // 这里可以添加获取历史结账报告的API调用
    // 暂时不实现，因为后端没有提供获取历史报告的接口
  };

  // 执行结账
  const handleExecuteClosing = async () => {
    if (!period) {
      setError('请选择结账期间');
      return;
    }

    setClosingStatus('checking');
    setError('');
    setChecklist([]);
    setReport(null);

    try {
      // 调用结账API
      const response = await fetch('/api/v7/closing/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          userId: 'system' // 实际应用中应该从用户会话获取
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '结账失败');
      }

      // 结账成功
      setClosingStatus('completed');
      setReport(data.report);
      setIsClosed(true);
      
      // 显示成功消息
      alert(`${period} 期间结账成功！`);
    } catch (err: any) {
      setClosingStatus('error');
      setError(err.message || '结账失败，请稍后重试');
      
      // 如果是前置条件未满足，尝试解析检查清单
      if (err.message.includes('前置条件未满足')) {
        // 这里可以添加获取检查清单的逻辑
      }
    }
  };

  // 反结账
  const handleReopenPeriod = async () => {
    if (!period) {
      setError('请选择期间');
      return;
    }

    if (!confirm(`确定要反结账 ${period} 期间吗？此操作将解除期间锁定，允许修改该期间的凭证和单据。`)) {
      return;
    }

    try {
      const response = await fetch('/api/v7/closing/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          userId: 'system'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '反结账失败');
      }

      // 反结账成功
      setIsClosed(false);
      setReport(null);
      setClosingStatus('idle');
      alert(`${period} 期间反结账成功！`);
    } catch (err: any) {
      setError(err.message || '反结账失败，请稍后重试');
    }
  };

  // 期间变更处理
  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPeriod = e.target.value;
    setPeriod(newPeriod);
    setClosingStatus('idle');
    setChecklist([]);
    setReport(null);
    setError('');
    checkPeriodStatus(newPeriod);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">月末结账流程</h1>

      {/* 期间选择 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4">
          <label className="font-medium">结账期间：</label>
          <input
            type="month"
            value={period}
            onChange={handlePeriodChange}
            className="border rounded px-3 py-2"
          />
          
          {isClosed && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              已结账
            </span>
          )}
          {!isClosed && period && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              未结账
            </span>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-medium text-red-800">结账失败</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 结账检查清单 */}
      {checklist.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">结账前置条件检查</h2>
          <div className="space-y-3">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded">
                {item.status === 'completed' && (
                  <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {item.status === 'failed' && (
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {item.status === 'pending' && (
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  {item.error_message && (
                    <p className="text-sm text-red-600 mt-1">{item.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 结账步骤进度 */}
      {closingStatus === 'processing' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">结账进度</h2>
          <div className="space-y-3">
            {closingSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <span className={currentStep === step ? 'font-medium' : ''}>{step}</span>
                {currentStep === step && (
                  <div className="ml-auto">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 结账报告 */}
      {report && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{report.period} 期间结账报告</h2>
          
          {/* 关键财务指标 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">营业收入</p>
              <p className="text-2xl font-bold text-blue-600">
                ¥{report.revenue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">营业成本</p>
              <p className="text-2xl font-bold text-orange-600">
                ¥{report.cost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">期间费用</p>
              <p className="text-2xl font-bold text-purple-600">
                ¥{report.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`rounded-lg p-4 ${report.net_profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600 mb-1">净利润</p>
              <p className={`text-2xl font-bold ${report.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ¥{report.net_profit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* 财务比率 */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">关键财务比率</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">毛利率</p>
                <p className="text-lg font-semibold">
                  {report.key_metrics.gross_margin.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">净利率</p>
                <p className="text-lg font-semibold">
                  {report.key_metrics.net_margin.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">费用率</p>
                <p className="text-lg font-semibold">
                  {report.key_metrics.expense_ratio.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* 警告信息 */}
          {report.warnings && report.warnings.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-3 text-yellow-700">异常提示</h3>
              <ul className="space-y-2">
                {report.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-yellow-700">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-4">
        {!isClosed && (
          <button
            onClick={handleExecuteClosing}
            disabled={closingStatus === 'processing' || !period}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {closingStatus === 'processing' ? '结账中...' : '执行结账'}
          </button>
        )}
        
        {isClosed && (
          <button
            onClick={handleReopenPeriod}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
          >
            反结账
          </button>
        )}

        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          返回
        </button>
      </div>

      {/* 说明文字 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">结账流程说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 结账前系统会自动检查前置条件，包括：业务单据是否已生成凭证、凭证是否借贷平衡等</li>
          <li>• 结账过程将按顺序执行：计提折旧 → 分配制造费用 → 结转成本 → 结转损益 → 计提所得税</li>
          <li>• 结账完成后，该期间将被锁定，不允许修改凭证和业务单据</li>
          <li>• 如需修改已结账期间的数据，请先执行反结账操作</li>
          <li>• 反结账操作会被记录到审计日志中</li>
        </ul>
      </div>
    </div>
  );
}
