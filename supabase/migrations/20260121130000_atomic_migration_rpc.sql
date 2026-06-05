-- Create atomic asset migration function with transaction support
-- This ensures all assets are migrated together (all-or-nothing)

CREATE OR REPLACE FUNCTION migrate_assets_atomic(
  p_source_org_id uuid,
  p_target_org_id uuid,
  p_assets jsonb,
  p_performed_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}';
  v_migration_id uuid;
  v_table_name text;
  v_ids text[];
  v_count int;
  v_category text;
BEGIN
  -- Validate inputs
  IF p_source_org_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organizations must be different';
  END IF;

  -- Verify organizations exist
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_source_org_id) THEN
    RAISE EXCEPTION 'Source organization not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_target_org_id) THEN
    RAISE EXCEPTION 'Target organization not found';
  END IF;

  -- Create migration log entry
  INSERT INTO migration_logs (
    performed_by,
    source_organization_id,
    target_organization_id,
    can_undo_until
  ) VALUES (
    p_performed_by,
    p_source_org_id,
    p_target_org_id,
    now() + interval '60 seconds'
  ) RETURNING id INTO v_migration_id;

  -- Iterate through asset types
  FOR v_category, v_ids IN 
    SELECT key, ARRAY_AGG(value::text) 
    FROM jsonb_each(p_assets)
    GROUP BY key
  LOOP
    -- Skip empty arrays
    IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
      CONTINUE;
    END IF;

    -- Map category to table name
    v_table_name := CASE v_category
      WHEN 'leads' THEN 'leads'
      WHEN 'platforms' THEN 'social_platforms'
      WHEN 'bookings' THEN 'bookings'
      WHEN 'orders' THEN 'orders'
      WHEN 'offerings' THEN 'offerings'
      WHEN 'room_units' THEN 'room_units'
      WHEN 'knowledge_entries' THEN 'knowledge_base_entries'
      WHEN 'knowledge_docs' THEN 'knowledge_base_documents'
      WHEN 'reports' THEN 'reports'
      WHEN 'workflows' THEN 'workflows'
      WHEN 'calendar_events' THEN 'calendar_events'
      WHEN 'communications' THEN 'communications'
      WHEN 'message_templates' THEN 'message_templates'
      WHEN 'training_modules' THEN 'training_modules'
      WHEN 'team_chats' THEN 'team_chats'
      WHEN 'ai_conversations' THEN 'ai_conversations'
      WHEN 'agent_priorities' THEN 'agent_priorities'
      WHEN 'rubric_templates' THEN 'rubric_templates'
      ELSE NULL
    END;

    IF v_table_name IS NULL THEN
      RAISE EXCEPTION 'Invalid asset category: %', v_category;
    END IF;

    -- Convert string array to uuid array
    DECLARE
      v_uuid_ids uuid[];
    BEGIN
      v_uuid_ids := ARRAY(SELECT (elem)::uuid FROM UNNEST(v_ids) AS elem);
      
      -- Perform migration for this table
      EXECUTE format(
        'UPDATE %I SET organization_id = $1 WHERE id = ANY($2::uuid[])',
        v_table_name
      ) USING p_target_org_id, v_uuid_ids;

      GET DIAGNOSTICS v_count = ROW_COUNT;

      -- Update migration log with migrated IDs using dynamic SQL
      EXECUTE format(
        'UPDATE migration_logs SET %I = $1 WHERE id = $2',
        'migrated_' || v_category
      ) USING to_jsonb(v_uuid_ids), v_migration_id;

      -- Add to result
      v_result := jsonb_set(v_result, ARRAY[v_category], to_jsonb(v_count));
    END;
  END LOOP;

  -- Return migration ID and counts
  RETURN jsonb_build_object(
    'migration_id', v_migration_id,
    'counts', v_result
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically on error
    RAISE EXCEPTION 'Migration failed: %', SQLERRM;
END;
$$;
