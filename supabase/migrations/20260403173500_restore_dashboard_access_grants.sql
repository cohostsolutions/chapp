begin;

grant select, insert, update, delete on public.dashboard_layouts to authenticated;
grant select on public.login_attempts to authenticated;
grant select on public.helpdesk_tickets to authenticated;
grant select on public.team_chats to authenticated;
grant select on public.team_chat_members to authenticated;
grant select on public.training_sessions to authenticated;
grant select on public.ai_conversations to authenticated;
grant select on public.calendar_sync_events to authenticated;
grant select, update on public.health_check_thresholds to authenticated;
grant select on public.analytics_events to authenticated;
grant select on public.demo_requests to authenticated;

commit;