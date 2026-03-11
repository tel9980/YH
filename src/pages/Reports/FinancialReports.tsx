import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, Eye } from 'lucide-react';
import PrintPreview from '../../components/Reports/PrintPreview';
import { useToast } from '../../components/Toast';

export default function FinancialReports() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any>({
    balanceSheet: null,
    incomeStatement: null,
    cashFlow: null,
    financialRatios: null
  });
  const [printPreview, setPrintPreview] = useState<{
    type: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'financial_ratios';
    data: any;
  } | null>(null);

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [balanceSheet, incomeStatement, cashFlow, financialRatios] = await Promise.all([
        fetch(`/api/v7/reports/balance-sheet?period=${period}`).then(r => r.json()),
        fetch(`/api/v7/reports/income-statement?period=${period}`).then(r => r.json()),
        fetch(`/api/v7/reports/cash-flow?period=${period}`).then(r => r.json()),
        fetch(`/api/v7/reports/financial-ratios?period=${period}`).then(r => r.json())
      ]);

      setReports({ balanceSheet, incomeStatement, cashFlow, financialRatios });
    } catch (error) {
      showToast('加载报表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType: string, format: 'excel' | 'pdf') => {
    try {
      const response = await fetch(`/api/v7/reports/export/${format}?reportType=${reportType}&period=${period}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getReportName(reportType)}_${period}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`${format.toUpperCase()} 导出成功`, 'success');
    } catch (error) {
      showToast('导出失败', 'error');
    }
  };

  const handlePrintPreview = (type: any, data: any) => {
    setPrintPreview({ type, data });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">财务报表</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            查看、导出和打印财务报表
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            会计期间：
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balance Sheet */}
        <ReportCard
          title="资产负债表"
          description="Balance Sheet"
          icon={<FileText size={24} />}
          loading={loading}
          onPrintPreview={() => handlePrintPreview('balance_sheet', reports.balanceSheet)}
          onExportExcel={() => handleExport('balance_sheet', 'excel')}
          onExportPDF={() => handleExport('balance_sheet', 'pdf')}
          data={reports.balanceSheet}
        />

        {/* Income Statement */}
        <ReportCard
          title="利润表"
          description="Income Statement"
          icon={<FileText size={24} />}
          loading={loading}
          onPrintPreview={() => handlePrintPreview('income_statement', reports.incomeStatement)}
          onExportExcel={() => handleExport('income_statement', 'excel')}
          onExportPDF={() => handleExport('income_statement', 'pdf')}
          data={reports.incomeStatement}
        />

        {/* Cash Flow Statement */}
        <ReportCard
          title="现金流量表"
          description="Cash Flow Statement"
          icon={<FileText size={24} />}
          loading={loading}
          onPrintPreview={() => handlePrintPreview('cash_flow', reports.cashFlow)}
          onExportExcel={() => handleExport('cash_flow', 'excel')}
          onExportPDF={() => handleExport('cash_flow', 'pdf')}
          data={reports.cashFlow}
        />

        {/* Financial Ratios */}
        <ReportCard
          title="财务指标分析"
          description="Financial Ratios"
          icon={<FileText size={24} />}
          loading={loading}
          onPrintPreview={() => handlePrintPreview('financial_ratios', reports.financialRatios)}
          onExportExcel={() => handleExport('financial_ratios', 'excel')}
          onExportPDF={() => handleExport('financial_ratios', 'pdf')}
          data={reports.financialRatios}
        />
      </div>

      {/* Print Preview Modal */}
      {printPreview && (
        <PrintPreview
          reportType={printPreview.type}
          reportData={printPreview.data}
          onClose={() => setPrintPreview(null)}
        />
      )}
    </div>
  );
}

interface ReportCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  onPrintPreview: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  data: any;
}

function ReportCard({
  title,
  description,
  icon,
  loading,
  onPrintPreview,
  onExportExcel,
  onExportPDF,
  data
}: ReportCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : data ? (
        <div className="space-y-3">
          <button
            onClick={onPrintPreview}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Eye size={18} />
            打印预览
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onExportExcel}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Download size={16} />
              Excel
            </button>
            <button
              onClick={onExportPDF}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
          暂无数据
        </div>
      )}
    </div>
  );
}

function getReportName(reportType: string): string {
  switch (reportType) {
    case 'balance_sheet':
      return '资产负债表';
    case 'income_statement':
      return '利润表';
    case 'cash_flow':
      return '现金流量表';
    case 'financial_ratios':
      return '财务指标分析';
    default:
      return '财务报表';
  }
}
