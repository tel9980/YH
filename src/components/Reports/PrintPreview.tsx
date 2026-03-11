import React, { useState, useRef } from 'react';
import { X, Printer, Settings, Upload, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrintPreviewProps {
  reportType: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'financial_ratios' | 'voucher';
  reportData: any;
  onClose: () => void;
}

interface PrintSettings {
  companyName: string;
  reportTitle: string;
  period: string;
  showSeal: boolean;
  sealImage: string | null;
  sealPosition: 'top-right' | 'bottom-right' | 'bottom-center';
}

export default function PrintPreview({ reportType, reportData, onClose }: PrintPreviewProps) {
  const [settings, setSettings] = useState<PrintSettings>({
    companyName: '氧化加工厂',
    reportTitle: getDefaultTitle(reportType),
    period: reportData.period || '',
    showSeal: false,
    sealImage: null,
    sealPosition: 'bottom-right'
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handleSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSettings(prev => ({
          ...prev,
          sealImage: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        }
      `}</style>

      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">打印预览</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{settings.reportTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="打印设置"
              >
                <Settings size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Printer size={18} />
                打印
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-6">
              {/* Settings Panel */}
              {showSettings && (
                <div className="w-80 flex-shrink-0 space-y-4 no-print">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">打印设置</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        公司名称
                      </label>
                      <input
                        type="text"
                        value={settings.companyName}
                        onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        报表标题
                      </label>
                      <input
                        type="text"
                        value={settings.reportTitle}
                        onChange={(e) => setSettings(prev => ({ ...prev, reportTitle: e.target.value }))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        会计期间
                      </label>
                      <input
                        type="text"
                        value={settings.period}
                        onChange={(e) => setSettings(prev => ({ ...prev, period: e.target.value }))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                      />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          显示公章
                        </label>
                        <input
                          type="checkbox"
                          checked={settings.showSeal}
                          onChange={(e) => setSettings(prev => ({ ...prev, showSeal: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </div>

                      {settings.showSeal && (
                        <>
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              公章位置
                            </label>
                            <select
                              value={settings.sealPosition}
                              onChange={(e) => setSettings(prev => ({ ...prev, sealPosition: e.target.value as any }))}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                            >
                              <option value="top-right">右上角</option>
                              <option value="bottom-right">右下角</option>
                              <option value="bottom-center">底部居中</option>
                            </select>
                          </div>

                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleSealUpload}
                              className="hidden"
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                              <Upload size={16} />
                              {settings.sealImage ? '更换公章图片' : '上传公章图片'}
                            </button>
                          </div>

                          {settings.sealImage && (
                            <div className="mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg">
                              <img src={settings.sealImage} alt="公章预览" className="w-20 h-20 object-contain mx-auto" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Print Preview Area */}
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-inner p-8 min-h-[800px]">
                <div id="print-area" ref={printAreaRef} className="max-w-4xl mx-auto">
                  {renderReportContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  function renderReportContent() {
    if (reportType === 'voucher') return renderVoucher();
    
    return (
      <div className="space-y-6">
        {/* Report Header */}
        <div className="text-center border-b-2 border-slate-900 pb-6 relative">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {settings.companyName}
          </h1>
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {settings.reportTitle}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            会计期间：{settings.period}
          </p>
          
          {/* Seal - Top Right */}
          {settings.showSeal && settings.sealImage && settings.sealPosition === 'top-right' && (
            <div className="absolute top-0 right-0">
              <img src={settings.sealImage} alt="公章" className="w-24 h-24 object-contain" />
            </div>
          )}
        </div>

        {/* Report Body */}
        <div className="space-y-4">
          {reportType === 'balance_sheet' && renderBalanceSheet()}
          {reportType === 'income_statement' && renderIncomeStatement()}
          {reportType === 'cash_flow' && renderCashFlow()}
          {reportType === 'financial_ratios' && renderFinancialRatios()}
        </div>

        {/* Report Footer */}
        <div className="mt-12 pt-6 border-t border-slate-300 dark:border-slate-700 relative">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <div>
              <p>编制单位：{settings.companyName}</p>
              <p className="mt-1">编制日期：{new Date().toLocaleDateString('zh-CN')}</p>
            </div>
            <div className="text-right">
              <p>单位：人民币元</p>
            </div>
          </div>

          {/* Seal - Bottom Right */}
          {settings.showSeal && settings.sealImage && settings.sealPosition === 'bottom-right' && (
            <div className="absolute bottom-0 right-0">
              <img src={settings.sealImage} alt="公章" className="w-24 h-24 object-contain" />
            </div>
          )}

          {/* Seal - Bottom Center */}
          {settings.showSeal && settings.sealImage && settings.sealPosition === 'bottom-center' && (
            <div className="flex justify-center mt-4">
              <img src={settings.sealImage} alt="公章" className="w-24 h-24 object-contain" />
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderVoucher() {
    const v = reportData;
    return (
      <div className="p-8 border-2 border-slate-900 bg-white min-h-[500px] flex flex-col">
        {/* Voucher Header */}
        <div className="flex justify-between items-end mb-6">
          <div className="w-1/3">
            <p className="text-sm font-bold">单位：{settings.companyName}</p>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-3xl font-bold tracking-widest border-b-4 border-double border-slate-900 pb-1">记 账 凭 证</h1>
            <p className="text-sm mt-2 font-mono">{v.date}</p>
          </div>
          <div className="w-1/3 text-right">
            <p className="text-sm">第 {v.voucher_no} 号</p>
          </div>
        </div>

        {/* Voucher Table */}
        <table className="w-full border-collapse border-2 border-slate-900 flex-1">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-2 border-slate-900 px-4 py-3 text-center font-bold w-1/3">摘  要</th>
              <th className="border-2 border-slate-900 px-4 py-3 text-center font-bold w-1/3">会 计 科 目</th>
              <th className="border-2 border-slate-900 px-4 py-3 text-center font-bold w-1/6">借 方 金 额</th>
              <th className="border-2 border-slate-900 px-4 py-3 text-center font-bold w-1/6">贷 方 金 额</th>
            </tr>
          </thead>
          <tbody>
            {v.lines.map((line: any, idx: number) => (
              <tr key={idx} className="h-12">
                <td className="border-2 border-slate-900 px-4 py-2 text-sm">{line.notes || v.notes}</td>
                <td className="border-2 border-slate-900 px-4 py-2 text-sm">
                  <div className="font-bold">{line.account_name || line.account_id}</div>
                  {line.auxiliary_name && <div className="text-xs text-slate-500">[{line.auxiliary_name}]</div>}
                </td>
                <td className="border-2 border-slate-900 px-4 py-2 text-right font-mono">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                <td className="border-2 border-slate-900 px-4 py-2 text-right font-mono">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
              </tr>
            ))}
            {/* Fill empty rows to maintain height */}
            {Array.from({ length: Math.max(0, 5 - v.lines.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-12">
                <td className="border-2 border-slate-900 px-4 py-2"></td>
                <td className="border-2 border-slate-900 px-4 py-2"></td>
                <td className="border-2 border-slate-900 px-4 py-2"></td>
                <td className="border-2 border-slate-900 px-4 py-2"></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="h-12 bg-slate-50 font-bold">
              <td className="border-2 border-slate-900 px-4 py-2" colSpan={2}>
                合计：{numberToChinese(v.total_debit || v.lines.reduce((acc: number, l: any) => acc + (l.debit || 0), 0))}
              </td>
              <td className="border-2 border-slate-900 px-4 py-2 text-right font-mono">
                {formatCurrency(v.total_debit || v.lines.reduce((acc: number, l: any) => acc + (l.debit || 0), 0))}
              </td>
              <td className="border-2 border-slate-900 px-4 py-2 text-right font-mono">
                {formatCurrency(v.total_credit || v.lines.reduce((acc: number, l: any) => acc + (l.credit || 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Voucher Footer */}
        <div className="mt-6 flex justify-between text-sm font-bold px-4">
          <p>核准：________________</p>
          <p>审核：________________</p>
          <p>记账：________________</p>
          <p>出纳：________________</p>
          <p>制单：{v.created_by || '管理员'}</p>
        </div>
      </div>
    );
  }

  function numberToChinese(n: number): string {
    const fraction = ['角', '分'];
    const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
    let s = '';
    for (let i = 0; i < fraction.length; i++) {
      s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
    }
    s = s || '整';
    n = Math.floor(n);
    for (let i = 0; i < unit[0].length && n > 0; i++) {
      let p = '';
      for (let j = 0; j < unit[1].length && n > 0; j++) {
        p = digit[n % 10] + unit[1][j] + p;
        n = Math.floor(n / 10);
      }
      s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
    }
    return s.replace(/(零.)*零元/, '元')
      .replace(/(零.)+/g, '零')
      .replace(/^整$/, '零元整');
  }

  function renderBalanceSheet() {
    const bs = reportData;
    return (
      <div className="grid grid-cols-2 gap-8">
        {/* Assets */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="text-left py-2 font-bold">资产</th>
                <th className="text-right py-2 font-bold">金额</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-200">
                <td className="py-2 font-semibold">流动资产：</td>
                <td></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">货币资金</td>
                <td className="text-right">{formatCurrency(bs.assets.current_assets.cash)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">应收账款</td>
                <td className="text-right">{formatCurrency(bs.assets.current_assets.receivables)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">存货</td>
                <td className="text-right">{formatCurrency(bs.assets.current_assets.inventory)}</td>
              </tr>
              <tr className="border-b-2 border-slate-400">
                <td className="py-2 font-semibold">流动资产合计</td>
                <td className="text-right font-semibold">{formatCurrency(bs.assets.current_assets.total)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 font-semibold">非流动资产：</td>
                <td></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">固定资产净值</td>
                <td className="text-right">{formatCurrency(bs.assets.non_current_assets.net_fixed_assets)}</td>
              </tr>
              <tr className="border-b-2 border-slate-400">
                <td className="py-2 font-semibold">非流动资产合计</td>
                <td className="text-right font-semibold">{formatCurrency(bs.assets.non_current_assets.total)}</td>
              </tr>
              <tr className="border-b-2 border-slate-900">
                <td className="py-2 font-bold">资产总计</td>
                <td className="text-right font-bold">{formatCurrency(bs.assets.total_assets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Liabilities and Equity */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="text-left py-2 font-bold">负债和所有者权益</th>
                <th className="text-right py-2 font-bold">金额</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-200">
                <td className="py-2 font-semibold">流动负债：</td>
                <td></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">应付账款</td>
                <td className="text-right">{formatCurrency(bs.liabilities.current_liabilities.payables)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">应交税费</td>
                <td className="text-right">{formatCurrency(bs.liabilities.current_liabilities.tax_payable)}</td>
              </tr>
              <tr className="border-b-2 border-slate-400">
                <td className="py-2 font-semibold">流动负债合计</td>
                <td className="text-right font-semibold">{formatCurrency(bs.liabilities.current_liabilities.total)}</td>
              </tr>
              <tr className="border-b-2 border-slate-400">
                <td className="py-2 font-semibold">负债合计</td>
                <td className="text-right font-semibold">{formatCurrency(bs.liabilities.total_liabilities)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 font-semibold">所有者权益：</td>
                <td></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">实收资本</td>
                <td className="text-right">{formatCurrency(bs.equity.capital)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">未分配利润</td>
                <td className="text-right">{formatCurrency(bs.equity.retained_earnings)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 pl-4">本年利润</td>
                <td className="text-right">{formatCurrency(bs.equity.current_profit)}</td>
              </tr>
              <tr className="border-b-2 border-slate-400">
                <td className="py-2 font-semibold">所有者权益合计</td>
                <td className="text-right font-semibold">{formatCurrency(bs.equity.total_equity)}</td>
              </tr>
              <tr className="border-b-2 border-slate-900">
                <td className="py-2 font-bold">负债和所有者权益总计</td>
                <td className="text-right font-bold">{formatCurrency(bs.liabilities.total_liabilities + bs.equity.total_equity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderIncomeStatement() {
    const is = reportData;
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="text-left py-2 font-bold">项目</th>
            <th className="text-right py-2 font-bold">金额</th>
          </tr>
        </thead>
        <tbody className="text-slate-700 dark:text-slate-300">
          <tr className="border-b border-slate-200">
            <td className="py-2 font-semibold">一、营业收入</td>
            <td className="text-right font-semibold">{formatCurrency(is.revenue.operating_revenue)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">减：营业成本</td>
            <td className="text-right">{formatCurrency(is.cost.operating_cost)}</td>
          </tr>
          <tr className="border-b-2 border-slate-400">
            <td className="py-2 font-semibold">二、营业毛利</td>
            <td className="text-right font-semibold">{formatCurrency(is.cost.gross_profit)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">减：销售费用</td>
            <td className="text-right">{formatCurrency(is.expenses.selling_expense)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-8">管理费用</td>
            <td className="text-right">{formatCurrency(is.expenses.administrative_expense)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-8">财务费用</td>
            <td className="text-right">{formatCurrency(is.expenses.financial_expense)}</td>
          </tr>
          <tr className="border-b-2 border-slate-400">
            <td className="py-2 font-semibold">三、营业利润</td>
            <td className="text-right font-semibold">{formatCurrency(is.profit.operating_profit)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">加：营业外收入</td>
            <td className="text-right">{formatCurrency(is.profit.non_operating_income)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">减：营业外支出</td>
            <td className="text-right">{formatCurrency(is.profit.non_operating_expense)}</td>
          </tr>
          <tr className="border-b-2 border-slate-400">
            <td className="py-2 font-semibold">四、利润总额</td>
            <td className="text-right font-semibold">{formatCurrency(is.profit.profit_before_tax)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">减：所得税费用</td>
            <td className="text-right">{formatCurrency(is.profit.income_tax)}</td>
          </tr>
          <tr className="border-b-2 border-slate-900">
            <td className="py-2 font-bold">五、净利润</td>
            <td className="text-right font-bold">{formatCurrency(is.profit.net_profit)}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  function renderCashFlow() {
    const cf = reportData;
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="text-left py-2 font-bold">项目</th>
            <th className="text-right py-2 font-bold">金额</th>
          </tr>
        </thead>
        <tbody className="text-slate-700 dark:text-slate-300">
          <tr className="border-b border-slate-200">
            <td className="py-2 font-semibold">一、经营活动产生的现金流量</td>
            <td></td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">现金流入</td>
            <td className="text-right">{formatCurrency(cf.operating_activities.cash_inflows)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">现金流出</td>
            <td className="text-right">{formatCurrency(cf.operating_activities.cash_outflows)}</td>
          </tr>
          <tr className="border-b-2 border-slate-400">
            <td className="py-2 font-semibold">经营活动现金流量净额</td>
            <td className="text-right font-semibold">{formatCurrency(cf.operating_activities.net_cash_flow)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 font-semibold">二、投资活动产生的现金流量</td>
            <td></td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">现金流入</td>
            <td className="text-right">{formatCurrency(cf.investing_activities.cash_inflows)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">现金流出</td>
            <td className="text-right">{formatCurrency(cf.investing_activities.cash_outflows)}</td>
          </tr>
          <tr className="border-b-2 border-slate-400">
            <td className="py-2 font-semibold">投资活动现金流量净额</td>
            <td className="text-right font-semibold">{formatCurrency(cf.investing_activities.net_cash_flow)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 font-semibold">三、筹资活动产生的现金流量</td>
            <td></td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">现金流入</td>
            <td className="text-right">{formatCurrency(cf.financing_activities.cash_inflows)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">现金流出</td>
            <td className="text-right">{formatCurrency(cf.financing_activities.cash_outflows)}</td>
          </tr>
          <tr className="border-b-2 border-slate-400">
            <td className="py-2 font-semibold">筹资活动现金流量净额</td>
            <td className="text-right font-semibold">{formatCurrency(cf.financing_activities.net_cash_flow)}</td>
          </tr>
          <tr className="border-b-2 border-slate-900">
            <td className="py-2 font-bold">四、现金及现金等价物净增加额</td>
            <td className="text-right font-bold">{formatCurrency(cf.net_increase_in_cash)}</td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-2 pl-4">加：期初现金余额</td>
            <td className="text-right">{formatCurrency(cf.beginning_cash_balance)}</td>
          </tr>
          <tr className="border-b-2 border-slate-900">
            <td className="py-2 font-bold">五、期末现金余额</td>
            <td className="text-right font-bold">{formatCurrency(cf.ending_cash_balance)}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  function renderFinancialRatios() {
    const ratios = reportData;
    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 pb-2 border-b-2 border-slate-900">
            偿债能力指标
          </h3>
          <table className="w-full text-sm">
            <tbody className="text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-200">
                <td className="py-2">流动比率</td>
                <td className="text-right">{ratios.solvency.current_ratio.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">速动比率</td>
                <td className="text-right">{ratios.solvency.quick_ratio.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">资产负债率</td>
                <td className="text-right">{(ratios.solvency.debt_to_asset_ratio * 100).toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 pb-2 border-b-2 border-slate-900">
            营运能力指标
          </h3>
          <table className="w-full text-sm">
            <tbody className="text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-200">
                <td className="py-2">应收账款周转率</td>
                <td className="text-right">{ratios.operational.receivables_turnover.toFixed(2)} 次</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">存货周转率</td>
                <td className="text-right">{ratios.operational.inventory_turnover.toFixed(2)} 次</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">总资产周转率</td>
                <td className="text-right">{ratios.operational.total_asset_turnover.toFixed(2)} 次</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 pb-2 border-b-2 border-slate-900">
            盈利能力指标
          </h3>
          <table className="w-full text-sm">
            <tbody className="text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-200">
                <td className="py-2">销售毛利率</td>
                <td className="text-right">{(ratios.profitability.gross_margin * 100).toFixed(2)}%</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">销售净利率</td>
                <td className="text-right">{(ratios.profitability.net_margin * 100).toFixed(2)}%</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">净资产收益率 (ROE)</td>
                <td className="text-right">{(ratios.profitability.roe * 100).toFixed(2)}%</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2">总资产收益率 (ROA)</td>
                <td className="text-right">{(ratios.profitability.roa * 100).toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

function getDefaultTitle(reportType: string): string {
  switch (reportType) {
    case 'balance_sheet':
      return '资产负债表';
    case 'income_statement':
      return '利润表';
    case 'cash_flow':
      return '现金流量表';
    case 'financial_ratios':
      return '财务指标分析表';
    default:
      return '财务报表';
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
