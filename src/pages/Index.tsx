import { useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import AuthPage from '@/pages/AuthPage';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardOverview from '@/components/DashboardOverview';
import ReceiptUpload from '@/components/ReceiptUpload';
import ExpenseList from '@/components/ExpenseList';
import AnalyticsView from '@/components/AnalyticsView';
import BudgetManager from '@/components/BudgetManager';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const renderContent = () => {
    switch (activeTab) {
      case 'upload': return <ReceiptUpload />;
      case 'expenses': return <ExpenseList />;
      case 'analytics': return <AnalyticsView />;
      case 'budgets': return <BudgetManager />;
      default: return <DashboardOverview />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

export default function Index() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
