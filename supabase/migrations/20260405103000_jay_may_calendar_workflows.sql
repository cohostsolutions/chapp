ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS appointment_status TEXT,
  ADD COLUMN IF NOT EXISTS appointment_source TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_appointment_status_check'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_appointment_status_check
      CHECK (
        appointment_status IS NULL
        OR appointment_status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_appointment_source_check'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_appointment_source_check
      CHECK (appointment_source IN ('manual', 'jay_ai', 'external_sync'));
  END IF;
END $$;

UPDATE public.calendar_events
SET appointment_status = 'confirmed'
WHERE appointment_status IS NULL
  AND event_type = 'appointment'
  AND related_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_appointment_status
  ON public.calendar_events(organization_id, appointment_status, start_time);

CREATE TABLE IF NOT EXISTS public.order_prep_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.knowledge_base_entries(id) ON DELETE CASCADE,
  prep_duration_minutes INTEGER NOT NULL DEFAULT 30,
  reminder_offset_minutes INTEGER NOT NULL DEFAULT 15,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS public.order_prep_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  menu_item_id UUID REFERENCES public.knowledge_base_entries(id) ON DELETE SET NULL,
  prep_item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  prep_duration_minutes INTEGER NOT NULL DEFAULT 30,
  scheduled_start_time TIMESTAMP WITH TIME ZONE,
  scheduled_ready_time TIMESTAMP WITH TIME ZONE,
  reminder_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  manual_override BOOLEAN NOT NULL DEFAULT false,
  override_notes TEXT,
  overridden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (order_id, task_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_prep_tasks_status_check'
  ) THEN
    ALTER TABLE public.order_prep_tasks
      ADD CONSTRAINT order_prep_tasks_status_check
      CHECK (status IN ('scheduled', 'in_progress', 'ready', 'completed', 'cancelled'));
  END IF;
END $$;

ALTER TABLE public.order_prep_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_prep_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view org prep configs" ON public.order_prep_configs;
CREATE POLICY "Users view org prep configs"
ON public.order_prep_configs
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users manage org prep configs" ON public.order_prep_configs;
CREATE POLICY "Users manage org prep configs"
ON public.order_prep_configs
FOR ALL
USING (organization_id = get_user_org(auth.uid()))
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users view org prep tasks" ON public.order_prep_tasks;
CREATE POLICY "Users view org prep tasks"
ON public.order_prep_tasks
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users manage org prep tasks" ON public.order_prep_tasks;
CREATE POLICY "Users manage org prep tasks"
ON public.order_prep_tasks
FOR ALL
USING (organization_id = get_user_org(auth.uid()))
WITH CHECK (organization_id = get_user_org(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_order_prep_configs_org_item
  ON public.order_prep_configs(organization_id, menu_item_id);

CREATE INDEX IF NOT EXISTS idx_order_prep_tasks_order
  ON public.order_prep_tasks(order_id);

CREATE INDEX IF NOT EXISTS idx_order_prep_tasks_schedule
  ON public.order_prep_tasks(organization_id, scheduled_start_time, scheduled_ready_time);

DROP TRIGGER IF EXISTS update_order_prep_configs_updated_at ON public.order_prep_configs;
CREATE TRIGGER update_order_prep_configs_updated_at
  BEFORE UPDATE ON public.order_prep_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_prep_tasks_updated_at ON public.order_prep_tasks;
CREATE TRIGGER update_order_prep_tasks_updated_at
  BEFORE UPDATE ON public.order_prep_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_order_prep_tasks(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item JSONB;
  v_item_name TEXT;
  v_task_key TEXT;
  v_quantity INTEGER;
  v_menu_item_id UUID;
  v_prep_duration_minutes INTEGER;
  v_reminder_offset_minutes INTEGER;
  v_buffer_minutes INTEGER;
  v_scheduled_start_time TIMESTAMP WITH TIME ZONE;
  v_scheduled_ready_time TIMESTAMP WITH TIME ZONE;
  v_reminder_time TIMESTAMP WITH TIME ZONE;
  v_status TEXT;
  v_task_keys TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_order.status = 'picked_up' THEN
    v_status := 'completed';
  ELSIF v_order.status = 'cancelled' THEN
    v_status := 'cancelled';
  ELSIF v_order.status = 'ready' THEN
    v_status := 'ready';
  ELSIF v_order.status = 'preparing' THEN
    v_status := 'in_progress';
  ELSE
    v_status := 'scheduled';
  END IF;

  IF v_order.pickup_time IS NULL THEN
    DELETE FROM public.order_prep_tasks
    WHERE order_id = p_order_id
      AND manual_override = false;
    RETURN;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(v_order.order_items, '[]'::jsonb))
  LOOP
    v_item_name := trim(COALESCE(v_item ->> 'name', ''));

    IF v_item_name = '' THEN
      CONTINUE;
    END IF;

    v_quantity := GREATEST(COALESCE(NULLIF(v_item ->> 'quantity', '')::INTEGER, 1), 1);
    v_task_key := lower(regexp_replace(v_item_name, '\s+', ' ', 'g'));

    SELECT kb.id,
           COALESCE(cfg.prep_duration_minutes, 30),
           COALESCE(cfg.reminder_offset_minutes, 15),
           COALESCE(cfg.buffer_minutes, 0)
    INTO v_menu_item_id, v_prep_duration_minutes, v_reminder_offset_minutes, v_buffer_minutes
    FROM public.knowledge_base_entries kb
    LEFT JOIN public.order_prep_configs cfg
      ON cfg.organization_id = v_order.organization_id
     AND cfg.menu_item_id = kb.id
    WHERE kb.organization_id = v_order.organization_id
      AND kb.category = 'menu'
      AND lower(kb.title) = v_task_key
    ORDER BY cfg.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_prep_duration_minutes IS NULL THEN
      v_prep_duration_minutes := 30;
      v_reminder_offset_minutes := 15;
      v_buffer_minutes := 0;
    END IF;

    v_scheduled_ready_time := v_order.pickup_time;
    v_scheduled_start_time := v_order.pickup_time - make_interval(mins => v_prep_duration_minutes + v_buffer_minutes);
    v_reminder_time := v_scheduled_start_time - make_interval(mins => v_reminder_offset_minutes);
    v_task_keys := array_append(v_task_keys, v_task_key);

    INSERT INTO public.order_prep_tasks (
      organization_id,
      order_id,
      task_key,
      menu_item_id,
      prep_item_name,
      quantity,
      prep_duration_minutes,
      scheduled_start_time,
      scheduled_ready_time,
      reminder_time,
      status
    )
    VALUES (
      v_order.organization_id,
      v_order.id,
      v_task_key,
      v_menu_item_id,
      v_item_name,
      v_quantity,
      v_prep_duration_minutes,
      v_scheduled_start_time,
      v_scheduled_ready_time,
      v_reminder_time,
      CASE
        WHEN v_status = 'scheduled' AND now() >= v_scheduled_start_time THEN 'in_progress'
        ELSE v_status
      END
    )
    ON CONFLICT (order_id, task_key)
    DO UPDATE SET
      menu_item_id = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.menu_item_id ELSE EXCLUDED.menu_item_id END,
      prep_item_name = EXCLUDED.prep_item_name,
      quantity = EXCLUDED.quantity,
      prep_duration_minutes = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.prep_duration_minutes ELSE EXCLUDED.prep_duration_minutes END,
      scheduled_start_time = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.scheduled_start_time ELSE EXCLUDED.scheduled_start_time END,
      scheduled_ready_time = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.scheduled_ready_time ELSE EXCLUDED.scheduled_ready_time END,
      reminder_time = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.reminder_time ELSE EXCLUDED.reminder_time END,
      status = CASE
        WHEN EXCLUDED.status IN ('cancelled', 'completed') THEN EXCLUDED.status
        WHEN order_prep_tasks.manual_override THEN order_prep_tasks.status
        ELSE EXCLUDED.status
      END;
  END LOOP;

  DELETE FROM public.order_prep_tasks
  WHERE order_id = p_order_id
    AND manual_override = false
    AND NOT (task_key = ANY(v_task_keys));
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_order_prep_task_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_order_prep_tasks(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_order_prep_tasks_after_write ON public.orders;
CREATE TRIGGER sync_order_prep_tasks_after_write
  AFTER INSERT OR UPDATE OF order_items, pickup_time, status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_prep_task_sync();

DO $$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id
    FROM public.orders
    WHERE pickup_time IS NOT NULL
  LOOP
    PERFORM public.sync_order_prep_tasks(v_order.id);
  END LOOP;
END $$;