import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { 
  LayoutDashboard, Receipt, PieChart, LogOut, Upload, Menu, X,
  TrendingUp, Sun, Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload Receipt', icon: Upload },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
  { id: 'budgets', label: 'Budgets', icon: TrendingUp },
];

export default function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold text-sidebar-foreground tracking-tight">ExpenseAI</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
                activeTab === item.id
                  ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/40 mb-3 truncate font-medium">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 lg:px-8 h-16 flex items-center">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 text-foreground">
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="font-heading text-lg font-semibold text-foreground capitalize tracking-tight">
            {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
          </h2>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full w-9 h-9 border-border hover:bg-muted"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
