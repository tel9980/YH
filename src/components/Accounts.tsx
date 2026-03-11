import React, { useState, useEffect } from "react";
import { useToast } from "./Toast";
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, BookUser, Power, PowerOff, Settings } from "lucide-react";
import { Account, AuxiliaryType } from "../types";

interface AccountWithChildren extends Account {
  children?: AccountWithChildren[];
}

export default function Accounts() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<AccountWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAuxiliary, setEditingAuxiliary] = useState<string | null>(null);
  const [auxiliaryTypes, setAuxiliaryTypes] = useState<AuxiliaryType[]>([]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      const tree = buildTree(data);
      setAccounts(tree);
    } catch (e) {
      showToast("加载会计科目失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const buildTree = (list: Account[]): AccountWithChildren[] => {
    const map: { [key: string]: AccountWithChildren } = {};
    const roots: AccountWithChildren[] = [];
    list.forEach(node => {
      map[node.id] = { ...node, children: [] };
    });
    list.forEach(node => {
      if (node.parent_id && map[node.parent_id]) {
        map[node.parent_id].children?.push(map[node.id]);
      } else {
        roots.push(map[node.id]);
      }
    });
    return roots;
  };

  const toggleAccountStatus = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/status`, {
        method: "PATCH"
      });
      if (res.ok) {
        showToast("科目状态已更新", "success");
        fetchAccounts();
      } else {
        const error = await res.json();
        showToast(error.error?.message || "状态更新失败", "error");
      }
    } catch (e) {
      showToast("状态更新失败", "error");
    }
  };

  const openAuxiliaryConfig = (account: Account) => {
    setEditingAuxiliary(account.id);
    setAuxiliaryTypes(account.auxiliary_types || []);
  };

  const saveAuxiliaryConfig = async () => {
    if (!editingAuxiliary) return;
    
    try {
      const res = await fetch(`/api/accounts/${editingAuxiliary}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auxiliary_types: auxiliaryTypes })
      });
      
      if (res.ok) {
        showToast("辅助核算配置已保存", "success");
        setEditingAuxiliary(null);
        fetchAccounts();
      } else {
        const error = await res.json();
        showToast(error.error?.message || "保存失败", "error");
      }
    } catch (e) {
      showToast("保存失败", "error");
    }
  };

  const toggleAuxiliaryType = (type: AuxiliaryType['type']) => {
    const existing = auxiliaryTypes.find(t => t.type === type);
    if (existing) {
      setAuxiliaryTypes(auxiliaryTypes.filter(t => t.type !== type));
    } else {
      setAuxiliaryTypes([...auxiliaryTypes, { type, required: false }]);
    }
  };

  const toggleAuxiliaryRequired = (type: AuxiliaryType['type']) => {
    setAuxiliaryTypes(auxiliaryTypes.map(t => 
      t.type === type ? { ...t, required: !t.required } : t
    ));
  };

  const getAuxiliaryTypeLabel = (type: AuxiliaryType['type']): string => {
    const labels = {
      customer: '客户往来',
      supplier: '供应商往来',
      department: '部门核算',
      project: '项目核算',
      inventory: '存货核算'
    };
    return labels[type];
  };

  const getLevelBadgeColor = (level: number): string => {
    const colors = {
      1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      2: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      3: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    };
    return colors[level as keyof typeof colors] || colors[1];
  };

  const AccountRow = ({ account, level }: { account: AccountWithChildren, level: number }) => {
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = account.children && account.children.length > 0;
    const isInactive = account.status === 'inactive';
    
    return (
      <>
        <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isInactive ? 'opacity-50' : ''}`}>
          <td style={{ paddingLeft: `${level * 24 + 16}px` }} className="py-3">
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              {!hasChildren && <div className="w-6" />}
              <span className="font-medium text-slate-800 dark:text-slate-200">{account.id} - {account.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getLevelBadgeColor(account.level)}`}>
                {account.level}级
              </span>
              {isInactive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  已停用
                </span>
              )}
            </div>
          </td>
          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{account.category}</td>
          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{account.type}</td>
          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
            {account.auxiliary_types && account.auxiliary_types.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {account.auxiliary_types.map(aux => (
                  <span key={aux.type} className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    {getAuxiliaryTypeLabel(aux.type)}
                    {aux.required && '*'}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </td>
          <td className="px-6 py-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={() => toggleAccountStatus(account.id)}
                className={`p-2 transition-colors ${isInactive ? 'text-slate-400 hover:text-green-600' : 'text-green-600 hover:text-slate-400'}`}
                title={isInactive ? '启用科目' : '停用科目'}
              >
                {isInactive ? <PowerOff size={16} /> : <Power size={16} />}
              </button>
              <button 
                onClick={() => openAuxiliaryConfig(account)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                title="配置辅助核算"
              >
                <Settings size={16} />
              </button>
              <button className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="删除科目">
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
        {isOpen && hasChildren && account.children!.map(child => (
          <AccountRow key={child.id} account={child} level={level + 1} />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-indigo-600 dark:text-indigo-400">
          <BookUser className="mr-3" size={28} />
          <h3 className="text-2xl font-bold">会计科目管理</h3>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-100 dark:shadow-none">
          <Plus size={18} className="mr-2" />
          新增科目
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <tr>
              <th className="px-6 py-4">科目名称</th>
              <th className="px-6 py-4">类别</th>
              <th className="px-6 py-4">类型</th>
              <th className="px-6 py-4">辅助核算</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => <AccountRow key={acc.id} account={acc} level={0} />)}
          </tbody>
        </table>
      </div>

      {/* 辅助核算配置弹窗 */}
      {editingAuxiliary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingAuxiliary(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">配置辅助核算</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              选择该科目需要的辅助核算类型，标记为必填的类型在录入凭证时必须填写。
            </p>
            
            <div className="space-y-3 mb-6">
              {(['customer', 'supplier', 'department', 'project', 'inventory'] as const).map(type => {
                const isSelected = auxiliaryTypes.some(t => t.type === type);
                const auxType = auxiliaryTypes.find(t => t.type === type);
                
                return (
                  <div key={type} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAuxiliaryType(type)}
                        className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {getAuxiliaryTypeLabel(type)}
                      </span>
                    </label>
                    {isSelected && (
                      <label className="flex items-center cursor-pointer text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={auxType?.required || false}
                          onChange={() => toggleAuxiliaryRequired(type)}
                          className="mr-1 w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        必填
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingAuxiliary(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveAuxiliaryConfig}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
