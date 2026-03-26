import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, receiptId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Lovable AI to extract structured data from the receipt image
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a receipt data extraction assistant. Extract structured expense data from receipt images. Always respond using the extract_expense tool.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the expense data from this receipt image. Identify the merchant name, total amount, date, and most appropriate category from: Groceries, Transport, Dining, Entertainment, Utilities, Healthcare, Shopping, Travel, Education, Other.",
              },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_expense",
              description: "Extract structured expense data from a receipt",
              parameters: {
                type: "object",
                properties: {
                  merchant: { type: "string", description: "Name of the merchant/store" },
                  amount: { type: "number", description: "Total amount paid" },
                  currency: { type: "string", description: "Currency code (e.g. EUR, USD)", enum: ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK"] },
                  date: { type: "string", description: "Date of purchase in YYYY-MM-DD format" },
                  category: { type: "string", description: "Expense category", enum: ["Groceries", "Transport", "Dining", "Entertainment", "Utilities", "Healthcare", "Shopping", "Travel", "Education", "Other"] },
                  raw_text: { type: "string", description: "Raw text extracted from the receipt" },
                },
                required: ["merchant", "amount", "currency", "date", "category"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_expense" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI processing failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    // Look up category ID from the Supabase database
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("name", extractedData.category)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        expense: {
          merchant: extractedData.merchant,
          amount: extractedData.amount,
          currency: extractedData.currency || "EUR",
          date: extractedData.date,
          category: extractedData.category,
          category_id: category?.id || null,
        },
        rawText: extractedData.raw_text || "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Process receipt error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
