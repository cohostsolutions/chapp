DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_prep_configs'
      AND column_name = 'prep_duration_minutes'
  ) THEN
    ALTER TABLE public.order_prep_configs RENAME COLUMN prep_duration_minutes TO prep_duration_days;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_prep_configs'
      AND column_name = 'reminder_offset_minutes'
  ) THEN
    ALTER TABLE public.order_prep_configs RENAME COLUMN reminder_offset_minutes TO reminder_offset_days;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_prep_configs'
      AND column_name = 'buffer_minutes'
  ) THEN
    ALTER TABLE public.order_prep_configs RENAME COLUMN buffer_minutes TO buffer_days;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_prep_tasks'
      AND column_name = 'prep_duration_minutes'
  ) THEN
    ALTER TABLE public.order_prep_tasks RENAME COLUMN prep_duration_minutes TO prep_duration_days;
  END IF;
END $$;

ALTER TABLE public.order_prep_configs
  ALTER COLUMN prep_duration_days SET DEFAULT 1,
  ALTER COLUMN reminder_offset_days SET DEFAULT 0,
  ALTER COLUMN buffer_days SET DEFAULT 0;

ALTER TABLE public.order_prep_tasks
  ALTER COLUMN prep_duration_days SET DEFAULT 1;

UPDATE public.order_prep_configs
SET
  prep_duration_days = GREATEST(1, CEIL(prep_duration_days::numeric / 1440.0))::integer,
  reminder_offset_days = CASE
    WHEN reminder_offset_days <= 0 THEN 0
    ELSE GREATEST(1, CEIL(reminder_offset_days::numeric / 1440.0))::integer
  END,
  buffer_days = CASE
    WHEN buffer_days <= 0 THEN 0
    ELSE GREATEST(1, CEIL(buffer_days::numeric / 1440.0))::integer
  END;

UPDATE public.order_prep_tasks
SET prep_duration_days = GREATEST(1, CEIL(prep_duration_days::numeric / 1440.0))::integer;

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
  v_prep_duration_days INTEGER;
  v_reminder_offset_days INTEGER;
  v_buffer_days INTEGER;
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
           COALESCE(cfg.prep_duration_days, 1),
           COALESCE(cfg.reminder_offset_days, 0),
           COALESCE(cfg.buffer_days, 0)
    INTO v_menu_item_id, v_prep_duration_days, v_reminder_offset_days, v_buffer_days
    FROM public.knowledge_base_entries kb
    LEFT JOIN public.order_prep_configs cfg
      ON cfg.organization_id = v_order.organization_id
     AND cfg.menu_item_id = kb.id
    WHERE kb.organization_id = v_order.organization_id
      AND kb.category = 'menu'
      AND lower(kb.title) = v_task_key
    ORDER BY cfg.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_prep_duration_days IS NULL THEN
      v_prep_duration_days := 1;
      v_reminder_offset_days := 0;
      v_buffer_days := 0;
    END IF;

    v_scheduled_ready_time := v_order.pickup_time;
    v_scheduled_start_time := v_order.pickup_time - make_interval(days => v_prep_duration_days + v_buffer_days);
    v_reminder_time := v_scheduled_start_time - make_interval(days => v_reminder_offset_days);
    v_task_keys := array_append(v_task_keys, v_task_key);

    INSERT INTO public.order_prep_tasks (
      organization_id,
      order_id,
      task_key,
      menu_item_id,
      prep_item_name,
      quantity,
      prep_duration_days,
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
      v_prep_duration_days,
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
      prep_duration_days = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.prep_duration_days ELSE EXCLUDED.prep_duration_days END,
      scheduled_start_time = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.scheduled_start_time ELSE EXCLUDED.scheduled_start_time END,
      scheduled_ready_time = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.scheduled_ready_time ELSE EXCLUDED.scheduled_ready_time END,
      reminder_time = CASE WHEN order_prep_tasks.manual_override THEN order_prep_tasks.reminder_time ELSE EXCLUDED.reminder_time END,
      status = CASE
        WHEN order_prep_tasks.manual_override THEN order_prep_tasks.status
        WHEN EXCLUDED.status = 'scheduled' AND now() >= EXCLUDED.scheduled_start_time THEN 'in_progress'
        ELSE EXCLUDED.status
      END,
      updated_at = now();

  END LOOP;

  DELETE FROM public.order_prep_tasks
  WHERE order_id = p_order_id
    AND manual_override = false
    AND NOT (task_key = ANY(v_task_keys));
END;
$$;