import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ExpenseList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newExpense, setNewExpense] = useState({ merchant: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), category_id: '', currency: 'EUR' });

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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          merchant: expense.merchant,
          amount: expense.amount,
          date: expense.date,
          category_id: expense.category_id,
          currency: expense.currency,
        })
        .eq('id', expense.id);
      if (error) throw error;

      // Save category correction for AI learning
      if (expense.category_id && expense.merchant) {
        await supabase.from('category_corrections').upsert({
          user_id: user!.id,
          merchant: expense.merchant,
          corrected_category_id: expense.category_id,
        }, { onConflict: 'user_id,merchant' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditingExpense(null);
      toast({ title: 'Expense updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense deleted' });
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        user_id: user!.id,
        merchant: newExpense.merchant,
        amount: parseFloat(newExpense.amount),
        date: newExpense.date,
        category_id: newExpense.category_id || null,
        currency: newExpense.currency,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowAddDialog(false);
      setNewExpense({ merchant: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), category_id: '', currency: 'EUR' });
      toast({ title: 'Expense added' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{expenses.length} expenses</p>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Manually</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Merchant</Label>
                <Input value={newExpense.merchant} onChange={e => setNewExpense(p => ({ ...p, merchant: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newExpense.category_id} onValueChange={v => setNewExpense(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => addMutation.mutate()} disabled={!newExpense.merchant || !newExpense.amount} className="w-full">
                Add Expense
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-card-foreground truncate">{expense.merchant}</p>
                    {expense.is_duplicate && (
                      <span title="Possible duplicate"><AlertTriangle className="w-4 h-4 text-warning shrink-0" /></span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(expense as any).categories?.name || 'Uncategorized'} • {format(new Date(expense.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-heading font-semibold text-card-foreground">
                    {expense.currency === 'EUR' ? '€' : expense.currency}{Number(expense.amount).toFixed(2)}
                  </span>
                  <Dialog open={editingExpense?.id === expense.id} onOpenChange={(open) => !open && setEditingExpense(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setEditingExpense({ ...expense })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-heading">Edit Expense</DialogTitle>
                      </DialogHeader>
                      {editingExpense && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Merchant</Label>
                            <Input value={editingExpense.merchant} onChange={e => setEditingExpense((p: any) => ({ ...p, merchant: e.target.value }))} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Amount</Label>
                              <Input type="number" step="0.01" value={editingExpense.amount} onChange={e => setEditingExpense((p: any) => ({ ...p, amount: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input type="date" value={editingExpense.date} onChange={e => setEditingExpense((p: any) => ({ ...p, date: e.target.value }))} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={editingExpense.category_id || ''} onValueChange={v => setEditingExpense((p: any) => ({ ...p, category_id: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                              <SelectContent>
                                {categories.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={() => updateMutation.mutate(editingExpense)} className="w-full">Save Changes</Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(expense.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No expenses yet. Upload a receipt or add one manually.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
