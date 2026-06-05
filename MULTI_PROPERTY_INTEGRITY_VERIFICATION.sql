-- =====================================================
-- MULTI-PROPERTY INTEGRITY VERIFICATION
-- Run in Supabase Studio SQL Editor after applying:
-- supabase/migrations/20260604120000_reinforce_multi_property_integrity.sql
-- =====================================================

-- ==========================================
-- TEST 1: Helper Function Exists
-- ==========================================
select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'property_belongs_to_org';

-- Expected: 1 row


-- ==========================================
-- TEST 2: Every Organization Has >= 1 Property
-- ==========================================
select
  o.id as organization_id,
  o.name as organization_name
from public.organizations o
where not exists (
  select 1
  from public.properties p
  where p.organization_id = o.id
)
order by o.name;

-- Expected: 0 rows


-- ==========================================
-- TEST 3: No NULL property_id Values Remain
-- ==========================================
select *
from (
  select 'room_units' as table_name, count(*) as invalid_count
  from public.room_units
  where property_id is null

  union all

  select 'bookings' as table_name, count(*) as invalid_count
  from public.bookings
  where property_id is null

  union all

  select 'booking_templates' as table_name, count(*) as invalid_count
  from public.booking_templates
  where property_id is null

  union all

  select 'filter_presets' as table_name, count(*) as invalid_count
  from public.filter_presets
  where property_id is null

  union all

  select 'calendar_sync_events' as table_name, count(*) as invalid_count
  from public.calendar_sync_events
  where property_id is null

  union all

  select 'booking_note_history' as table_name, count(*) as invalid_count
  from public.booking_note_history
  where property_id is null
) checks
order by table_name;

-- Expected: every invalid_count = 0


-- ==========================================
-- TEST 4: No Cross-Org / Invalid Property Links Remain
-- ==========================================
select *
from (
  select 'room_units' as table_name, count(*) as invalid_count
  from public.room_units ru
  where not exists (
    select 1
    from public.properties p
    where p.id = ru.property_id
      and p.organization_id = ru.organization_id
  )

  union all

  select 'bookings' as table_name, count(*) as invalid_count
  from public.bookings b
  where not exists (
    select 1
    from public.properties p
    where p.id = b.property_id
      and p.organization_id = b.organization_id
  )

  union all

  select 'booking_templates' as table_name, count(*) as invalid_count
  from public.booking_templates bt
  where not exists (
    select 1
    from public.properties p
    where p.id = bt.property_id
      and p.organization_id = bt.organization_id
  )

  union all

  select 'filter_presets' as table_name, count(*) as invalid_count
  from public.filter_presets fp
  where not exists (
    select 1
    from public.properties p
    where p.id = fp.property_id
      and p.organization_id = fp.organization_id
  )

  union all

  select 'calendar_sync_events' as table_name, count(*) as invalid_count
  from public.calendar_sync_events cse
  where not exists (
    select 1
    from public.properties p
    where p.id = cse.property_id
      and p.organization_id = cse.organization_id
  )

  union all

  select 'booking_note_history' as table_name, count(*) as invalid_count
  from public.booking_note_history bnh
  join public.bookings b on b.id = bnh.booking_id
  where not exists (
    select 1
    from public.properties p
    where p.id = bnh.property_id
      and p.organization_id = b.organization_id
  )
) checks
order by table_name;

-- Expected: every invalid_count = 0


-- ==========================================
-- TEST 5: NOT NULL Enforcement Is Back
-- ==========================================
select
  table_name,
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and column_name = 'property_id'
  and table_name in (
    'room_units',
    'bookings',
    'booking_templates',
    'filter_presets',
    'calendar_sync_events',
    'booking_note_history'
  )
order by table_name;

-- Expected: is_nullable = 'NO' for all rows


-- ==========================================
-- TEST 6: Foreign Keys and Check Constraints Exist
-- ==========================================
select
  conrelid::regclass as table_name,
  conname as constraint_name,
  contype as constraint_type
from pg_constraint
where conname in (
  'room_units_property_id_fkey',
  'bookings_property_id_fkey',
  'booking_templates_property_id_fkey',
  'filter_presets_property_id_fkey',
  'calendar_sync_events_property_id_fkey',
  'booking_note_history_property_id_fkey',
  'room_units_property_org_match',
  'bookings_property_org_match',
  'booking_templates_property_org_match',
  'filter_presets_property_org_match',
  'calendar_sync_events_property_org_match'
)
order by table_name, constraint_name;

-- Expected:
-- - foreign keys show contype = 'f'
-- - org-match constraints show contype = 'c'


-- ==========================================
-- TEST 7: Supporting Indexes Exist
-- ==========================================
select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_properties_org',
    'idx_room_units_org_property',
    'idx_bookings_org_property',
    'idx_booking_templates_org_property',
    'idx_filter_presets_org_property',
    'idx_booking_note_history_property',
    'idx_calendar_sync_events_org_property'
  )
order by tablename, indexname;

-- Expected: 7 rows


-- ==========================================
-- TEST 8: Sample Offending Rows (Only Useful If Counts > 0)
-- ==========================================
select 'room_units' as table_name, ru.id::text as record_id, ru.organization_id::text as organization_id, ru.property_id::text as property_id
from public.room_units ru
where ru.property_id is null
   or not exists (
     select 1
     from public.properties p
     where p.id = ru.property_id
       and p.organization_id = ru.organization_id
   )
limit 20;

select 'bookings' as table_name, b.id::text as record_id, b.organization_id::text as organization_id, b.property_id::text as property_id
from public.bookings b
where b.property_id is null
   or not exists (
     select 1
     from public.properties p
     where p.id = b.property_id
       and p.organization_id = b.organization_id
   )
limit 20;

select 'booking_templates' as table_name, bt.id::text as record_id, bt.organization_id::text as organization_id, bt.property_id::text as property_id
from public.booking_templates bt
where bt.property_id is null
   or not exists (
     select 1
     from public.properties p
     where p.id = bt.property_id
       and p.organization_id = bt.organization_id
   )
limit 20;

select 'filter_presets' as table_name, fp.id::text as record_id, fp.organization_id::text as organization_id, fp.property_id::text as property_id
from public.filter_presets fp
where fp.property_id is null
   or not exists (
     select 1
     from public.properties p
     where p.id = fp.property_id
       and p.organization_id = fp.organization_id
   )
limit 20;

select 'calendar_sync_events' as table_name, cse.id::text as record_id, cse.organization_id::text as organization_id, cse.property_id::text as property_id
from public.calendar_sync_events cse
where cse.property_id is null
   or not exists (
     select 1
     from public.properties p
     where p.id = cse.property_id
       and p.organization_id = cse.organization_id
   )
limit 20;

select 'booking_note_history' as table_name, bnh.id::text as record_id, b.organization_id::text as organization_id, bnh.property_id::text as property_id
from public.booking_note_history bnh
join public.bookings b on b.id = bnh.booking_id
where bnh.property_id is null
   or not exists (
     select 1
     from public.properties p
     where p.id = bnh.property_id
       and p.organization_id = b.organization_id
   )
limit 20;


-- ==========================================
-- TEST 9: Property Distribution Summary
-- ==========================================
select
  p.organization_id,
  o.name as organization_name,
  count(*) as property_count,
  min(p.created_at) as first_property_created_at
from public.properties p
join public.organizations o on o.id = p.organization_id
group by p.organization_id, o.name
order by property_count desc, o.name;

-- Expected: every organization represented at least once


-- ==========================================
-- SUMMARY CHECKLIST
-- ==========================================
/*
PASS criteria:
- TEST 1 returns 1 function row
- TEST 2 returns 0 rows
- TEST 3 all invalid_count values are 0
- TEST 4 all invalid_count values are 0
- TEST 5 all is_nullable values are NO
- TEST 6 contains all expected foreign key and org-match constraints
- TEST 7 returns all expected indexes
- TEST 8 returns 0 rows for every query
- TEST 9 shows at least 1 property per organization
*/
