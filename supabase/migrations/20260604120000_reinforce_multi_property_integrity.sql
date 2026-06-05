begin;

-- Restore the properties table if it was dropped by prior remote schema syncs.
create table if not exists public.properties (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  region text,
  country text,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.properties
  add column if not exists description text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists postal_code text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_properties_org_name_unique
on public.properties (organization_id, lower(name));

alter table public.properties enable row level security;

drop policy if exists "Users view org properties" on public.properties;
create policy "Users view org properties"
  on public.properties
  for select using (organization_id = public.get_user_org(auth.uid()));

drop policy if exists "Users create org properties" on public.properties;
create policy "Users create org properties"
  on public.properties
  for insert with check (organization_id = public.get_user_org(auth.uid()));

drop policy if exists "Users update org properties" on public.properties;
create policy "Users update org properties"
  on public.properties
  for update using (organization_id = public.get_user_org(auth.uid()))
  with check (organization_id = public.get_user_org(auth.uid()));

drop policy if exists "Users delete org properties" on public.properties;
create policy "Users delete org properties"
  on public.properties
  for delete using (organization_id = public.get_user_org(auth.uid()));

drop trigger if exists update_properties_updated_at on public.properties;
create trigger update_properties_updated_at
  before update on public.properties
  for each row execute function public.update_updated_at();

grant select, insert, update, delete on public.properties to authenticated;
grant all on public.properties to service_role;

-- Recreate helper dropped by 20260203150127_remote_schema.sql.
create or replace function public.property_belongs_to_org(p_property_id uuid, p_org_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    where p.id = p_property_id
      and p.organization_id = p_org_id
  );
$$;

-- Ensure each organization has at least one property so we always have a valid fallback.
insert into public.properties (organization_id, name)
select o.id, 'Default Property'
from public.organizations o
where not exists (
  select 1
  from public.properties p
  where p.organization_id = o.id
);

with org_fallback_property as (
  select
    o.id as organization_id,
    coalesce(
      (
        select p_default.id
        from public.properties p_default
        where p_default.organization_id = o.id
          and lower(p_default.name) = 'default property'
        order by p_default.created_at asc
        limit 1
      ),
      (
        select p_any.id
        from public.properties p_any
        where p_any.organization_id = o.id
        order by p_any.created_at asc
        limit 1
      )
    ) as property_id
  from public.organizations o
)
-- Normalize room_units.property_id.
update public.room_units ru
set property_id = fp.property_id
from org_fallback_property fp
where ru.organization_id = fp.organization_id
  and (
    ru.property_id is null
    or not exists (
      select 1
      from public.properties p
      where p.id = ru.property_id
        and p.organization_id = ru.organization_id
    )
  );

with org_fallback_property as (
  select
    o.id as organization_id,
    coalesce(
      (
        select p_default.id
        from public.properties p_default
        where p_default.organization_id = o.id
          and lower(p_default.name) = 'default property'
        order by p_default.created_at asc
        limit 1
      ),
      (
        select p_any.id
        from public.properties p_any
        where p_any.organization_id = o.id
        order by p_any.created_at asc
        limit 1
      )
    ) as property_id
  from public.organizations o
)
-- Normalize bookings.property_id.
update public.bookings b
set property_id = fp.property_id
from org_fallback_property fp
where b.organization_id = fp.organization_id
  and (
    b.property_id is null
    or not exists (
      select 1
      from public.properties p
      where p.id = b.property_id
        and p.organization_id = b.organization_id
    )
  );

with org_fallback_property as (
  select
    o.id as organization_id,
    coalesce(
      (
        select p_default.id
        from public.properties p_default
        where p_default.organization_id = o.id
          and lower(p_default.name) = 'default property'
        order by p_default.created_at asc
        limit 1
      ),
      (
        select p_any.id
        from public.properties p_any
        where p_any.organization_id = o.id
        order by p_any.created_at asc
        limit 1
      )
    ) as property_id
  from public.organizations o
)
-- Normalize booking_templates.property_id.
update public.booking_templates bt
set property_id = fp.property_id
from org_fallback_property fp
where bt.organization_id = fp.organization_id
  and (
    bt.property_id is null
    or not exists (
      select 1
      from public.properties p
      where p.id = bt.property_id
        and p.organization_id = bt.organization_id
    )
  );

with org_fallback_property as (
  select
    o.id as organization_id,
    coalesce(
      (
        select p_default.id
        from public.properties p_default
        where p_default.organization_id = o.id
          and lower(p_default.name) = 'default property'
        order by p_default.created_at asc
        limit 1
      ),
      (
        select p_any.id
        from public.properties p_any
        where p_any.organization_id = o.id
        order by p_any.created_at asc
        limit 1
      )
    ) as property_id
  from public.organizations o
)
-- Normalize filter_presets.property_id.
update public.filter_presets fpreset
set property_id = fp.property_id
from org_fallback_property fp
where fpreset.organization_id = fp.organization_id
  and (
    fpreset.property_id is null
    or not exists (
      select 1
      from public.properties p
      where p.id = fpreset.property_id
        and p.organization_id = fpreset.organization_id
    )
  );

with org_fallback_property as (
  select
    o.id as organization_id,
    coalesce(
      (
        select p_default.id
        from public.properties p_default
        where p_default.organization_id = o.id
          and lower(p_default.name) = 'default property'
        order by p_default.created_at asc
        limit 1
      ),
      (
        select p_any.id
        from public.properties p_any
        where p_any.organization_id = o.id
        order by p_any.created_at asc
        limit 1
      )
    ) as property_id
  from public.organizations o
)
-- Normalize calendar_sync_events.property_id.
update public.calendar_sync_events cse
set property_id = fp.property_id
from org_fallback_property fp
where cse.organization_id = fp.organization_id
  and (
    cse.property_id is null
    or not exists (
      select 1
      from public.properties p
      where p.id = cse.property_id
        and p.organization_id = cse.organization_id
    )
  );

with org_fallback_property as (
  select
    o.id as organization_id,
    coalesce(
      (
        select p_default.id
        from public.properties p_default
        where p_default.organization_id = o.id
          and lower(p_default.name) = 'default property'
        order by p_default.created_at asc
        limit 1
      ),
      (
        select p_any.id
        from public.properties p_any
        where p_any.organization_id = o.id
        order by p_any.created_at asc
        limit 1
      )
    ) as property_id
  from public.organizations o
)
-- Normalize booking_note_history.property_id from its booking/org context.
update public.booking_note_history bnh
set property_id = coalesce(b.property_id, fp.property_id)
from public.bookings b
left join org_fallback_property fp
  on fp.organization_id = b.organization_id
where bnh.booking_id = b.id
  and (
    bnh.property_id is null
    or not exists (
      select 1
      from public.properties p
      where p.id = bnh.property_id
        and p.organization_id = b.organization_id
    )
  );

-- Enforce NOT NULL once data is normalized.
alter table public.room_units alter column property_id set not null;
alter table public.bookings alter column property_id set not null;
alter table public.booking_templates alter column property_id set not null;
alter table public.filter_presets alter column property_id set not null;
alter table public.calendar_sync_events alter column property_id set not null;
alter table public.booking_note_history alter column property_id set not null;

-- Re-apply referential and org-alignment constraints idempotently.
alter table public.room_units drop constraint if exists room_units_property_id_fkey;
alter table public.bookings drop constraint if exists bookings_property_id_fkey;
alter table public.booking_templates drop constraint if exists booking_templates_property_id_fkey;
alter table public.filter_presets drop constraint if exists filter_presets_property_id_fkey;
alter table public.calendar_sync_events drop constraint if exists calendar_sync_events_property_id_fkey;
alter table public.booking_note_history drop constraint if exists booking_note_history_property_id_fkey;

alter table public.room_units
  add constraint room_units_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete cascade;

alter table public.bookings
  add constraint bookings_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete cascade;

alter table public.booking_templates
  add constraint booking_templates_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete cascade;

alter table public.filter_presets
  add constraint filter_presets_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete cascade;

alter table public.calendar_sync_events
  add constraint calendar_sync_events_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete cascade;

alter table public.booking_note_history
  add constraint booking_note_history_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete cascade;

alter table public.room_units drop constraint if exists room_units_property_org_match;
alter table public.bookings drop constraint if exists bookings_property_org_match;
alter table public.booking_templates drop constraint if exists booking_templates_property_org_match;
alter table public.filter_presets drop constraint if exists filter_presets_property_org_match;
alter table public.calendar_sync_events drop constraint if exists calendar_sync_events_property_org_match;

alter table public.room_units
  add constraint room_units_property_org_match
  check (public.property_belongs_to_org(property_id, organization_id));

alter table public.bookings
  add constraint bookings_property_org_match
  check (public.property_belongs_to_org(property_id, organization_id));

alter table public.booking_templates
  add constraint booking_templates_property_org_match
  check (public.property_belongs_to_org(property_id, organization_id));

alter table public.filter_presets
  add constraint filter_presets_property_org_match
  check (public.property_belongs_to_org(property_id, organization_id));

alter table public.calendar_sync_events
  add constraint calendar_sync_events_property_org_match
  check (public.property_belongs_to_org(property_id, organization_id));

-- Helpful indexes (safe/idempotent).
create index if not exists idx_properties_org on public.properties(organization_id);
create index if not exists idx_room_units_org_property on public.room_units(organization_id, property_id);
create index if not exists idx_bookings_org_property on public.bookings(organization_id, property_id);
create index if not exists idx_booking_templates_org_property on public.booking_templates(organization_id, property_id);
create index if not exists idx_filter_presets_org_property on public.filter_presets(organization_id, property_id);
create index if not exists idx_booking_note_history_property on public.booking_note_history(property_id);
create index if not exists idx_calendar_sync_events_org_property on public.calendar_sync_events(organization_id, property_id);

commit;
