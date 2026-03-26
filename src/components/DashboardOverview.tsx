import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, TrendingUp, TrendingDown, Receipt, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const CHART_COLORS = ['hsl(160, 84%, 30%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(120, 50%, 40%)', 'hsl(30, 80%, 55%)', 'hsl(180, 60%, 40%)'];

export default function DashboardOverview() {
  const { user } = useAuth();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*, categories(name, icon)')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('budgets')
        .select('*, categories(name)')
        .eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= thisMonthStart && d <= thisMonthEnd;
  });
  const lastMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });

  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const changePercent = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : 0;

  // Category breakdown
  const categoryMap = new Map<string, number>();
  thisMonthExpenses.forEach(e => {
    const cat = (e as any).categories?.name || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(e.amount));
  });
  const categoryData = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  // Monthly trend (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(now, 5 - i);
    const ms = startOfMonth(month);
    const me = endOfMonth(month);
    const total = expenses
      .filter(e => { const d = new Date(e.date); return d >= ms && d <= me; })
      .reduce((s, e) => s + Number(e.amount), 0);
    return { month: format(month, 'MMM'), total: Math.round(total * 100) / 100 };
  });

  // Budget alerts
  const budgetAlerts = budgets.filter(b => {
    const spent = thisMonthExpenses
      .filter(e => e.category_id === b.category_id)
      .reduce((s, e) => s + Number(e.amount), 0);
    return spent > Number(b.monthly_limit) * 0.8;
  });

  const stats = [
    { label: 'This Month', value: `€${thisMonthTotal.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Last Month', value: `€${lastMonthTotal.toFixed(2)}`, icon: DollarSign, color: 'text-muted-foreground' },
    { label: 'Change', value: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`, icon: changePercent >= 0 ? TrendingUp : TrendingDown, color: changePercent >= 0 ? 'text-destructive' : 'text-success' },
    { label: 'Receipts', value: thisMonthExpenses.length.toString(), icon: Receipt, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="font-heading text-2xl font-bold text-card-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-sm text-card-foreground">
              You're approaching your budget limit in {budgetAlerts.length} {budgetAlerts.length === 1 ? 'category' : 'categories'}!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [`€${value.toFixed(2)}`, 'Total']}
                  />
                  <Bar dataKey="total" fill="hsl(160, 84%, 30%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: €${value}`}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No expenses this month yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {thisMonthExpenses.length > 0 ? (
            <div className="space-y-3">
              {thisMonthExpenses.slice(0, 5).map((expense) => (
                <div key={expense.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-card-foreground">{expense.merchant}</p>
                    <p className="text-xs text-muted-foreground">{(expense as any).categories?.name || 'Uncategorized'} • {format(new Date(expense.date), 'MMM d')}</p>
                  </div>
                  <span className="font-heading font-semibold text-card-foreground">€{Number(expense.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No expenses yet. Upload a receipt to get started!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
