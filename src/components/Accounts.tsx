import React, { useState, useEffect } from "react";
import { useToast } from "./Toast";
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, BookUser } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: string;
  category: string;
  parent_id: string | null;
  children?: Account[];
}

export default function Accounts() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

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

  const buildTree = (list: Account[]): Account[] => {
    const map: { [key: string]: Account } = {};
    const roots: Account[] = [];
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

  const AccountRow = ({ account, level }: { account: Account, level: number }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <>
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <td style={{ paddingLeft: `${level * 24 + 16}px` }} className="py-3">
            <div className="flex items-center">
              {account.children && account.children.length > 0 && (
                <button onClick={() => setIsOpen(!isOpen)} className="mr-2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              <span className="font-medium text-slate-800 dark:text-slate-200">{account.id} - {account.name}</span>
            </div>
          </td>
          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{account.category}</td>
          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{account.type}</td>
          <td className="px-6 py-3 text-center">
            <button className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
              <Trash2 size={16} />
            </button>
          </td>
        </tr>
        {isOpen && account.children && account.children.map(child => (
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
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => <AccountRow key={acc.id} account={acc} level={0} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
