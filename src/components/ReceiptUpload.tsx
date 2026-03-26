import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileImage, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function ReceiptUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const processReceipt = useCallback(async (file: File) => {
    if (!user) return;
    setUploading(true);
    setProcessing(false);
    setResult(null);
    setError(null);

    try {
      // Upload to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create receipt record
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert({ user_id: user.id, image_path: filePath, status: 'processing' })
        .select()
        .single();

      if (receiptError) throw receiptError;

      setUploading(false);
      setProcessing(true);

      // Convert file to base64 for AI processing
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Call edge function for AI processing
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('process-receipt', {
        body: { image: base64, receiptId: receipt.id },
      });

      if (aiError) throw aiError;

      // Update receipt status
      await supabase
        .from('receipts')
        .update({ status: 'completed', raw_text: aiResult.rawText || '' })
        .eq('id', receipt.id);

      // Create expense from AI result
      if (aiResult.expense) {
        // Check for user category corrections
        let categoryId = aiResult.expense.category_id;
        if (aiResult.expense.merchant) {
          const { data: correction } = await supabase
            .from('category_corrections')
            .select('corrected_category_id')
            .eq('user_id', user.id)
            .eq('merchant', aiResult.expense.merchant)
            .maybeSingle();
          if (correction) {
            categoryId = correction.corrected_category_id;
          }
        }

        // Check for duplicates
        const { data: duplicates } = await supabase
          .from('expenses')
          .select('id')
          .eq('user_id', user.id)
          .eq('merchant', aiResult.expense.merchant)
          .eq('amount', aiResult.expense.amount)
          .eq('date', aiResult.expense.date);

        const isDuplicate = (duplicates?.length || 0) > 0;

        await supabase.from('expenses').insert({
          user_id: user.id,
          receipt_id: receipt.id,
          merchant: aiResult.expense.merchant,
          amount: aiResult.expense.amount,
          currency: aiResult.expense.currency || 'EUR',
          category_id: categoryId,
          date: aiResult.expense.date,
          is_duplicate: isDuplicate,
        });

        setResult({ ...aiResult.expense, isDuplicate });
      }

      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setProcessing(false);
      toast({ title: 'Receipt processed!', description: 'Expense has been extracted and saved.' });
    } catch (err: any) {
      setUploading(false);
      setProcessing(false);
      setError(err.message || 'Failed to process receipt');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [user, queryClient, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      processReceipt(file);
    }
  }, [processReceipt]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processReceipt(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Upload Receipt</CardTitle>
          <CardDescription>Upload a receipt image and AI will extract expense data automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
                <p className="text-muted-foreground">Uploading receipt...</p>
              </div>
            ) : processing ? (
              <div className="space-y-3">
                <Loader2 className="w-12 h-12 text-accent mx-auto animate-spin" />
                <p className="text-muted-foreground">AI is extracting expense data...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">Drop your receipt here</p>
                  <p className="text-sm text-muted-foreground mt-1">JPG, PNG, or PDF</p>
                </div>
                <label>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="hidden" />
                  <Button variant="outline" asChild>
                    <span className="cursor-pointer">
                      <FileImage className="w-4 h-4 mr-2" />
                      Browse Files
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-success shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-heading font-semibold text-card-foreground">Expense Extracted!</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Merchant</span>
                  <span className="text-card-foreground font-medium">{result.merchant}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-card-foreground font-medium">€{Number(result.amount).toFixed(2)}</span>
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-card-foreground font-medium">{result.date}</span>
                  <span className="text-muted-foreground">Category</span>
                  <span className="text-card-foreground font-medium">{result.category || 'Auto-classified'}</span>
                </div>
                {result.isDuplicate && (
                  <div className="flex items-center gap-2 text-warning text-sm mt-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Possible duplicate detected</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-card-foreground">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
