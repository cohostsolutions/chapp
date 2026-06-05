-- Track Google Calendar event created for the expense_date (separate from existing calendar_event_id used for due dates)
ALTER TABLE public.operational_expenses
ADD COLUMN IF NOT EXISTS expense_calendar_event_id TEXT;