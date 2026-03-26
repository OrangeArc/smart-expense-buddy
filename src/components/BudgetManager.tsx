import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2 } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function BudgetManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newBudget, setNewBudget] = useState({ category_id: '', monthly_limit: '' });

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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      const now = new Date();
      const { data } = await supabase
        .from('expenses')
        .select('amount, category_id')
        .eq('user_id', user!.id)
        .gte('date', startOfMonth(now).toISOString())
        .lte('date', endOfMonth(now).toISOString());
      return data || [];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('budgets').insert({
        user_id: user!.id,
        category_id: newBudget.category_id,
        monthly_limit: parseFloat(newBudget.monthly_limit),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setNewBudget({ category_id: '', monthly_limit: '' });
      toast({ title: 'Budget added' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: 'Budget removed' });
    },
  });

  const getSpent = (categoryId: string | null) => {
    return expenses
      .filter(e => e.category_id === categoryId)
      .reduce((s, e) => s + Number(e.amount), 0);
  };

  const usedCategoryIds = budgets.map(b => b.category_id);
  const availableCategories = categories.filter(c => !usedCategoryIds.includes(c.id));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Add budget */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Set Monthly Budget</CardTitle>
          <CardDescription>Set spending limits per category to stay on track</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Category</Label>
              <Select value={newBudget.category_id} onValueChange={v => setNewBudget(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-2">
              <Label>Limit (€)</Label>
              <Input type="number" step="0.01" value={newBudget.monthly_limit} onChange={e => setNewBudget(p => ({ ...p, monthly_limit: e.target.value }))} />
            </div>
            <Button onClick={() => addMutation.mutate()} disabled={!newBudget.category_id || !newBudget.monthly_limit}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Budget list */}
      <div className="space-y-3">
        {budgets.map((budget) => {
          const spent = getSpent(budget.category_id);
          const limit = Number(budget.monthly_limit);
          const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isOver = spent > limit;
          const isWarning = percent >= 80;

          return (
            <Card key={budget.id} className={isOver ? 'border-destructive/30' : isWarning ? 'border-warning/30' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-card-foreground">{(budget as any).categories?.name || 'General'}</p>
                    <p className="text-xs text-muted-foreground">
                      €{spent.toFixed(2)} / €{limit.toFixed(2)}
                      {isOver && <span className="text-destructive ml-1">• Over budget!</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(budget.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                <Progress value={percent} className={`h-2 ${isOver ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-warning' : ''}`} />
              </CardContent>
            </Card>
          );
        })}
        {budgets.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            No budgets set yet. Add one above to start tracking your spending limits.
          </div>
        )}
      </div>
    </div>
  );
}
