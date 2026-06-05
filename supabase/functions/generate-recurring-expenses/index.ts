import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : null;
    const details = 'details' in error && typeof error.details === 'string' ? error.details : null;
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null;

    return [message, details, hint].filter(Boolean).join(' | ') || JSON.stringify(error);
  }

  return String(error);
}

/**
 * Edge function to auto-generate recurring expense instances.
 * Should be called via cron job (e.g., daily at midnight).
 */
serve(async (req) => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  const preflightResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (preflightResponse) return preflightResponse;

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayOfMonth = today.getDate();

    console.log(`[Recurring Expenses] Running for ${todayStr}, dayOfWeek=${dayOfWeek}, dayOfMonth=${dayOfMonth}`);

    // Fetch all recurring expenses
    const { data: recurringExpenses, error: fetchError } = await supabase
      .from('operational_expenses')
      .select('*')
      .eq('is_recurring', true)
      .is('parent_expense_id', null); // Only get parent/template expenses

    if (fetchError) {
      console.error('[Recurring Expenses] Fetch error:', fetchError);
      throw new Error(`Failed to fetch recurring expenses: ${describeError(fetchError)}`);
    }

    console.log(`[Recurring Expenses] Found ${recurringExpenses?.length || 0} recurring expense templates`);

    let created = 0;
    let skipped = 0;

    for (const expense of recurringExpenses || []) {
      let shouldGenerate = false;

      // Check if today matches the recurrence pattern
      if (expense.recurrence_pattern === 'weekly' && expense.recurrence_day_of_week === dayOfWeek) {
        shouldGenerate = true;
      } else if (expense.recurrence_pattern === 'monthly' && expense.recurrence_day_of_month === dayOfMonth) {
        shouldGenerate = true;
      } else if (expense.recurrence_pattern === 'yearly') {
        // For yearly, check if today matches the original expense_date month and day
        const originalDate = new Date(expense.expense_date);
        if (originalDate.getMonth() === today.getMonth() && originalDate.getDate() === today.getDate()) {
          shouldGenerate = true;
        }
      }

      if (!shouldGenerate) {
        continue;
      }

      // Check if we already generated an instance for today
      const { data: existing } = await supabase
        .from('operational_expenses')
        .select('id')
        .eq('parent_expense_id', expense.id)
        .eq('expense_date', todayStr)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Recurring Expenses] Skipping ${expense.id} - already generated for ${todayStr}`);
        skipped++;
        continue;
      }

      // Calculate due date if the original had one
      let newDueDate = null;
      if (expense.due_date) {
        const originalExpenseDate = new Date(expense.expense_date);
        const originalDueDate = new Date(expense.due_date);
        const daysDiff = Math.round((originalDueDate.getTime() - originalExpenseDate.getTime()) / (1000 * 60 * 60 * 24));
        const newDue = new Date(today);
        newDue.setDate(newDue.getDate() + daysDiff);
        newDueDate = newDue.toISOString().split('T')[0];
      }

      // Create new instance
      const { error: insertError } = await supabase
        .from('operational_expenses')
        .insert({
          organization_id: expense.organization_id,
          room_unit_id: expense.room_unit_id,
          category: expense.category,
          expense_type: expense.expense_type,
          amount: expense.amount,
          expense_date: todayStr,
          due_date: newDueDate,
          is_paid: false,
          notes: expense.notes,
          vendor: expense.vendor,
          is_recurring: false, // Child instances are not recurring themselves
          parent_expense_id: expense.id,
          created_by: expense.created_by,
        });

      if (insertError) {
        console.error(`[Recurring Expenses] Failed to create instance for ${expense.id}:`, insertError);
      } else {
        console.log(`[Recurring Expenses] Created instance for ${expense.id}`);
        created++;
      }
    }

    console.log(`[Recurring Expenses] Complete: created=${created}, skipped=${skipped}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: todayStr,
        created, 
        skipped,
        message: `Generated ${created} recurring expense instance(s)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = describeError(error);
    console.error('[Recurring Expenses] Error:', errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
