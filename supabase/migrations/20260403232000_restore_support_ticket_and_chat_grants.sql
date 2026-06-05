begin;

grant select, insert, update on public.helpdesk_tickets to authenticated;
grant select, insert on public.team_chats to authenticated;
grant select, insert, update, delete on public.team_chat_members to authenticated;
grant select, insert, update, delete on public.team_chat_messages to authenticated;
grant select, insert, delete on public.team_chat_reactions to authenticated;

commit;