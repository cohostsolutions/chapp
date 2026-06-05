-- Create notification history table
CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Notification details
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'communication', -- communication, system, alert
  channel TEXT, -- sms, email, call, whatsapp
  related_id UUID, -- ID of related communication/lead
  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON public.notification_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_is_read ON public.notification_history(user_id, is_read);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Users can only view/manage their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notification_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notification_history
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notification_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON public.notification_history
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER TABLE public.notification_history REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_history;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;