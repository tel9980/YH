import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  HandCoins, 
  Wallet, 
  FileBarChart, 
  Bot, 
  Database,
  Menu,
  X,
  Users,
  Truck,
  Boxes,
  Lock,
  Moon,
  Sun,
  Settings as SettingsIcon,
  Search,
  ChevronRight,
  Building2,
  BookUser,
  FileText,
  History,
  PlusCircle,
  BarChart3,
  FileStack,
  Archive,
  CloudUpload
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useToast } from "./Toast";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const ALL_NAV_ITEMS = [
  { id: "dashboard", label: "数据大屏", icon: LayoutDashboard },
  { id: "orders", label: "送货单录入", icon: PlusCircle },
  { id: "incomes", label: "收款", icon: HandCoins },
  { id: "expenses", label: "付款/支出", icon: Wallet },
  { id: "vouchers", label: "记账凭证", icon: FileText },
  { id: "journal", label: "出纳日记账", icon: History },
  { id: "fixed-assets", label: "固定资产", icon: Building2 },
  { id: "accounts", label: "会计科目", icon: BookUser },
  { id: "inventory", label: "库存管理", icon: Boxes },
  { id: "product-cost", label: "产品成本", icon: BarChart3 },
  { id: "production-orders", label: "生产订单", icon: ClipboardList },
  { id: "cost-variance", label: "成本差异", icon: BarChart3 },
  { id: "reports", label: "报表中心", icon: BarChart3 },
  { id: "contacts", label: "往来管理", icon: Users },
  { id: "products", label: "产品库", icon: Package },
  { id: "supplier-bills", label: "供应商对账", icon: FileStack },
  { id: "archive", label: "归档结转", icon: Archive },
  { id: "closing", label: "月度结账", icon: Lock },
  { id: "ai", label: "AI 助手", icon: Bot },
  { id: "backup", label: "云端备份", icon: CloudUpload },
  { id: "settings", label: "系统设置", icon: SettingsIcon },
];

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState({ inventory: 0, overdue: 0 });
  const [navItems, setNavItems] = useState(ALL_NAV_ITEMS);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" || 
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ orders: any[], customers: any[], products: any[] } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const updateNav = () => {
      const saved = localStorage.getItem("app_modules_config");
      if (saved) {
        const config = JSON.parse(saved) as { id: string, label: string, enabled: boolean }[];
        const filtered = ALL_NAV_ITEMS.map(item => {
          const cfg = config.find(c => c.id === item.id);
          if (cfg) {
            return { ...item, label: cfg.label, enabled: cfg.enabled };
          }
          return { ...item, enabled: true };
        }).filter(item => (item as any).enabled !== false);
        setNavItems(filtered);
      } else {
        setNavItems(ALL_NAV_ITEMS);
      }
    };

    updateNav();
    window.addEventListener("storage_config_updated", updateNav);
    return () => window.removeEventListener("storage_config_updated", updateNav);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchAlerts = () => {
      fetch("/api/stats").then(res => res.json()).then(data => {
        setAlerts({ 
          inventory: data.inventoryAlerts || 0,
          overdue: 0
        });
        
        if (data.inventoryAlerts > 0 && Notification.permission === "granted") {
          new Notification("库存预警", { body: `有 ${data.inventoryAlerts} 项物料库存不足，请及时查看。` });
        }
      });
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (globalSearch.length > 1) {
      const timer = setTimeout(() => {
        fetch(`/api/search?q=${encodeURIComponent(globalSearch)}`)
          .then(res => res.json())
          .then(setSearchResults);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults(null);
    }
  }, [globalSearch]);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative transition-colors duration-300">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col z-50",
          "fixed inset-y-0 left-0 lg:relative",
          isSidebarOpen ? "w-64" : "w-20",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-800 h-16">
          {(isSidebarOpen || isMobileMenuOpen) && <h1 className="font-bold text-white truncate">小会计 v4.2</h1>}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-slate-800 rounded hidden lg:block"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 hover:bg-slate-800 rounded lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "w-full flex items-center px-6 py-3 transition-colors relative",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={20} className={cn((isSidebarOpen || isMobileMenuOpen) ? "mr-4" : "mx-auto")} />
              {(isSidebarOpen || isMobileMenuOpen) && <span>{item.label}</span>}
              {item.id === "inventory" && alerts.inventory > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {alerts.inventory}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800 text-xs opacity-50">
          {(isSidebarOpen || isMobileMenuOpen) ? "小会计 v4.2 | 数据本地" : "v4.2"}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center px-4 lg:px-8 justify-between shadow-sm shrink-0 transition-colors duration-300">
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 mr-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded lg:hidden"
            >
              <Menu size={20} className="dark:text-slate-200" />
            </button>
            <h2 className="text-lg lg:text-xl font-semibold text-slate-800 dark:text-slate-100 truncate">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>
          
          {/* Global Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8 relative">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="搜索订单、客户、产品..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-100"
              />
              {isSearchOpen && searchResults && (globalSearch.length > 1) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[400px] overflow-y-auto p-2">
                    {searchResults.customers.length > 0 && (
                      <div className="mb-4">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">客户</div>
                        {searchResults.customers.map(c => (
                          <button 
                            key={c.id} 
                            onClick={() => { setActiveTab("contacts"); setIsSearchOpen(false); setGlobalSearch(""); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between group"
                          >
                            <span className="text-sm dark:text-slate-200">{c.name}</span>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.products.length > 0 && (
                      <div className="mb-4">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">产品</div>
                        {searchResults.products.map(p => (
                          <button 
                            key={p.id} 
                            onClick={() => { setActiveTab("products"); setIsSearchOpen(false); setGlobalSearch(""); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between group"
                          >
                            <span className="text-sm dark:text-slate-200">{p.name}</span>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.orders.length > 0 && (
                      <div>
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">订单</div>
                        {searchResults.orders.map(o => (
                          <button 
                            key={o.id} 
                            onClick={() => { setActiveTab("reports"); setIsSearchOpen(false); setGlobalSearch(""); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg group"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-medium dark:text-slate-200">{o.customer} - {o.product}</span>
                              <span className="text-[10px] font-mono text-slate-400">{o.date}</span>
                            </div>
                            <div className="text-xs text-slate-500 truncate">{o.qty}{o.unit} | ¥{o.total}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.customers.length === 0 && searchResults.products.length === 0 && searchResults.orders.length === 0 && (
                      <div className="p-8 text-center text-slate-400 italic text-sm">未找到匹配项</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
            >
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
            </button>
            <span className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">{new Date().toLocaleDateString()}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          {children}
        </div>
      </main>
    </div>
  );
}
