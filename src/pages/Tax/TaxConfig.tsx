/**
 * 税务配置页面
 * Tax Configuration Page
 */

import React, { useState, useEffect } from 'react';
import type { TaxConfig } from '../../types';

export default function TaxConfig() {
  const [config, setConfig] = useState<TaxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v7/tax/config');
      if (!response.ok) throw new Error('加载配置失败');
      const data = await response.json();
      setConfig(data);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/v7/tax/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) throw new Error('保存配置失败');

      const updated = await response.json();
      setConfig(updated);
      setMessage({ type: 'success', text: '税务配置已保存' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">加载配置失败</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">税务配置</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* 增值税纳税人类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              增值税纳税人类型
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="taxpayer_type"
                  value="general"
                  checked={config.vat_taxpayer_type === 'general'}
                  onChange={(e) =>
                    setConfig({ ...config, vat_taxpayer_type: e.target.value as 'general' | 'small_scale' })
                  }
                  className="mr-2"
                />
                <span>一般纳税人</span>
                <span className="ml-2 text-sm text-gray-500">
                  (可抵扣进项税额，适用税率通常为13%、9%、6%)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="taxpayer_type"
                  value="small_scale"
                  checked={config.vat_taxpayer_type === 'small_scale'}
                  onChange={(e) =>
                    setConfig({ ...config, vat_taxpayer_type: e.target.value as 'general' | 'small_scale' })
                  }
                  className="mr-2"
                />
                <span>小规模纳税人</span>
                <span className="ml-2 text-sm text-gray-500">
                  (不可抵扣进项税额，征收率通常为3%或1%)
                </span>
              </label>
            </div>
          </div>

          {/* 增值税税率 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              增值税税率 / 征收率 (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={config.vat_rate}
              onChange={(e) => setConfig({ ...config, vat_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              {config.vat_taxpayer_type === 'general'
                ? '一般纳税人常用税率：13%(货物销售)、9%(运输服务)、6%(现代服务)'
                : '小规模纳税人征收率：3%(一般情况)、1%(疫情期间优惠)'}
            </p>
          </div>

          {/* 企业所得税税率 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              企业所得税税率 (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={config.eit_rate}
              onChange={(e) => setConfig({ ...config, eit_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              标准税率：25%；小型微利企业：5%或20%；高新技术企业：15%
            </p>
          </div>

          {/* 说明信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-blue-900 mb-2">配置说明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 增值税税率影响销售订单和采购单的税额计算</li>
              <li>• 企业所得税税率用于季度预缴和年度汇算清缴</li>
              <li>• 修改配置后，新的业务单据将使用新税率</li>
              <li>• 历史单据的税额不会自动调整</li>
            </ul>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => loadConfig()}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              重置
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
