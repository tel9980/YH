import React, { useState, useEffect } from "react";
import { Database, RefreshCw, Download, ShieldCheck, Cloud, CloudUpload } from "lucide-react";
import { useToast } from "./Toast";

export default function Backup() {
  const { showToast } = useToast();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then(res => res.json())
      .then(data => setIsGoogleConnected(data.connected));

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
        showToast("Google Drive 连接成功！", "success");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      const { url } = await res.json();
      window.open(url, 'google_auth_popup', 'width=600,height=700');
    } catch (err) {
      showToast("无法获取认证链接", "error");
    }
  };

  const handleGoogleBackup = async () => {
    setIsBackingUp(true);
    showToast("正在上传备份至 Google Drive...", "info");
    try {
      const res = await fetch("/api/backup/google-drive", { method: "POST" });
      if (res.ok) {
        showToast("云端备份成功！", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "云端备份失败", "error");
      }
    } catch (err) {
      showToast("网络错误", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleMockData = async () => {
    if (confirm("确定要重置并加载模拟数据吗？现有数据将被清空。")) {
      try {
        const res = await fetch("/api/mock-data", { method: "POST" });
        if (res.ok) {
          showToast("模拟数据加载成功！", "success");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showToast("加载模拟数据失败", "error");
        }
      } catch (err) {
        showToast("网络错误", "error");
      }
    }
  };

  const handleBackup = async () => {
    showToast("正在准备备份文件...", "info");
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("备份文件下载成功", "success");
      } else {
        showToast("备份失败", "error");
      }
    } catch (err) {
      showToast("备份过程中发生错误", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center mb-8">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl mr-4">
            <Database size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">数据管理与备份</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">确保您的工厂财务数据安全，支持本地备份与恢复。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors group">
            <div className="flex items-center mb-4">
              <Download className="text-indigo-600 dark:text-indigo-400 mr-3" size={24} />
              <h4 className="font-semibold dark:text-slate-200">一键备份全部数据</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">导出所有订单、收支记录为 JSON 备份文件，并下载数据库备份文件。</p>
            <button 
              onClick={handleBackup}
              className="w-full py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              立即备份
            </button>
          </div>

          <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors group">
            <div className="flex items-center mb-4">
              <Cloud className="text-emerald-600 dark:text-emerald-400 mr-3" size={24} />
              <h4 className="font-semibold dark:text-slate-200">云端备份 (Google Drive)</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">将数据库文件加密上传至您的 Google Drive 空间，实现跨设备数据安全。</p>
            {!isGoogleConnected ? (
              <button 
                onClick={handleConnectGoogle}
                className="w-full py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
              >
                连接 Google Drive
              </button>
            ) : (
              <button 
                onClick={handleGoogleBackup}
                disabled={isBackingUp}
                className="w-full py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {isBackingUp ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    正在上传...
                  </>
                ) : (
                  <>
                    <CloudUpload size={18} className="mr-2" />
                    立即上传备份
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-amber-200 dark:hover:border-amber-700 transition-colors group">
            <div className="flex items-center mb-4">
              <RefreshCw className="text-amber-600 dark:text-amber-400 mr-3" size={24} />
              <h4 className="font-semibold dark:text-slate-200">初始化模拟数据</h4>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">清空现有数据并加载 150 笔全场景测试数据，用于演示或系统测试。</p>
            <button 
              onClick={handleMockData}
              className="w-full py-2 bg-amber-600 dark:bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors"
            >
              加载模拟数据
            </button>
          </div>
        </div>

        <div className="mt-12 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start">
          <ShieldCheck className="text-emerald-600 dark:text-emerald-400 mr-4 mt-1" size={24} />
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200">数据安全说明</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400 list-disc list-inside">
              <li>所有财务数据默认存储在本地 SQLite 数据库中。</li>
              <li>云端备份将文件直接上传至您的私有 Google Drive，本系统不存储您的文件。</li>
              <li>建议每周进行一次备份以防万一。</li>
              <li>系统不会将您的具体财务明细上传至云端（AI 助手仅在提问时发送必要汇总）。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
