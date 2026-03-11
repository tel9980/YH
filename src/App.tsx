import React, { useState } from "react";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import ProductLibrary from "./components/ProductLibrary";
import OrderEntry from "./components/OrderEntry";
import IncomeEntry from "./components/IncomeEntry";
import ExpenseEntry from "./components/ExpenseEntry";
import SupplierBillEntry from "./components/SupplierBillEntry";
import Reports from "./components/Reports";
import ContactManagement from "./components/ContactManagement";
import AIAssistant from "./components/AIAssistant";
import Backup from "./components/Backup";
import InventoryManagement from "./components/InventoryManagement";
import Archive from "./components/Archive";
import Settings from "./components/Settings";
import FixedAssets from "./components/FixedAssets";
import Accounts from "./components/Accounts";
import Vouchers from "./components/Vouchers";
import CashJournal from "./components/Journal";
import ClosingManagement from "./components/ClosingManagement";
import ClosingProcess from "./pages/Closing/ClosingProcess";
import ProductCost from "./components/ProductCost";
import ProductionOrders from "./components/ProductionOrders";
import CostVariance from "./components/CostVariance";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard setActiveTab={setActiveTab} />;
      case "products": return <ProductLibrary />;
      case "contacts": return <ContactManagement />;
      case "orders": return <OrderEntry />;
      case "supplier-bills": return <SupplierBillEntry />;
      case "incomes": return <IncomeEntry />;
      case "expenses": return <ExpenseEntry />;
      case "vouchers": return <Vouchers />;
      case "journal": return <CashJournal />;
      case "fixed-assets": return <FixedAssets />;
      case "accounts": return <Accounts />;
      case "inventory": return <InventoryManagement />;
      case "archive": return <Archive />;
      case "closing": return <ClosingProcess />;
      case "reports": return <Reports />;
      case "product-cost": return <ProductCost />;
      case "production-orders": return <ProductionOrders />;
      case "cost-variance": return <CostVariance />;
      case "ai": return <AIAssistant />;
      case "backup": return <Backup />;
      case "settings": return <Settings />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <ToastProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </ToastProvider>
  );
}
