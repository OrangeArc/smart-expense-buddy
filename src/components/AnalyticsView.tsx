import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = [
  'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 55%)', 'hsl(200, 70%, 50%)', 'hsl(350, 70%, 55%)',
  'hsl(30, 80%, 55%)', 'hsl(180, 60%, 40%)'
];

export default function AnalyticsView() {
  const { user } = useAuth();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*, categories(name)')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const now = new Date();

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(now, 11 - i);
    const ms = startOfMonth(month);
    const me = endOfMonth(month);
    const total = expenses
      .filter(e => { const d = new Date(e.date); return d >= ms && d <= me; })
      .reduce((s, e) => s + Number(e.amount), 0);
    return { month: format(month, 'MMM yy'), total: Math.round(total * 100) / 100 };
  });

  const categoryMap = new Map<string, number>();
  expenses.forEach(e => {
    const cat = (e as any).categories?.name || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(e.amount));
  });
  const categoryData = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  const merchantMap = new Map<string, number>();
  expenses.forEach(e => {
    merchantMap.set(e.merchant, (merchantMap.get(e.merchant) || 0) + Number(e.amount));
  });
  const merchantData = Array.from(merchantMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= startOfMonth(now) && d <= endOfMonth(now);
  });
  const lastMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= startOfMonth(subMonths(now, 1)) && d <= endOfMonth(subMonths(now, 1));
  });
  const thisTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const lastTotal = lastMonth.reduce((s, e) => s + Number(e.amount), 0);
  const topCategory = categoryData[0];

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--card-foreground))',
  };

  return (
    <div className="space-y-6">
      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm font-medium text-muted-foreground">This Month vs Last</p>
          <p className="font-heading text-xl font-bold text-card-foreground mt-1">
            {lastTotal > 0 ? `${((thisTotal - lastTotal) / lastTotal * 100).toFixed(0)}%` : 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {thisTotal > lastTotal ? 'More spending this month' : 'Less spending this month'}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-muted-foreground">Top Category</p>
          <p className="font-heading text-xl font-bold text-card-foreground mt-1">{topCategory?.name || 'N/A'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {topCategory ? `€${topCategory.value.toFixed(2)} total` : 'No data'}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
          <p className="font-heading text-xl font-bold text-card-foreground mt-1">{expenses.length}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Spending Trend (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`€${v.toFixed(2)}`, 'Total']} />
                <Line type="monotone" dataKey="total" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ fill: 'hsl(217, 91%, 60%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {merchantData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={merchantData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} stroke="hsl(var(--border))" />
                    <Tooltip formatter={(v: number) => `€${v.toFixed(2)}`} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
