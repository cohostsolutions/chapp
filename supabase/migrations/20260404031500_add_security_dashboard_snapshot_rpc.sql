begin;

create or replace function public.get_security_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  snapshot jsonb;
begin
  if current_user_id is null or not public.has_role(current_user_id, 'super_admin'::public.app_role) then
    raise exception 'Access denied';
  end if;

  with recent_audit_logs as (
    select id, created_at, action, resource_type, resource_id, ip_address, details
    from public.audit_logs
    order by created_at desc
    limit 100
  ),
  recent_login_attempts as (
    select id, attempted_at, was_successful, email, ip_address, country, country_code, city, region, latitude, longitude, isp
    from public.login_attempts
    order by attempted_at desc
    limit 100
  ),
  secret_rotations as (
    select id, secret_name, last_rotated_at, rotation_interval_days
    from public.secret_rotation_tracking
    order by secret_name
  ),
  metrics as (
    select jsonb_build_object(
      'totalAuditLogs', (select count(*) from public.audit_logs),
      'failedLogins24h', (select count(*) from public.login_attempts where not was_successful and attempted_at >= now() - interval '24 hours'),
      'successfulLogins24h', (select count(*) from public.login_attempts where was_successful and attempted_at >= now() - interval '24 hours'),
      'overdueSecrets', (
        select count(*)
        from public.secret_rotation_tracking s
        where s.last_rotated_at is null
           or s.last_rotated_at < now() - make_interval(days => s.rotation_interval_days)
      ),
      'recentUserActions', (select count(*) from public.audit_logs where created_at >= now() - interval '24 hours')
    ) as value
  )
  select jsonb_build_object(
    'metrics', (select value from metrics),
    'auditLogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'created_at', created_at,
        'action', action,
        'resource_type', resource_type,
        'resource_id', resource_id,
        'ip_address', ip_address,
        'details', details
      ) order by created_at desc)
      from recent_audit_logs
    ), '[]'::jsonb),
    'loginAttempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'attempted_at', attempted_at,
        'was_successful', was_successful,
        'email', email,
        'ip_address', ip_address,
        'country', country,
        'country_code', country_code,
        'city', city,
        'region', region,
        'latitude', latitude,
        'longitude', longitude,
        'isp', isp
      ) order by attempted_at desc)
      from recent_login_attempts
    ), '[]'::jsonb),
    'secretRotations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'secret_name', secret_name,
        'last_rotated_at', last_rotated_at,
        'rotation_interval_days', rotation_interval_days
      ) order by secret_name)
      from secret_rotations
    ), '[]'::jsonb)
  ) into snapshot;

  return snapshot;
end;
$$;

grant execute on function public.get_security_dashboard_snapshot() to authenticated;

commit;