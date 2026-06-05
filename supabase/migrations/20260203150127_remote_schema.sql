drop trigger if exists "audit_role_change" on "public"."profiles";

drop trigger if exists "update_properties_updated_at" on "public"."properties";

drop policy "Agents view authorized agent_priorities" on "public"."agent_priorities";

drop policy "Client admins manage org agent_priorities" on "public"."agent_priorities";

drop policy "Impersonating agent view agent_priorities" on "public"."agent_priorities";

drop policy "Impersonating client admin manage agent_priorities" on "public"."agent_priorities";

drop policy "Super admins manage org agent_priorities" on "public"."agent_priorities";

drop policy "Users can manage AI alert history in their org" on "public"."ai_alert_history";

drop policy "Users can view AI alert history in their org" on "public"."ai_alert_history";

drop policy "Users can manage AI alert rules in their org" on "public"."ai_alert_rules";

drop policy "Users can view AI alert rules in their org" on "public"."ai_alert_rules";

drop policy "Users can manage analytics snapshots in their org" on "public"."ai_analytics_snapshots";

drop policy "Users can view analytics snapshots in their org" on "public"."ai_analytics_snapshots";

drop policy "Agents view authorized ai_conversations" on "public"."ai_conversations";

drop policy "Client admins manage org ai_conversations" on "public"."ai_conversations";

drop policy "Impersonating agent view ai_conversations" on "public"."ai_conversations";

drop policy "Impersonating client admin manage ai_conversations" on "public"."ai_conversations";

drop policy "Super admins manage org ai_conversations" on "public"."ai_conversations";

drop policy "Users can manage performance metrics in their org" on "public"."ai_performance_metrics";

drop policy "Users can view performance metrics in their org" on "public"."ai_performance_metrics";

drop policy "Authenticated users insert analytics events" on "public"."analytics_events";

drop policy "Super admins can view analytics events" on "public"."analytics_events";

drop policy "Super admins manage analytics events" on "public"."analytics_events";

drop policy "Admins view org audit logs" on "public"."audit_logs";

drop policy "Only functions can insert audit logs" on "public"."audit_logs";

drop policy "Agents insert assigned lead bookings" on "public"."bookings";

drop policy "Agents manage authorized bookings" on "public"."bookings";

drop policy "Agents update assigned lead bookings" on "public"."bookings";

drop policy "Agents view assigned lead bookings" on "public"."bookings";

drop policy "Client admins manage org bookings" on "public"."bookings";

drop policy "Impersonating agent manage bookings" on "public"."bookings";

drop policy "Impersonating agent view bookings" on "public"."bookings";

drop policy "Impersonating client admin manage bookings" on "public"."bookings";

drop policy "Super admins manage org bookings" on "public"."bookings";

drop policy "Super admins view all bookings" on "public"."bookings";

drop policy "Agents manage authorized calendar events" on "public"."calendar_events";

drop policy "Client admins manage org calendar events" on "public"."calendar_events";

drop policy "Impersonating agent manage calendar events" on "public"."calendar_events";

drop policy "Impersonating client admin manage calendar events" on "public"."calendar_events";

drop policy "Super admins manage org calendar events" on "public"."calendar_events";

drop policy "Agents view org calendar_sync_events" on "public"."calendar_sync_events";

drop policy "Client admins manage org calendar_sync_events" on "public"."calendar_sync_events";

drop policy "Impersonating client admin manage calendar_sync_events" on "public"."calendar_sync_events";

drop policy "Super admins manage org calendar_sync_events" on "public"."calendar_sync_events";

drop policy "Users view org calendar_sync_events" on "public"."calendar_sync_events";

drop policy "Agents create communications" on "public"."communications";

drop policy "Agents update authorized communications" on "public"."communications";

drop policy "Agents view authorized communications" on "public"."communications";

drop policy "Client admins manage org communications" on "public"."communications";

drop policy "Impersonating agent manage communications" on "public"."communications";

drop policy "Impersonating agent update communications" on "public"."communications";

drop policy "Impersonating agent view communications" on "public"."communications";

drop policy "Impersonating client admin manage communications" on "public"."communications";

drop policy "Super admins manage org communications" on "public"."communications";

drop policy "Users can manage conversation metadata in their org" on "public"."conversation_metadata";

drop policy "Users can view conversation metadata in their org" on "public"."conversation_metadata";

drop policy "Users can delete their own dashboard layouts" on "public"."dashboard_layouts";

drop policy "Users can insert their own dashboard layouts" on "public"."dashboard_layouts";

drop policy "Users can update their own dashboard layouts" on "public"."dashboard_layouts";

drop policy "Users can view their own dashboard layouts" on "public"."dashboard_layouts";

drop policy "dashboard_layouts_delete" on "public"."dashboard_layouts";

drop policy "dashboard_layouts_insert" on "public"."dashboard_layouts";

drop policy "dashboard_layouts_select" on "public"."dashboard_layouts";

drop policy "dashboard_layouts_update" on "public"."dashboard_layouts";

drop policy "Users can manage handoff events in their org" on "public"."handoff_events";

drop policy "Users can view handoff events in their org" on "public"."handoff_events";

drop policy "Super admins can manage ip_blocklist" on "public"."ip_blocklist";

drop policy "Super admins manage ip_blocklist" on "public"."ip_blocklist";

drop policy "Client admins manage org knowledge_base_documents" on "public"."knowledge_base_documents";

drop policy "Impersonating agent view knowledge_base_documents" on "public"."knowledge_base_documents";

drop policy "Impersonating client admin manage knowledge_base_documents" on "public"."knowledge_base_documents";

drop policy "Org users view knowledge_base_documents" on "public"."knowledge_base_documents";

drop policy "Super admins manage org knowledge_base_documents" on "public"."knowledge_base_documents";

drop policy "Client admins manage org knowledge_base_entries" on "public"."knowledge_base_entries";

drop policy "Impersonating agent view knowledge_base_entries" on "public"."knowledge_base_entries";

drop policy "Impersonating client admin manage knowledge_base_entries" on "public"."knowledge_base_entries";

drop policy "Org users view knowledge_base_entries" on "public"."knowledge_base_entries";

drop policy "Super admins manage org knowledge_base_entries" on "public"."knowledge_base_entries";

drop policy "Users can manage KB performance in their org" on "public"."knowledge_base_performance";

drop policy "Users can view KB performance in their org" on "public"."knowledge_base_performance";

drop policy "Users can manage KB versions in their org" on "public"."knowledge_base_versions";

drop policy "Users can view KB versions in their org" on "public"."knowledge_base_versions";

drop policy "Users can manage qualification scores in their org" on "public"."lead_qualification_scores";

drop policy "Users can view qualification scores in their org" on "public"."lead_qualification_scores";

drop policy "Admins can delete leads in their organization" on "public"."leads";

drop policy "Agents insert org leads" on "public"."leads";

drop policy "Agents update assigned leads" on "public"."leads";

drop policy "Agents update authorized leads" on "public"."leads";

drop policy "Agents view authorized leads" on "public"."leads";

drop policy "Client admins manage org leads" on "public"."leads";

drop policy "Client admins update org leads" on "public"."leads";

drop policy "Impersonating agent update leads" on "public"."leads";

drop policy "Impersonating agent view leads" on "public"."leads";

drop policy "Impersonating client admin manage leads" on "public"."leads";

drop policy "Super admins manage org leads" on "public"."leads";

drop policy "Super admins view all leads" on "public"."leads";

drop policy "Users can create leads in their organization" on "public"."leads";

drop policy "Users can update leads in their organization" on "public"."leads";

drop policy "Users can view leads in their organization" on "public"."leads";

drop policy "Client admins manage org reactions" on "public"."message_reactions";

drop policy "Super admins manage org reactions" on "public"."message_reactions";

drop policy "Users add org reactions" on "public"."message_reactions";

drop policy "Users delete own reactions" on "public"."message_reactions";

drop policy "Users view org reactions" on "public"."message_reactions";

drop policy "Client admins manage org message_templates" on "public"."message_templates";

drop policy "Impersonating agent view message_templates" on "public"."message_templates";

drop policy "Impersonating client admin manage message_templates" on "public"."message_templates";

drop policy "Org users view message_templates" on "public"."message_templates";

drop policy "Super admins manage org message_templates" on "public"."message_templates";

drop policy "Users can delete own notifications" on "public"."notification_history";

drop policy "Users can insert own notifications" on "public"."notification_history";

drop policy "Users can receive notifications" on "public"."notification_history";

drop policy "Users can update own notifications" on "public"."notification_history";

drop policy "Users delete own notifications" on "public"."notification_history";

drop policy "Users update own notifications" on "public"."notification_history";

drop policy "Impersonating users manage offerings" on "public"."offerings";

drop policy "Org users manage offerings" on "public"."offerings";

drop policy "Super admins manage org offerings" on "public"."offerings";

drop policy "Admins manage orders" on "public"."orders";

drop policy "Agents insert assigned lead orders" on "public"."orders";

drop policy "Agents update assigned lead orders" on "public"."orders";

drop policy "Agents view assigned lead orders" on "public"."orders";

drop policy "Client admins manage org orders" on "public"."orders";

drop policy "Impersonating agent manage orders" on "public"."orders";

drop policy "Impersonating client admin manage orders" on "public"."orders";

drop policy "Super admins manage org orders" on "public"."orders";

drop policy "Super admins view all orders" on "public"."orders";

drop policy "Client admins update own org" on "public"."organizations";

drop policy "Super admins manage orgs" on "public"."organizations";

drop policy "Users view own org" on "public"."organizations";

drop policy "All authenticated can view permission sets" on "public"."permission_sets";

drop policy "Super admins can manage permission sets" on "public"."permission_sets";

drop policy "Client admins manage org phone numbers" on "public"."phone_numbers";

drop policy "Org users view org phone numbers" on "public"."phone_numbers";

drop policy "Super admins manage all phone numbers" on "public"."phone_numbers";

drop policy "Client admins view org profiles" on "public"."profiles";

drop policy "Impersonating agent view own profile" on "public"."profiles";

drop policy "Impersonating client admin view org profiles" on "public"."profiles";

drop policy "Super admins view all profiles" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users view own full profile" on "public"."profiles";

drop policy "Users view own profile" on "public"."profiles";

drop policy "Users create org properties" on "public"."properties";

drop policy "Users delete org properties" on "public"."properties";

drop policy "Users update org properties" on "public"."properties";

drop policy "Users view org properties" on "public"."properties";

drop policy "Users can manage qualification events in their org" on "public"."qualification_events";

drop policy "Users can view qualification events in their org" on "public"."qualification_events";

drop policy "Users can manage re-engagement campaigns in their org" on "public"."re_engagement_campaigns";

drop policy "Users can view re-engagement campaigns in their org" on "public"."re_engagement_campaigns";

drop policy "Users can manage re-engagement templates in their org" on "public"."re_engagement_templates";

drop policy "Users can view re-engagement templates in their org" on "public"."re_engagement_templates";

drop policy "Client admins manage org reports" on "public"."reports";

drop policy "Impersonating agent view reports" on "public"."reports";

drop policy "Impersonating client admin manage reports" on "public"."reports";

drop policy "Org users view reports" on "public"."reports";

drop policy "Super admins manage org reports" on "public"."reports";

drop policy "Admins delete room_units" on "public"."room_units";

drop policy "Impersonating users manage room_units" on "public"."room_units";

drop policy "Org users manage room_units" on "public"."room_units";

drop policy "Super admins manage org room_units" on "public"."room_units";

drop policy "Users can create room_units in their organization" on "public"."room_units";

drop policy "Users can update room_units in their organization" on "public"."room_units";

drop policy "Users can view room_units in their organization" on "public"."room_units";

drop policy "Client admins manage org rubric_templates" on "public"."rubric_templates";

drop policy "Impersonating agent view rubric_templates" on "public"."rubric_templates";

drop policy "Impersonating client admin manage rubric_templates" on "public"."rubric_templates";

drop policy "Org users view rubric_templates" on "public"."rubric_templates";

drop policy "Super admins manage org rubric_templates" on "public"."rubric_templates";

drop policy "Admins view social_platforms" on "public"."social_platforms";

drop policy "Agents view social_platforms_safe" on "public"."social_platforms";

drop policy "Client admins manage org social_platforms" on "public"."social_platforms";

drop policy "Impersonating client admin manage social_platforms" on "public"."social_platforms";

drop policy "Org users view social_platforms" on "public"."social_platforms";

drop policy "Super admins manage org social_platforms" on "public"."social_platforms";

drop policy "Agents can view their own membership" on "public"."team_members";

drop policy "Client admins can manage org team members" on "public"."team_members";

drop policy "Super admins can manage all team members" on "public"."team_members";

drop policy "Team leads can view their team members" on "public"."team_members";

drop policy "Agents can view their org teams" on "public"."teams";

drop policy "Client admins can manage org teams" on "public"."teams";

drop policy "Super admins can manage all teams" on "public"."teams";

drop policy "Client admins manage org training_modules" on "public"."training_modules";

drop policy "Impersonating agent view training_modules" on "public"."training_modules";

drop policy "Impersonating client admin manage training_modules" on "public"."training_modules";

drop policy "Org users view training_modules" on "public"."training_modules";

drop policy "Super admins manage org training_modules" on "public"."training_modules";

drop policy "Client admins manage org training_sessions" on "public"."training_sessions";

drop policy "Impersonating agent own training_sessions" on "public"."training_sessions";

drop policy "Impersonating client admin manage training_sessions" on "public"."training_sessions";

drop policy "Super admins manage org training_sessions" on "public"."training_sessions";

drop policy "Users manage own training_sessions" on "public"."training_sessions";

drop policy "Client admins can manage org user permissions" on "public"."user_permissions";

drop policy "Super admins can manage all user permissions" on "public"."user_permissions";

drop policy "Users can view their own permissions" on "public"."user_permissions";

drop policy "Client admins can view org role audit" on "public"."user_role_audit";

drop policy "Super admins can view all role audit" on "public"."user_role_audit";

drop policy "Users can view their own role history" on "public"."user_role_audit";

drop policy "Client admins can view roles for org users" on "public"."user_roles";

drop policy "Super admins manage all roles" on "public"."user_roles";

drop policy "Users can view own roles" on "public"."user_roles";

drop policy "Admins view org user sessions" on "public"."user_sessions";

drop policy "Users can delete their own sessions" on "public"."user_sessions";

drop policy "Users can view their own sessions" on "public"."user_sessions";

drop policy "Client admins view org webhook_health" on "public"."webhook_health";

drop policy "Impersonating client admin view webhook_health" on "public"."webhook_health";

drop policy "Super admins manage org webhook_health" on "public"."webhook_health";

drop policy "Client admins manage org workflows" on "public"."workflows";

drop policy "Impersonating agent view workflows" on "public"."workflows";

drop policy "Impersonating client admin manage workflows" on "public"."workflows";

drop policy "Super admins manage org workflows" on "public"."workflows";

drop policy "Users can view workflows in their organization" on "public"."workflows";

drop policy "Users can insert messages to their org conversations" on "public"."ai_messages";

drop policy "Users can read messages from their org conversations" on "public"."ai_messages";

drop policy "Super admins can view alert notifications" on "public"."alert_notifications";

drop policy "Super admins can manage alert rules" on "public"."alert_rules";

drop policy "Users can insert note history for bookings in their org" on "public"."booking_note_history";

drop policy "Users can view note history for bookings in their org" on "public"."booking_note_history";

drop policy "Users can delete booking templates in their org" on "public"."booking_templates";

drop policy "Users can insert booking templates in their org" on "public"."booking_templates";

drop policy "Users can update booking templates in their org" on "public"."booking_templates";

drop policy "Users can view their org's booking templates" on "public"."booking_templates";

drop policy "Agents create call logs" on "public"."call_logs";

drop policy "Users view authorized call logs" on "public"."call_logs";

drop policy "Users view authorized chat messages" on "public"."chat_messages";

drop policy "Super admins can update demo requests" on "public"."demo_requests";

drop policy "Super admins can view demo requests" on "public"."demo_requests";

drop policy "Users can delete their own filter presets" on "public"."filter_presets";

drop policy "Users can insert their own filter presets" on "public"."filter_presets";

drop policy "Users can update their own filter presets" on "public"."filter_presets";

drop policy "Users can view their own filter presets" on "public"."filter_presets";

drop policy "Users can delete their own tokens" on "public"."google_calendar_tokens";

drop policy "Users can insert their own tokens" on "public"."google_calendar_tokens";

drop policy "Users can update their own tokens" on "public"."google_calendar_tokens";

drop policy "Users can view their own tokens" on "public"."google_calendar_tokens";

drop policy "Super admins can view health history" on "public"."health_check_history";

drop policy "Super admins can manage health thresholds" on "public"."health_check_thresholds";

drop policy "Assigned admins and super admins can update tickets" on "public"."helpdesk_tickets";

drop policy "Users can create helpdesk tickets" on "public"."helpdesk_tickets";

drop policy "Users can view their own tickets" on "public"."helpdesk_tickets";

drop policy "Users can create inventory items in their organization" on "public"."inventory_items";

drop policy "Users can delete inventory items in their organization" on "public"."inventory_items";

drop policy "Users can update inventory items in their organization" on "public"."inventory_items";

drop policy "Users can view inventory items in their organization" on "public"."inventory_items";

drop policy "Users can delete engagement profiles in their org" on "public"."lead_engagement_profiles";

drop policy "Users can insert engagement profiles in their org" on "public"."lead_engagement_profiles";

drop policy "Users can update engagement profiles in their org" on "public"."lead_engagement_profiles";

drop policy "Users can view engagement profiles in their org" on "public"."lead_engagement_profiles";

drop policy "Users can delete lead offerings in their organization" on "public"."lead_offerings";

drop policy "Users can insert lead offerings in their organization" on "public"."lead_offerings";

drop policy "Users can update lead offerings in their organization" on "public"."lead_offerings";

drop policy "Users can view lead offerings in their organization" on "public"."lead_offerings";

drop policy "Super admins view login attempts" on "public"."login_attempts";

drop policy "System can record login attempts" on "public"."login_attempts";

drop policy "Client admins can create maintenance blocks" on "public"."maintenance_blocks";

drop policy "Client admins can delete maintenance blocks" on "public"."maintenance_blocks";

drop policy "Client admins can update maintenance blocks" on "public"."maintenance_blocks";

drop policy "Users can view maintenance blocks in their org" on "public"."maintenance_blocks";

drop policy "Super admins manage migration_logs" on "public"."migration_logs";

drop policy "Users view own notifications" on "public"."notification_history";

drop policy "Users can insert their own notification preferences" on "public"."notification_preferences";

drop policy "Users can update their own notification preferences" on "public"."notification_preferences";

drop policy "Users can view their own notification preferences" on "public"."notification_preferences";

drop policy "Users can create expenses for their organization" on "public"."operational_expenses";

drop policy "Users can delete expenses for their organization" on "public"."operational_expenses";

drop policy "Users can update expenses for their organization" on "public"."operational_expenses";

drop policy "Users can view expenses for their organization" on "public"."operational_expenses";

drop policy "Super admins can manage secret rotation" on "public"."secret_rotation_tracking";

drop policy "Chat admins can remove members" on "public"."team_chat_members";

drop policy "Chat admins can update members" on "public"."team_chat_members";

drop policy "Chat creators/admins can add members" on "public"."team_chat_members";

drop policy "Members can view chat members" on "public"."team_chat_members";

drop policy "Members can send messages" on "public"."team_chat_messages";

drop policy "Members can view messages" on "public"."team_chat_messages";

drop policy "Senders and admins can delete messages" on "public"."team_chat_messages";

drop policy "Senders can edit their messages" on "public"."team_chat_messages";

drop policy "Members can add reactions" on "public"."team_chat_reactions";

drop policy "Members can view reactions" on "public"."team_chat_reactions";

drop policy "Users can remove their reactions" on "public"."team_chat_reactions";

drop policy "Authenticated users can create chats in their org" on "public"."team_chats";

drop policy "Chat admins can delete chats" on "public"."team_chats";

drop policy "Chat admins can update chats" on "public"."team_chats";

drop policy "Users can view chats they are members of" on "public"."team_chats";

drop policy "Users can view workflow runs in their organization" on "public"."workflow_runs";

revoke delete on table "public"."agent_priorities" from "anon";

revoke insert on table "public"."agent_priorities" from "anon";

revoke references on table "public"."agent_priorities" from "anon";

revoke select on table "public"."agent_priorities" from "anon";

revoke trigger on table "public"."agent_priorities" from "anon";

revoke truncate on table "public"."agent_priorities" from "anon";

revoke update on table "public"."agent_priorities" from "anon";

revoke delete on table "public"."agent_priorities" from "authenticated";

revoke insert on table "public"."agent_priorities" from "authenticated";

revoke references on table "public"."agent_priorities" from "authenticated";

revoke select on table "public"."agent_priorities" from "authenticated";

revoke trigger on table "public"."agent_priorities" from "authenticated";

revoke truncate on table "public"."agent_priorities" from "authenticated";

revoke update on table "public"."agent_priorities" from "authenticated";

revoke delete on table "public"."agent_priorities" from "service_role";

revoke insert on table "public"."agent_priorities" from "service_role";

revoke references on table "public"."agent_priorities" from "service_role";

revoke select on table "public"."agent_priorities" from "service_role";

revoke trigger on table "public"."agent_priorities" from "service_role";

revoke truncate on table "public"."agent_priorities" from "service_role";

revoke update on table "public"."agent_priorities" from "service_role";

revoke delete on table "public"."ai_alert_history" from "anon";

revoke insert on table "public"."ai_alert_history" from "anon";

revoke references on table "public"."ai_alert_history" from "anon";

revoke select on table "public"."ai_alert_history" from "anon";

revoke trigger on table "public"."ai_alert_history" from "anon";

revoke truncate on table "public"."ai_alert_history" from "anon";

revoke update on table "public"."ai_alert_history" from "anon";

revoke delete on table "public"."ai_alert_history" from "authenticated";

revoke insert on table "public"."ai_alert_history" from "authenticated";

revoke references on table "public"."ai_alert_history" from "authenticated";

revoke select on table "public"."ai_alert_history" from "authenticated";

revoke trigger on table "public"."ai_alert_history" from "authenticated";

revoke truncate on table "public"."ai_alert_history" from "authenticated";

revoke update on table "public"."ai_alert_history" from "authenticated";

revoke delete on table "public"."ai_alert_history" from "service_role";

revoke insert on table "public"."ai_alert_history" from "service_role";

revoke references on table "public"."ai_alert_history" from "service_role";

revoke select on table "public"."ai_alert_history" from "service_role";

revoke trigger on table "public"."ai_alert_history" from "service_role";

revoke truncate on table "public"."ai_alert_history" from "service_role";

revoke update on table "public"."ai_alert_history" from "service_role";

revoke delete on table "public"."ai_alert_rules" from "anon";

revoke insert on table "public"."ai_alert_rules" from "anon";

revoke references on table "public"."ai_alert_rules" from "anon";

revoke select on table "public"."ai_alert_rules" from "anon";

revoke trigger on table "public"."ai_alert_rules" from "anon";

revoke truncate on table "public"."ai_alert_rules" from "anon";

revoke update on table "public"."ai_alert_rules" from "anon";

revoke delete on table "public"."ai_alert_rules" from "authenticated";

revoke insert on table "public"."ai_alert_rules" from "authenticated";

revoke references on table "public"."ai_alert_rules" from "authenticated";

revoke select on table "public"."ai_alert_rules" from "authenticated";

revoke trigger on table "public"."ai_alert_rules" from "authenticated";

revoke truncate on table "public"."ai_alert_rules" from "authenticated";

revoke update on table "public"."ai_alert_rules" from "authenticated";

revoke delete on table "public"."ai_alert_rules" from "service_role";

revoke insert on table "public"."ai_alert_rules" from "service_role";

revoke references on table "public"."ai_alert_rules" from "service_role";

revoke select on table "public"."ai_alert_rules" from "service_role";

revoke trigger on table "public"."ai_alert_rules" from "service_role";

revoke truncate on table "public"."ai_alert_rules" from "service_role";

revoke update on table "public"."ai_alert_rules" from "service_role";

revoke delete on table "public"."ai_analytics_snapshots" from "anon";

revoke insert on table "public"."ai_analytics_snapshots" from "anon";

revoke references on table "public"."ai_analytics_snapshots" from "anon";

revoke select on table "public"."ai_analytics_snapshots" from "anon";

revoke trigger on table "public"."ai_analytics_snapshots" from "anon";

revoke truncate on table "public"."ai_analytics_snapshots" from "anon";

revoke update on table "public"."ai_analytics_snapshots" from "anon";

revoke delete on table "public"."ai_analytics_snapshots" from "authenticated";

revoke insert on table "public"."ai_analytics_snapshots" from "authenticated";

revoke references on table "public"."ai_analytics_snapshots" from "authenticated";

revoke select on table "public"."ai_analytics_snapshots" from "authenticated";

revoke trigger on table "public"."ai_analytics_snapshots" from "authenticated";

revoke truncate on table "public"."ai_analytics_snapshots" from "authenticated";

revoke update on table "public"."ai_analytics_snapshots" from "authenticated";

revoke delete on table "public"."ai_analytics_snapshots" from "service_role";

revoke insert on table "public"."ai_analytics_snapshots" from "service_role";

revoke references on table "public"."ai_analytics_snapshots" from "service_role";

revoke select on table "public"."ai_analytics_snapshots" from "service_role";

revoke trigger on table "public"."ai_analytics_snapshots" from "service_role";

revoke truncate on table "public"."ai_analytics_snapshots" from "service_role";

revoke update on table "public"."ai_analytics_snapshots" from "service_role";

revoke delete on table "public"."ai_conversations" from "anon";

revoke insert on table "public"."ai_conversations" from "anon";

revoke references on table "public"."ai_conversations" from "anon";

revoke select on table "public"."ai_conversations" from "anon";

revoke trigger on table "public"."ai_conversations" from "anon";

revoke truncate on table "public"."ai_conversations" from "anon";

revoke update on table "public"."ai_conversations" from "anon";

revoke delete on table "public"."ai_conversations" from "authenticated";

revoke insert on table "public"."ai_conversations" from "authenticated";

revoke references on table "public"."ai_conversations" from "authenticated";

revoke select on table "public"."ai_conversations" from "authenticated";

revoke trigger on table "public"."ai_conversations" from "authenticated";

revoke truncate on table "public"."ai_conversations" from "authenticated";

revoke update on table "public"."ai_conversations" from "authenticated";

revoke delete on table "public"."ai_conversations" from "service_role";

revoke insert on table "public"."ai_conversations" from "service_role";

revoke references on table "public"."ai_conversations" from "service_role";

revoke select on table "public"."ai_conversations" from "service_role";

revoke trigger on table "public"."ai_conversations" from "service_role";

revoke truncate on table "public"."ai_conversations" from "service_role";

revoke update on table "public"."ai_conversations" from "service_role";

revoke delete on table "public"."ai_messages" from "anon";

revoke insert on table "public"."ai_messages" from "anon";

revoke references on table "public"."ai_messages" from "anon";

revoke select on table "public"."ai_messages" from "anon";

revoke trigger on table "public"."ai_messages" from "anon";

revoke truncate on table "public"."ai_messages" from "anon";

revoke update on table "public"."ai_messages" from "anon";

revoke delete on table "public"."ai_messages" from "authenticated";

revoke insert on table "public"."ai_messages" from "authenticated";

revoke references on table "public"."ai_messages" from "authenticated";

revoke select on table "public"."ai_messages" from "authenticated";

revoke trigger on table "public"."ai_messages" from "authenticated";

revoke truncate on table "public"."ai_messages" from "authenticated";

revoke update on table "public"."ai_messages" from "authenticated";

revoke delete on table "public"."ai_messages" from "service_role";

revoke insert on table "public"."ai_messages" from "service_role";

revoke references on table "public"."ai_messages" from "service_role";

revoke select on table "public"."ai_messages" from "service_role";

revoke trigger on table "public"."ai_messages" from "service_role";

revoke truncate on table "public"."ai_messages" from "service_role";

revoke update on table "public"."ai_messages" from "service_role";

revoke delete on table "public"."ai_performance_metrics" from "anon";

revoke insert on table "public"."ai_performance_metrics" from "anon";

revoke references on table "public"."ai_performance_metrics" from "anon";

revoke select on table "public"."ai_performance_metrics" from "anon";

revoke trigger on table "public"."ai_performance_metrics" from "anon";

revoke truncate on table "public"."ai_performance_metrics" from "anon";

revoke update on table "public"."ai_performance_metrics" from "anon";

revoke delete on table "public"."ai_performance_metrics" from "authenticated";

revoke insert on table "public"."ai_performance_metrics" from "authenticated";

revoke references on table "public"."ai_performance_metrics" from "authenticated";

revoke select on table "public"."ai_performance_metrics" from "authenticated";

revoke trigger on table "public"."ai_performance_metrics" from "authenticated";

revoke truncate on table "public"."ai_performance_metrics" from "authenticated";

revoke update on table "public"."ai_performance_metrics" from "authenticated";

revoke delete on table "public"."ai_performance_metrics" from "service_role";

revoke insert on table "public"."ai_performance_metrics" from "service_role";

revoke references on table "public"."ai_performance_metrics" from "service_role";

revoke select on table "public"."ai_performance_metrics" from "service_role";

revoke trigger on table "public"."ai_performance_metrics" from "service_role";

revoke truncate on table "public"."ai_performance_metrics" from "service_role";

revoke update on table "public"."ai_performance_metrics" from "service_role";

revoke delete on table "public"."alert_notifications" from "anon";

revoke insert on table "public"."alert_notifications" from "anon";

revoke references on table "public"."alert_notifications" from "anon";

revoke select on table "public"."alert_notifications" from "anon";

revoke trigger on table "public"."alert_notifications" from "anon";

revoke truncate on table "public"."alert_notifications" from "anon";

revoke update on table "public"."alert_notifications" from "anon";

revoke delete on table "public"."alert_notifications" from "authenticated";

revoke insert on table "public"."alert_notifications" from "authenticated";

revoke references on table "public"."alert_notifications" from "authenticated";

revoke trigger on table "public"."alert_notifications" from "authenticated";

revoke truncate on table "public"."alert_notifications" from "authenticated";

revoke update on table "public"."alert_notifications" from "authenticated";

revoke delete on table "public"."alert_notifications" from "service_role";

revoke insert on table "public"."alert_notifications" from "service_role";

revoke references on table "public"."alert_notifications" from "service_role";

revoke select on table "public"."alert_notifications" from "service_role";

revoke trigger on table "public"."alert_notifications" from "service_role";

revoke truncate on table "public"."alert_notifications" from "service_role";

revoke update on table "public"."alert_notifications" from "service_role";

revoke delete on table "public"."alert_rules" from "anon";

revoke insert on table "public"."alert_rules" from "anon";

revoke references on table "public"."alert_rules" from "anon";

revoke select on table "public"."alert_rules" from "anon";

revoke trigger on table "public"."alert_rules" from "anon";

revoke truncate on table "public"."alert_rules" from "anon";

revoke update on table "public"."alert_rules" from "anon";

revoke references on table "public"."alert_rules" from "authenticated";

revoke trigger on table "public"."alert_rules" from "authenticated";

revoke truncate on table "public"."alert_rules" from "authenticated";

revoke delete on table "public"."alert_rules" from "service_role";

revoke insert on table "public"."alert_rules" from "service_role";

revoke references on table "public"."alert_rules" from "service_role";

revoke select on table "public"."alert_rules" from "service_role";

revoke trigger on table "public"."alert_rules" from "service_role";

revoke truncate on table "public"."alert_rules" from "service_role";

revoke update on table "public"."alert_rules" from "service_role";

revoke delete on table "public"."analytics_events" from "anon";

revoke insert on table "public"."analytics_events" from "anon";

revoke references on table "public"."analytics_events" from "anon";

revoke select on table "public"."analytics_events" from "anon";

revoke trigger on table "public"."analytics_events" from "anon";

revoke truncate on table "public"."analytics_events" from "anon";

revoke update on table "public"."analytics_events" from "anon";

revoke delete on table "public"."analytics_events" from "authenticated";

revoke insert on table "public"."analytics_events" from "authenticated";

revoke references on table "public"."analytics_events" from "authenticated";

revoke select on table "public"."analytics_events" from "authenticated";

revoke trigger on table "public"."analytics_events" from "authenticated";

revoke truncate on table "public"."analytics_events" from "authenticated";

revoke update on table "public"."analytics_events" from "authenticated";

revoke delete on table "public"."analytics_events" from "service_role";

revoke insert on table "public"."analytics_events" from "service_role";

revoke references on table "public"."analytics_events" from "service_role";

revoke select on table "public"."analytics_events" from "service_role";

revoke trigger on table "public"."analytics_events" from "service_role";

revoke truncate on table "public"."analytics_events" from "service_role";

revoke update on table "public"."analytics_events" from "service_role";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke delete on table "public"."audit_logs" from "authenticated";

revoke insert on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "authenticated";

revoke select on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke update on table "public"."audit_logs" from "authenticated";

revoke delete on table "public"."audit_logs" from "service_role";

revoke insert on table "public"."audit_logs" from "service_role";

revoke references on table "public"."audit_logs" from "service_role";

revoke select on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke update on table "public"."audit_logs" from "service_role";

revoke delete on table "public"."booking_note_history" from "anon";

revoke insert on table "public"."booking_note_history" from "anon";

revoke references on table "public"."booking_note_history" from "anon";

revoke select on table "public"."booking_note_history" from "anon";

revoke trigger on table "public"."booking_note_history" from "anon";

revoke truncate on table "public"."booking_note_history" from "anon";

revoke update on table "public"."booking_note_history" from "anon";

revoke delete on table "public"."booking_note_history" from "authenticated";

revoke insert on table "public"."booking_note_history" from "authenticated";

revoke references on table "public"."booking_note_history" from "authenticated";

revoke select on table "public"."booking_note_history" from "authenticated";

revoke trigger on table "public"."booking_note_history" from "authenticated";

revoke truncate on table "public"."booking_note_history" from "authenticated";

revoke update on table "public"."booking_note_history" from "authenticated";

revoke delete on table "public"."booking_note_history" from "service_role";

revoke insert on table "public"."booking_note_history" from "service_role";

revoke references on table "public"."booking_note_history" from "service_role";

revoke select on table "public"."booking_note_history" from "service_role";

revoke trigger on table "public"."booking_note_history" from "service_role";

revoke truncate on table "public"."booking_note_history" from "service_role";

revoke update on table "public"."booking_note_history" from "service_role";

revoke delete on table "public"."booking_templates" from "anon";

revoke insert on table "public"."booking_templates" from "anon";

revoke references on table "public"."booking_templates" from "anon";

revoke select on table "public"."booking_templates" from "anon";

revoke trigger on table "public"."booking_templates" from "anon";

revoke truncate on table "public"."booking_templates" from "anon";

revoke update on table "public"."booking_templates" from "anon";

revoke delete on table "public"."booking_templates" from "authenticated";

revoke insert on table "public"."booking_templates" from "authenticated";

revoke references on table "public"."booking_templates" from "authenticated";

revoke select on table "public"."booking_templates" from "authenticated";

revoke trigger on table "public"."booking_templates" from "authenticated";

revoke truncate on table "public"."booking_templates" from "authenticated";

revoke update on table "public"."booking_templates" from "authenticated";

revoke delete on table "public"."booking_templates" from "service_role";

revoke insert on table "public"."booking_templates" from "service_role";

revoke references on table "public"."booking_templates" from "service_role";

revoke select on table "public"."booking_templates" from "service_role";

revoke trigger on table "public"."booking_templates" from "service_role";

revoke truncate on table "public"."booking_templates" from "service_role";

revoke update on table "public"."booking_templates" from "service_role";

revoke delete on table "public"."bookings" from "anon";

revoke insert on table "public"."bookings" from "anon";

revoke references on table "public"."bookings" from "anon";

revoke select on table "public"."bookings" from "anon";

revoke trigger on table "public"."bookings" from "anon";

revoke truncate on table "public"."bookings" from "anon";

revoke update on table "public"."bookings" from "anon";

revoke delete on table "public"."bookings" from "authenticated";

revoke insert on table "public"."bookings" from "authenticated";

revoke references on table "public"."bookings" from "authenticated";

revoke select on table "public"."bookings" from "authenticated";

revoke trigger on table "public"."bookings" from "authenticated";

revoke truncate on table "public"."bookings" from "authenticated";

revoke update on table "public"."bookings" from "authenticated";

revoke delete on table "public"."bookings" from "service_role";

revoke insert on table "public"."bookings" from "service_role";

revoke references on table "public"."bookings" from "service_role";

revoke select on table "public"."bookings" from "service_role";

revoke trigger on table "public"."bookings" from "service_role";

revoke truncate on table "public"."bookings" from "service_role";

revoke update on table "public"."bookings" from "service_role";

revoke delete on table "public"."calendar_events" from "anon";

revoke insert on table "public"."calendar_events" from "anon";

revoke references on table "public"."calendar_events" from "anon";

revoke select on table "public"."calendar_events" from "anon";

revoke trigger on table "public"."calendar_events" from "anon";

revoke truncate on table "public"."calendar_events" from "anon";

revoke update on table "public"."calendar_events" from "anon";

revoke delete on table "public"."calendar_events" from "authenticated";

revoke insert on table "public"."calendar_events" from "authenticated";

revoke references on table "public"."calendar_events" from "authenticated";

revoke select on table "public"."calendar_events" from "authenticated";

revoke trigger on table "public"."calendar_events" from "authenticated";

revoke truncate on table "public"."calendar_events" from "authenticated";

revoke update on table "public"."calendar_events" from "authenticated";

revoke delete on table "public"."calendar_events" from "service_role";

revoke insert on table "public"."calendar_events" from "service_role";

revoke references on table "public"."calendar_events" from "service_role";

revoke select on table "public"."calendar_events" from "service_role";

revoke trigger on table "public"."calendar_events" from "service_role";

revoke truncate on table "public"."calendar_events" from "service_role";

revoke update on table "public"."calendar_events" from "service_role";

revoke delete on table "public"."calendar_sync_events" from "anon";

revoke insert on table "public"."calendar_sync_events" from "anon";

revoke references on table "public"."calendar_sync_events" from "anon";

revoke select on table "public"."calendar_sync_events" from "anon";

revoke trigger on table "public"."calendar_sync_events" from "anon";

revoke truncate on table "public"."calendar_sync_events" from "anon";

revoke update on table "public"."calendar_sync_events" from "anon";

revoke delete on table "public"."calendar_sync_events" from "authenticated";

revoke insert on table "public"."calendar_sync_events" from "authenticated";

revoke references on table "public"."calendar_sync_events" from "authenticated";

revoke select on table "public"."calendar_sync_events" from "authenticated";

revoke trigger on table "public"."calendar_sync_events" from "authenticated";

revoke truncate on table "public"."calendar_sync_events" from "authenticated";

revoke update on table "public"."calendar_sync_events" from "authenticated";

revoke delete on table "public"."calendar_sync_events" from "service_role";

revoke insert on table "public"."calendar_sync_events" from "service_role";

revoke references on table "public"."calendar_sync_events" from "service_role";

revoke select on table "public"."calendar_sync_events" from "service_role";

revoke trigger on table "public"."calendar_sync_events" from "service_role";

revoke truncate on table "public"."calendar_sync_events" from "service_role";

revoke update on table "public"."calendar_sync_events" from "service_role";

revoke delete on table "public"."call_logs" from "anon";

revoke insert on table "public"."call_logs" from "anon";

revoke references on table "public"."call_logs" from "anon";

revoke select on table "public"."call_logs" from "anon";

revoke trigger on table "public"."call_logs" from "anon";

revoke truncate on table "public"."call_logs" from "anon";

revoke update on table "public"."call_logs" from "anon";

revoke delete on table "public"."call_logs" from "authenticated";

revoke insert on table "public"."call_logs" from "authenticated";

revoke references on table "public"."call_logs" from "authenticated";

revoke select on table "public"."call_logs" from "authenticated";

revoke trigger on table "public"."call_logs" from "authenticated";

revoke truncate on table "public"."call_logs" from "authenticated";

revoke update on table "public"."call_logs" from "authenticated";

revoke delete on table "public"."call_logs" from "service_role";

revoke insert on table "public"."call_logs" from "service_role";

revoke references on table "public"."call_logs" from "service_role";

revoke select on table "public"."call_logs" from "service_role";

revoke trigger on table "public"."call_logs" from "service_role";

revoke truncate on table "public"."call_logs" from "service_role";

revoke update on table "public"."call_logs" from "service_role";

revoke delete on table "public"."chat_messages" from "anon";

revoke insert on table "public"."chat_messages" from "anon";

revoke references on table "public"."chat_messages" from "anon";

revoke select on table "public"."chat_messages" from "anon";

revoke trigger on table "public"."chat_messages" from "anon";

revoke truncate on table "public"."chat_messages" from "anon";

revoke update on table "public"."chat_messages" from "anon";

revoke delete on table "public"."chat_messages" from "authenticated";

revoke insert on table "public"."chat_messages" from "authenticated";

revoke references on table "public"."chat_messages" from "authenticated";

revoke select on table "public"."chat_messages" from "authenticated";

revoke trigger on table "public"."chat_messages" from "authenticated";

revoke truncate on table "public"."chat_messages" from "authenticated";

revoke update on table "public"."chat_messages" from "authenticated";

revoke delete on table "public"."chat_messages" from "service_role";

revoke insert on table "public"."chat_messages" from "service_role";

revoke references on table "public"."chat_messages" from "service_role";

revoke select on table "public"."chat_messages" from "service_role";

revoke trigger on table "public"."chat_messages" from "service_role";

revoke truncate on table "public"."chat_messages" from "service_role";

revoke update on table "public"."chat_messages" from "service_role";

revoke delete on table "public"."communications" from "anon";

revoke insert on table "public"."communications" from "anon";

revoke references on table "public"."communications" from "anon";

revoke select on table "public"."communications" from "anon";

revoke trigger on table "public"."communications" from "anon";

revoke truncate on table "public"."communications" from "anon";

revoke update on table "public"."communications" from "anon";

revoke delete on table "public"."communications" from "authenticated";

revoke insert on table "public"."communications" from "authenticated";

revoke references on table "public"."communications" from "authenticated";

revoke select on table "public"."communications" from "authenticated";

revoke trigger on table "public"."communications" from "authenticated";

revoke truncate on table "public"."communications" from "authenticated";

revoke update on table "public"."communications" from "authenticated";

revoke delete on table "public"."communications" from "service_role";

revoke insert on table "public"."communications" from "service_role";

revoke references on table "public"."communications" from "service_role";

revoke select on table "public"."communications" from "service_role";

revoke trigger on table "public"."communications" from "service_role";

revoke truncate on table "public"."communications" from "service_role";

revoke update on table "public"."communications" from "service_role";

revoke delete on table "public"."conversation_metadata" from "anon";

revoke insert on table "public"."conversation_metadata" from "anon";

revoke references on table "public"."conversation_metadata" from "anon";

revoke select on table "public"."conversation_metadata" from "anon";

revoke trigger on table "public"."conversation_metadata" from "anon";

revoke truncate on table "public"."conversation_metadata" from "anon";

revoke update on table "public"."conversation_metadata" from "anon";

revoke delete on table "public"."conversation_metadata" from "authenticated";

revoke insert on table "public"."conversation_metadata" from "authenticated";

revoke references on table "public"."conversation_metadata" from "authenticated";

revoke select on table "public"."conversation_metadata" from "authenticated";

revoke trigger on table "public"."conversation_metadata" from "authenticated";

revoke truncate on table "public"."conversation_metadata" from "authenticated";

revoke update on table "public"."conversation_metadata" from "authenticated";

revoke delete on table "public"."conversation_metadata" from "service_role";

revoke insert on table "public"."conversation_metadata" from "service_role";

revoke references on table "public"."conversation_metadata" from "service_role";

revoke select on table "public"."conversation_metadata" from "service_role";

revoke trigger on table "public"."conversation_metadata" from "service_role";

revoke truncate on table "public"."conversation_metadata" from "service_role";

revoke update on table "public"."conversation_metadata" from "service_role";

revoke delete on table "public"."dashboard_layouts" from "anon";

revoke insert on table "public"."dashboard_layouts" from "anon";

revoke references on table "public"."dashboard_layouts" from "anon";

revoke select on table "public"."dashboard_layouts" from "anon";

revoke trigger on table "public"."dashboard_layouts" from "anon";

revoke truncate on table "public"."dashboard_layouts" from "anon";

revoke update on table "public"."dashboard_layouts" from "anon";

revoke delete on table "public"."dashboard_layouts" from "authenticated";

revoke insert on table "public"."dashboard_layouts" from "authenticated";

revoke references on table "public"."dashboard_layouts" from "authenticated";

revoke select on table "public"."dashboard_layouts" from "authenticated";

revoke trigger on table "public"."dashboard_layouts" from "authenticated";

revoke truncate on table "public"."dashboard_layouts" from "authenticated";

revoke update on table "public"."dashboard_layouts" from "authenticated";

revoke delete on table "public"."dashboard_layouts" from "service_role";

revoke insert on table "public"."dashboard_layouts" from "service_role";

revoke references on table "public"."dashboard_layouts" from "service_role";

revoke select on table "public"."dashboard_layouts" from "service_role";

revoke trigger on table "public"."dashboard_layouts" from "service_role";

revoke truncate on table "public"."dashboard_layouts" from "service_role";

revoke update on table "public"."dashboard_layouts" from "service_role";

revoke delete on table "public"."demo_requests" from "anon";

revoke insert on table "public"."demo_requests" from "anon";

revoke references on table "public"."demo_requests" from "anon";

revoke select on table "public"."demo_requests" from "anon";

revoke trigger on table "public"."demo_requests" from "anon";

revoke truncate on table "public"."demo_requests" from "anon";

revoke update on table "public"."demo_requests" from "anon";

revoke delete on table "public"."demo_requests" from "authenticated";

revoke insert on table "public"."demo_requests" from "authenticated";

revoke references on table "public"."demo_requests" from "authenticated";

revoke select on table "public"."demo_requests" from "authenticated";

revoke trigger on table "public"."demo_requests" from "authenticated";

revoke truncate on table "public"."demo_requests" from "authenticated";

revoke update on table "public"."demo_requests" from "authenticated";

revoke delete on table "public"."demo_requests" from "service_role";

revoke insert on table "public"."demo_requests" from "service_role";

revoke references on table "public"."demo_requests" from "service_role";

revoke select on table "public"."demo_requests" from "service_role";

revoke trigger on table "public"."demo_requests" from "service_role";

revoke truncate on table "public"."demo_requests" from "service_role";

revoke update on table "public"."demo_requests" from "service_role";

revoke delete on table "public"."email_queue" from "anon";

revoke insert on table "public"."email_queue" from "anon";

revoke references on table "public"."email_queue" from "anon";

revoke select on table "public"."email_queue" from "anon";

revoke trigger on table "public"."email_queue" from "anon";

revoke truncate on table "public"."email_queue" from "anon";

revoke update on table "public"."email_queue" from "anon";

revoke delete on table "public"."email_queue" from "authenticated";

revoke insert on table "public"."email_queue" from "authenticated";

revoke references on table "public"."email_queue" from "authenticated";

revoke select on table "public"."email_queue" from "authenticated";

revoke trigger on table "public"."email_queue" from "authenticated";

revoke truncate on table "public"."email_queue" from "authenticated";

revoke update on table "public"."email_queue" from "authenticated";

revoke delete on table "public"."email_queue" from "service_role";

revoke references on table "public"."email_queue" from "service_role";

revoke trigger on table "public"."email_queue" from "service_role";

revoke truncate on table "public"."email_queue" from "service_role";

revoke delete on table "public"."filter_presets" from "anon";

revoke insert on table "public"."filter_presets" from "anon";

revoke references on table "public"."filter_presets" from "anon";

revoke select on table "public"."filter_presets" from "anon";

revoke trigger on table "public"."filter_presets" from "anon";

revoke truncate on table "public"."filter_presets" from "anon";

revoke update on table "public"."filter_presets" from "anon";

revoke delete on table "public"."filter_presets" from "authenticated";

revoke insert on table "public"."filter_presets" from "authenticated";

revoke references on table "public"."filter_presets" from "authenticated";

revoke select on table "public"."filter_presets" from "authenticated";

revoke trigger on table "public"."filter_presets" from "authenticated";

revoke truncate on table "public"."filter_presets" from "authenticated";

revoke update on table "public"."filter_presets" from "authenticated";

revoke delete on table "public"."filter_presets" from "service_role";

revoke insert on table "public"."filter_presets" from "service_role";

revoke references on table "public"."filter_presets" from "service_role";

revoke select on table "public"."filter_presets" from "service_role";

revoke trigger on table "public"."filter_presets" from "service_role";

revoke truncate on table "public"."filter_presets" from "service_role";

revoke update on table "public"."filter_presets" from "service_role";

revoke delete on table "public"."google_calendar_tokens" from "anon";

revoke insert on table "public"."google_calendar_tokens" from "anon";

revoke references on table "public"."google_calendar_tokens" from "anon";

revoke select on table "public"."google_calendar_tokens" from "anon";

revoke trigger on table "public"."google_calendar_tokens" from "anon";

revoke truncate on table "public"."google_calendar_tokens" from "anon";

revoke update on table "public"."google_calendar_tokens" from "anon";

revoke delete on table "public"."google_calendar_tokens" from "authenticated";

revoke insert on table "public"."google_calendar_tokens" from "authenticated";

revoke references on table "public"."google_calendar_tokens" from "authenticated";

revoke select on table "public"."google_calendar_tokens" from "authenticated";

revoke trigger on table "public"."google_calendar_tokens" from "authenticated";

revoke truncate on table "public"."google_calendar_tokens" from "authenticated";

revoke update on table "public"."google_calendar_tokens" from "authenticated";

revoke delete on table "public"."google_calendar_tokens" from "service_role";

revoke insert on table "public"."google_calendar_tokens" from "service_role";

revoke references on table "public"."google_calendar_tokens" from "service_role";

revoke select on table "public"."google_calendar_tokens" from "service_role";

revoke trigger on table "public"."google_calendar_tokens" from "service_role";

revoke truncate on table "public"."google_calendar_tokens" from "service_role";

revoke update on table "public"."google_calendar_tokens" from "service_role";

revoke delete on table "public"."handoff_events" from "anon";

revoke insert on table "public"."handoff_events" from "anon";

revoke references on table "public"."handoff_events" from "anon";

revoke select on table "public"."handoff_events" from "anon";

revoke trigger on table "public"."handoff_events" from "anon";

revoke truncate on table "public"."handoff_events" from "anon";

revoke update on table "public"."handoff_events" from "anon";

revoke delete on table "public"."handoff_events" from "authenticated";

revoke insert on table "public"."handoff_events" from "authenticated";

revoke references on table "public"."handoff_events" from "authenticated";

revoke select on table "public"."handoff_events" from "authenticated";

revoke trigger on table "public"."handoff_events" from "authenticated";

revoke truncate on table "public"."handoff_events" from "authenticated";

revoke update on table "public"."handoff_events" from "authenticated";

revoke delete on table "public"."handoff_events" from "service_role";

revoke insert on table "public"."handoff_events" from "service_role";

revoke references on table "public"."handoff_events" from "service_role";

revoke select on table "public"."handoff_events" from "service_role";

revoke trigger on table "public"."handoff_events" from "service_role";

revoke truncate on table "public"."handoff_events" from "service_role";

revoke update on table "public"."handoff_events" from "service_role";

revoke delete on table "public"."health_check_history" from "anon";

revoke insert on table "public"."health_check_history" from "anon";

revoke references on table "public"."health_check_history" from "anon";

revoke select on table "public"."health_check_history" from "anon";

revoke trigger on table "public"."health_check_history" from "anon";

revoke truncate on table "public"."health_check_history" from "anon";

revoke update on table "public"."health_check_history" from "anon";

revoke delete on table "public"."health_check_history" from "authenticated";

revoke insert on table "public"."health_check_history" from "authenticated";

revoke references on table "public"."health_check_history" from "authenticated";

revoke select on table "public"."health_check_history" from "authenticated";

revoke trigger on table "public"."health_check_history" from "authenticated";

revoke truncate on table "public"."health_check_history" from "authenticated";

revoke update on table "public"."health_check_history" from "authenticated";

revoke delete on table "public"."health_check_history" from "service_role";

revoke insert on table "public"."health_check_history" from "service_role";

revoke references on table "public"."health_check_history" from "service_role";

revoke select on table "public"."health_check_history" from "service_role";

revoke trigger on table "public"."health_check_history" from "service_role";

revoke truncate on table "public"."health_check_history" from "service_role";

revoke update on table "public"."health_check_history" from "service_role";

revoke delete on table "public"."health_check_thresholds" from "anon";

revoke insert on table "public"."health_check_thresholds" from "anon";

revoke references on table "public"."health_check_thresholds" from "anon";

revoke select on table "public"."health_check_thresholds" from "anon";

revoke trigger on table "public"."health_check_thresholds" from "anon";

revoke truncate on table "public"."health_check_thresholds" from "anon";

revoke update on table "public"."health_check_thresholds" from "anon";

revoke delete on table "public"."health_check_thresholds" from "authenticated";

revoke insert on table "public"."health_check_thresholds" from "authenticated";

revoke references on table "public"."health_check_thresholds" from "authenticated";

revoke select on table "public"."health_check_thresholds" from "authenticated";

revoke trigger on table "public"."health_check_thresholds" from "authenticated";

revoke truncate on table "public"."health_check_thresholds" from "authenticated";

revoke update on table "public"."health_check_thresholds" from "authenticated";

revoke delete on table "public"."health_check_thresholds" from "service_role";

revoke insert on table "public"."health_check_thresholds" from "service_role";

revoke references on table "public"."health_check_thresholds" from "service_role";

revoke select on table "public"."health_check_thresholds" from "service_role";

revoke trigger on table "public"."health_check_thresholds" from "service_role";

revoke truncate on table "public"."health_check_thresholds" from "service_role";

revoke update on table "public"."health_check_thresholds" from "service_role";

revoke delete on table "public"."helpdesk_tickets" from "anon";

revoke insert on table "public"."helpdesk_tickets" from "anon";

revoke references on table "public"."helpdesk_tickets" from "anon";

revoke select on table "public"."helpdesk_tickets" from "anon";

revoke trigger on table "public"."helpdesk_tickets" from "anon";

revoke truncate on table "public"."helpdesk_tickets" from "anon";

revoke update on table "public"."helpdesk_tickets" from "anon";

revoke delete on table "public"."helpdesk_tickets" from "authenticated";

revoke insert on table "public"."helpdesk_tickets" from "authenticated";

revoke references on table "public"."helpdesk_tickets" from "authenticated";

revoke select on table "public"."helpdesk_tickets" from "authenticated";

revoke trigger on table "public"."helpdesk_tickets" from "authenticated";

revoke truncate on table "public"."helpdesk_tickets" from "authenticated";

revoke update on table "public"."helpdesk_tickets" from "authenticated";

revoke delete on table "public"."helpdesk_tickets" from "service_role";

revoke insert on table "public"."helpdesk_tickets" from "service_role";

revoke references on table "public"."helpdesk_tickets" from "service_role";

revoke select on table "public"."helpdesk_tickets" from "service_role";

revoke trigger on table "public"."helpdesk_tickets" from "service_role";

revoke truncate on table "public"."helpdesk_tickets" from "service_role";

revoke update on table "public"."helpdesk_tickets" from "service_role";

revoke delete on table "public"."inventory_items" from "anon";

revoke insert on table "public"."inventory_items" from "anon";

revoke references on table "public"."inventory_items" from "anon";

revoke select on table "public"."inventory_items" from "anon";

revoke trigger on table "public"."inventory_items" from "anon";

revoke truncate on table "public"."inventory_items" from "anon";

revoke update on table "public"."inventory_items" from "anon";

revoke delete on table "public"."inventory_items" from "authenticated";

revoke insert on table "public"."inventory_items" from "authenticated";

revoke references on table "public"."inventory_items" from "authenticated";

revoke select on table "public"."inventory_items" from "authenticated";

revoke trigger on table "public"."inventory_items" from "authenticated";

revoke truncate on table "public"."inventory_items" from "authenticated";

revoke update on table "public"."inventory_items" from "authenticated";

revoke delete on table "public"."inventory_items" from "service_role";

revoke insert on table "public"."inventory_items" from "service_role";

revoke references on table "public"."inventory_items" from "service_role";

revoke select on table "public"."inventory_items" from "service_role";

revoke trigger on table "public"."inventory_items" from "service_role";

revoke truncate on table "public"."inventory_items" from "service_role";

revoke update on table "public"."inventory_items" from "service_role";

revoke delete on table "public"."ip_blocklist" from "anon";

revoke insert on table "public"."ip_blocklist" from "anon";

revoke references on table "public"."ip_blocklist" from "anon";

revoke select on table "public"."ip_blocklist" from "anon";

revoke trigger on table "public"."ip_blocklist" from "anon";

revoke truncate on table "public"."ip_blocklist" from "anon";

revoke update on table "public"."ip_blocklist" from "anon";

revoke delete on table "public"."ip_blocklist" from "authenticated";

revoke insert on table "public"."ip_blocklist" from "authenticated";

revoke references on table "public"."ip_blocklist" from "authenticated";

revoke select on table "public"."ip_blocklist" from "authenticated";

revoke trigger on table "public"."ip_blocklist" from "authenticated";

revoke truncate on table "public"."ip_blocklist" from "authenticated";

revoke update on table "public"."ip_blocklist" from "authenticated";

revoke delete on table "public"."ip_blocklist" from "service_role";

revoke insert on table "public"."ip_blocklist" from "service_role";

revoke references on table "public"."ip_blocklist" from "service_role";

revoke select on table "public"."ip_blocklist" from "service_role";

revoke trigger on table "public"."ip_blocklist" from "service_role";

revoke truncate on table "public"."ip_blocklist" from "service_role";

revoke update on table "public"."ip_blocklist" from "service_role";

revoke delete on table "public"."knowledge_base_documents" from "anon";

revoke insert on table "public"."knowledge_base_documents" from "anon";

revoke references on table "public"."knowledge_base_documents" from "anon";

revoke select on table "public"."knowledge_base_documents" from "anon";

revoke trigger on table "public"."knowledge_base_documents" from "anon";

revoke truncate on table "public"."knowledge_base_documents" from "anon";

revoke update on table "public"."knowledge_base_documents" from "anon";

revoke delete on table "public"."knowledge_base_documents" from "authenticated";

revoke insert on table "public"."knowledge_base_documents" from "authenticated";

revoke references on table "public"."knowledge_base_documents" from "authenticated";

revoke select on table "public"."knowledge_base_documents" from "authenticated";

revoke trigger on table "public"."knowledge_base_documents" from "authenticated";

revoke truncate on table "public"."knowledge_base_documents" from "authenticated";

revoke update on table "public"."knowledge_base_documents" from "authenticated";

revoke delete on table "public"."knowledge_base_documents" from "service_role";

revoke insert on table "public"."knowledge_base_documents" from "service_role";

revoke references on table "public"."knowledge_base_documents" from "service_role";

revoke select on table "public"."knowledge_base_documents" from "service_role";

revoke trigger on table "public"."knowledge_base_documents" from "service_role";

revoke truncate on table "public"."knowledge_base_documents" from "service_role";

revoke update on table "public"."knowledge_base_documents" from "service_role";

revoke delete on table "public"."knowledge_base_entries" from "anon";

revoke insert on table "public"."knowledge_base_entries" from "anon";

revoke references on table "public"."knowledge_base_entries" from "anon";

revoke select on table "public"."knowledge_base_entries" from "anon";

revoke trigger on table "public"."knowledge_base_entries" from "anon";

revoke truncate on table "public"."knowledge_base_entries" from "anon";

revoke update on table "public"."knowledge_base_entries" from "anon";

revoke delete on table "public"."knowledge_base_entries" from "authenticated";

revoke insert on table "public"."knowledge_base_entries" from "authenticated";

revoke references on table "public"."knowledge_base_entries" from "authenticated";

revoke select on table "public"."knowledge_base_entries" from "authenticated";

revoke trigger on table "public"."knowledge_base_entries" from "authenticated";

revoke truncate on table "public"."knowledge_base_entries" from "authenticated";

revoke update on table "public"."knowledge_base_entries" from "authenticated";

revoke delete on table "public"."knowledge_base_entries" from "service_role";

revoke insert on table "public"."knowledge_base_entries" from "service_role";

revoke references on table "public"."knowledge_base_entries" from "service_role";

revoke select on table "public"."knowledge_base_entries" from "service_role";

revoke trigger on table "public"."knowledge_base_entries" from "service_role";

revoke truncate on table "public"."knowledge_base_entries" from "service_role";

revoke update on table "public"."knowledge_base_entries" from "service_role";

revoke delete on table "public"."knowledge_base_performance" from "anon";

revoke insert on table "public"."knowledge_base_performance" from "anon";

revoke references on table "public"."knowledge_base_performance" from "anon";

revoke select on table "public"."knowledge_base_performance" from "anon";

revoke trigger on table "public"."knowledge_base_performance" from "anon";

revoke truncate on table "public"."knowledge_base_performance" from "anon";

revoke update on table "public"."knowledge_base_performance" from "anon";

revoke delete on table "public"."knowledge_base_performance" from "authenticated";

revoke insert on table "public"."knowledge_base_performance" from "authenticated";

revoke references on table "public"."knowledge_base_performance" from "authenticated";

revoke select on table "public"."knowledge_base_performance" from "authenticated";

revoke trigger on table "public"."knowledge_base_performance" from "authenticated";

revoke truncate on table "public"."knowledge_base_performance" from "authenticated";

revoke update on table "public"."knowledge_base_performance" from "authenticated";

revoke delete on table "public"."knowledge_base_performance" from "service_role";

revoke insert on table "public"."knowledge_base_performance" from "service_role";

revoke references on table "public"."knowledge_base_performance" from "service_role";

revoke select on table "public"."knowledge_base_performance" from "service_role";

revoke trigger on table "public"."knowledge_base_performance" from "service_role";

revoke truncate on table "public"."knowledge_base_performance" from "service_role";

revoke update on table "public"."knowledge_base_performance" from "service_role";

revoke delete on table "public"."knowledge_base_versions" from "anon";

revoke insert on table "public"."knowledge_base_versions" from "anon";

revoke references on table "public"."knowledge_base_versions" from "anon";

revoke select on table "public"."knowledge_base_versions" from "anon";

revoke trigger on table "public"."knowledge_base_versions" from "anon";

revoke truncate on table "public"."knowledge_base_versions" from "anon";

revoke update on table "public"."knowledge_base_versions" from "anon";

revoke delete on table "public"."knowledge_base_versions" from "authenticated";

revoke insert on table "public"."knowledge_base_versions" from "authenticated";

revoke references on table "public"."knowledge_base_versions" from "authenticated";

revoke select on table "public"."knowledge_base_versions" from "authenticated";

revoke trigger on table "public"."knowledge_base_versions" from "authenticated";

revoke truncate on table "public"."knowledge_base_versions" from "authenticated";

revoke update on table "public"."knowledge_base_versions" from "authenticated";

revoke delete on table "public"."knowledge_base_versions" from "service_role";

revoke insert on table "public"."knowledge_base_versions" from "service_role";

revoke references on table "public"."knowledge_base_versions" from "service_role";

revoke select on table "public"."knowledge_base_versions" from "service_role";

revoke trigger on table "public"."knowledge_base_versions" from "service_role";

revoke truncate on table "public"."knowledge_base_versions" from "service_role";

revoke update on table "public"."knowledge_base_versions" from "service_role";

revoke delete on table "public"."lead_engagement_profiles" from "anon";

revoke insert on table "public"."lead_engagement_profiles" from "anon";

revoke references on table "public"."lead_engagement_profiles" from "anon";

revoke select on table "public"."lead_engagement_profiles" from "anon";

revoke trigger on table "public"."lead_engagement_profiles" from "anon";

revoke truncate on table "public"."lead_engagement_profiles" from "anon";

revoke update on table "public"."lead_engagement_profiles" from "anon";

revoke delete on table "public"."lead_engagement_profiles" from "authenticated";

revoke insert on table "public"."lead_engagement_profiles" from "authenticated";

revoke references on table "public"."lead_engagement_profiles" from "authenticated";

revoke select on table "public"."lead_engagement_profiles" from "authenticated";

revoke trigger on table "public"."lead_engagement_profiles" from "authenticated";

revoke truncate on table "public"."lead_engagement_profiles" from "authenticated";

revoke update on table "public"."lead_engagement_profiles" from "authenticated";

revoke delete on table "public"."lead_engagement_profiles" from "service_role";

revoke insert on table "public"."lead_engagement_profiles" from "service_role";

revoke references on table "public"."lead_engagement_profiles" from "service_role";

revoke select on table "public"."lead_engagement_profiles" from "service_role";

revoke trigger on table "public"."lead_engagement_profiles" from "service_role";

revoke truncate on table "public"."lead_engagement_profiles" from "service_role";

revoke update on table "public"."lead_engagement_profiles" from "service_role";

revoke delete on table "public"."lead_offerings" from "anon";

revoke insert on table "public"."lead_offerings" from "anon";

revoke references on table "public"."lead_offerings" from "anon";

revoke select on table "public"."lead_offerings" from "anon";

revoke trigger on table "public"."lead_offerings" from "anon";

revoke truncate on table "public"."lead_offerings" from "anon";

revoke update on table "public"."lead_offerings" from "anon";

revoke delete on table "public"."lead_offerings" from "authenticated";

revoke insert on table "public"."lead_offerings" from "authenticated";

revoke references on table "public"."lead_offerings" from "authenticated";

revoke select on table "public"."lead_offerings" from "authenticated";

revoke trigger on table "public"."lead_offerings" from "authenticated";

revoke truncate on table "public"."lead_offerings" from "authenticated";

revoke update on table "public"."lead_offerings" from "authenticated";

revoke delete on table "public"."lead_offerings" from "service_role";

revoke insert on table "public"."lead_offerings" from "service_role";

revoke references on table "public"."lead_offerings" from "service_role";

revoke select on table "public"."lead_offerings" from "service_role";

revoke trigger on table "public"."lead_offerings" from "service_role";

revoke truncate on table "public"."lead_offerings" from "service_role";

revoke update on table "public"."lead_offerings" from "service_role";

revoke delete on table "public"."lead_qualification_scores" from "anon";

revoke insert on table "public"."lead_qualification_scores" from "anon";

revoke references on table "public"."lead_qualification_scores" from "anon";

revoke select on table "public"."lead_qualification_scores" from "anon";

revoke trigger on table "public"."lead_qualification_scores" from "anon";

revoke truncate on table "public"."lead_qualification_scores" from "anon";

revoke update on table "public"."lead_qualification_scores" from "anon";

revoke delete on table "public"."lead_qualification_scores" from "authenticated";

revoke insert on table "public"."lead_qualification_scores" from "authenticated";

revoke references on table "public"."lead_qualification_scores" from "authenticated";

revoke select on table "public"."lead_qualification_scores" from "authenticated";

revoke trigger on table "public"."lead_qualification_scores" from "authenticated";

revoke truncate on table "public"."lead_qualification_scores" from "authenticated";

revoke update on table "public"."lead_qualification_scores" from "authenticated";

revoke delete on table "public"."lead_qualification_scores" from "service_role";

revoke insert on table "public"."lead_qualification_scores" from "service_role";

revoke references on table "public"."lead_qualification_scores" from "service_role";

revoke select on table "public"."lead_qualification_scores" from "service_role";

revoke trigger on table "public"."lead_qualification_scores" from "service_role";

revoke truncate on table "public"."lead_qualification_scores" from "service_role";

revoke update on table "public"."lead_qualification_scores" from "service_role";

revoke delete on table "public"."leads" from "anon";

revoke insert on table "public"."leads" from "anon";

revoke references on table "public"."leads" from "anon";

revoke select on table "public"."leads" from "anon";

revoke trigger on table "public"."leads" from "anon";

revoke truncate on table "public"."leads" from "anon";

revoke update on table "public"."leads" from "anon";

revoke delete on table "public"."leads" from "authenticated";

revoke insert on table "public"."leads" from "authenticated";

revoke references on table "public"."leads" from "authenticated";

revoke select on table "public"."leads" from "authenticated";

revoke trigger on table "public"."leads" from "authenticated";

revoke truncate on table "public"."leads" from "authenticated";

revoke update on table "public"."leads" from "authenticated";

revoke delete on table "public"."leads" from "service_role";

revoke insert on table "public"."leads" from "service_role";

revoke references on table "public"."leads" from "service_role";

revoke select on table "public"."leads" from "service_role";

revoke trigger on table "public"."leads" from "service_role";

revoke truncate on table "public"."leads" from "service_role";

revoke update on table "public"."leads" from "service_role";

revoke delete on table "public"."login_attempts" from "anon";

revoke insert on table "public"."login_attempts" from "anon";

revoke references on table "public"."login_attempts" from "anon";

revoke select on table "public"."login_attempts" from "anon";

revoke trigger on table "public"."login_attempts" from "anon";

revoke truncate on table "public"."login_attempts" from "anon";

revoke update on table "public"."login_attempts" from "anon";

revoke delete on table "public"."login_attempts" from "authenticated";

revoke insert on table "public"."login_attempts" from "authenticated";

revoke references on table "public"."login_attempts" from "authenticated";

revoke select on table "public"."login_attempts" from "authenticated";

revoke trigger on table "public"."login_attempts" from "authenticated";

revoke truncate on table "public"."login_attempts" from "authenticated";

revoke update on table "public"."login_attempts" from "authenticated";

revoke delete on table "public"."login_attempts" from "service_role";

revoke insert on table "public"."login_attempts" from "service_role";

revoke references on table "public"."login_attempts" from "service_role";

revoke select on table "public"."login_attempts" from "service_role";

revoke trigger on table "public"."login_attempts" from "service_role";

revoke truncate on table "public"."login_attempts" from "service_role";

revoke update on table "public"."login_attempts" from "service_role";

revoke delete on table "public"."maintenance_blocks" from "anon";

revoke insert on table "public"."maintenance_blocks" from "anon";

revoke references on table "public"."maintenance_blocks" from "anon";

revoke select on table "public"."maintenance_blocks" from "anon";

revoke trigger on table "public"."maintenance_blocks" from "anon";

revoke truncate on table "public"."maintenance_blocks" from "anon";

revoke update on table "public"."maintenance_blocks" from "anon";

revoke delete on table "public"."maintenance_blocks" from "authenticated";

revoke insert on table "public"."maintenance_blocks" from "authenticated";

revoke references on table "public"."maintenance_blocks" from "authenticated";

revoke select on table "public"."maintenance_blocks" from "authenticated";

revoke trigger on table "public"."maintenance_blocks" from "authenticated";

revoke truncate on table "public"."maintenance_blocks" from "authenticated";

revoke update on table "public"."maintenance_blocks" from "authenticated";

revoke delete on table "public"."maintenance_blocks" from "service_role";

revoke insert on table "public"."maintenance_blocks" from "service_role";

revoke references on table "public"."maintenance_blocks" from "service_role";

revoke select on table "public"."maintenance_blocks" from "service_role";

revoke trigger on table "public"."maintenance_blocks" from "service_role";

revoke truncate on table "public"."maintenance_blocks" from "service_role";

revoke update on table "public"."maintenance_blocks" from "service_role";

revoke delete on table "public"."message_buffer" from "anon";

revoke insert on table "public"."message_buffer" from "anon";

revoke references on table "public"."message_buffer" from "anon";

revoke select on table "public"."message_buffer" from "anon";

revoke trigger on table "public"."message_buffer" from "anon";

revoke truncate on table "public"."message_buffer" from "anon";

revoke update on table "public"."message_buffer" from "anon";

revoke delete on table "public"."message_buffer" from "authenticated";

revoke insert on table "public"."message_buffer" from "authenticated";

revoke references on table "public"."message_buffer" from "authenticated";

revoke select on table "public"."message_buffer" from "authenticated";

revoke trigger on table "public"."message_buffer" from "authenticated";

revoke truncate on table "public"."message_buffer" from "authenticated";

revoke update on table "public"."message_buffer" from "authenticated";

revoke delete on table "public"."message_buffer" from "service_role";

revoke insert on table "public"."message_buffer" from "service_role";

revoke references on table "public"."message_buffer" from "service_role";

revoke select on table "public"."message_buffer" from "service_role";

revoke trigger on table "public"."message_buffer" from "service_role";

revoke truncate on table "public"."message_buffer" from "service_role";

revoke update on table "public"."message_buffer" from "service_role";

revoke delete on table "public"."message_reactions" from "anon";

revoke insert on table "public"."message_reactions" from "anon";

revoke references on table "public"."message_reactions" from "anon";

revoke select on table "public"."message_reactions" from "anon";

revoke trigger on table "public"."message_reactions" from "anon";

revoke truncate on table "public"."message_reactions" from "anon";

revoke update on table "public"."message_reactions" from "anon";

revoke delete on table "public"."message_reactions" from "authenticated";

revoke insert on table "public"."message_reactions" from "authenticated";

revoke references on table "public"."message_reactions" from "authenticated";

revoke select on table "public"."message_reactions" from "authenticated";

revoke trigger on table "public"."message_reactions" from "authenticated";

revoke truncate on table "public"."message_reactions" from "authenticated";

revoke update on table "public"."message_reactions" from "authenticated";

revoke delete on table "public"."message_reactions" from "service_role";

revoke insert on table "public"."message_reactions" from "service_role";

revoke references on table "public"."message_reactions" from "service_role";

revoke select on table "public"."message_reactions" from "service_role";

revoke trigger on table "public"."message_reactions" from "service_role";

revoke truncate on table "public"."message_reactions" from "service_role";

revoke update on table "public"."message_reactions" from "service_role";

revoke delete on table "public"."message_templates" from "anon";

revoke insert on table "public"."message_templates" from "anon";

revoke references on table "public"."message_templates" from "anon";

revoke select on table "public"."message_templates" from "anon";

revoke trigger on table "public"."message_templates" from "anon";

revoke truncate on table "public"."message_templates" from "anon";

revoke update on table "public"."message_templates" from "anon";

revoke delete on table "public"."message_templates" from "authenticated";

revoke insert on table "public"."message_templates" from "authenticated";

revoke references on table "public"."message_templates" from "authenticated";

revoke select on table "public"."message_templates" from "authenticated";

revoke trigger on table "public"."message_templates" from "authenticated";

revoke truncate on table "public"."message_templates" from "authenticated";

revoke update on table "public"."message_templates" from "authenticated";

revoke delete on table "public"."message_templates" from "service_role";

revoke insert on table "public"."message_templates" from "service_role";

revoke references on table "public"."message_templates" from "service_role";

revoke select on table "public"."message_templates" from "service_role";

revoke trigger on table "public"."message_templates" from "service_role";

revoke truncate on table "public"."message_templates" from "service_role";

revoke update on table "public"."message_templates" from "service_role";

revoke delete on table "public"."migration_logs" from "anon";

revoke insert on table "public"."migration_logs" from "anon";

revoke references on table "public"."migration_logs" from "anon";

revoke select on table "public"."migration_logs" from "anon";

revoke trigger on table "public"."migration_logs" from "anon";

revoke truncate on table "public"."migration_logs" from "anon";

revoke update on table "public"."migration_logs" from "anon";

revoke delete on table "public"."migration_logs" from "authenticated";

revoke insert on table "public"."migration_logs" from "authenticated";

revoke references on table "public"."migration_logs" from "authenticated";

revoke select on table "public"."migration_logs" from "authenticated";

revoke trigger on table "public"."migration_logs" from "authenticated";

revoke truncate on table "public"."migration_logs" from "authenticated";

revoke update on table "public"."migration_logs" from "authenticated";

revoke delete on table "public"."migration_logs" from "service_role";

revoke insert on table "public"."migration_logs" from "service_role";

revoke references on table "public"."migration_logs" from "service_role";

revoke select on table "public"."migration_logs" from "service_role";

revoke trigger on table "public"."migration_logs" from "service_role";

revoke truncate on table "public"."migration_logs" from "service_role";

revoke update on table "public"."migration_logs" from "service_role";

revoke delete on table "public"."notification_history" from "anon";

revoke insert on table "public"."notification_history" from "anon";

revoke references on table "public"."notification_history" from "anon";

revoke select on table "public"."notification_history" from "anon";

revoke trigger on table "public"."notification_history" from "anon";

revoke truncate on table "public"."notification_history" from "anon";

revoke update on table "public"."notification_history" from "anon";

revoke delete on table "public"."notification_history" from "authenticated";

revoke insert on table "public"."notification_history" from "authenticated";

revoke references on table "public"."notification_history" from "authenticated";

revoke select on table "public"."notification_history" from "authenticated";

revoke trigger on table "public"."notification_history" from "authenticated";

revoke truncate on table "public"."notification_history" from "authenticated";

revoke update on table "public"."notification_history" from "authenticated";

revoke delete on table "public"."notification_history" from "service_role";

revoke insert on table "public"."notification_history" from "service_role";

revoke references on table "public"."notification_history" from "service_role";

revoke select on table "public"."notification_history" from "service_role";

revoke trigger on table "public"."notification_history" from "service_role";

revoke truncate on table "public"."notification_history" from "service_role";

revoke update on table "public"."notification_history" from "service_role";

revoke delete on table "public"."notification_preferences" from "anon";

revoke insert on table "public"."notification_preferences" from "anon";

revoke references on table "public"."notification_preferences" from "anon";

revoke select on table "public"."notification_preferences" from "anon";

revoke trigger on table "public"."notification_preferences" from "anon";

revoke truncate on table "public"."notification_preferences" from "anon";

revoke update on table "public"."notification_preferences" from "anon";

revoke delete on table "public"."notification_preferences" from "authenticated";

revoke insert on table "public"."notification_preferences" from "authenticated";

revoke references on table "public"."notification_preferences" from "authenticated";

revoke select on table "public"."notification_preferences" from "authenticated";

revoke trigger on table "public"."notification_preferences" from "authenticated";

revoke truncate on table "public"."notification_preferences" from "authenticated";

revoke update on table "public"."notification_preferences" from "authenticated";

revoke delete on table "public"."notification_preferences" from "service_role";

revoke insert on table "public"."notification_preferences" from "service_role";

revoke references on table "public"."notification_preferences" from "service_role";

revoke select on table "public"."notification_preferences" from "service_role";

revoke trigger on table "public"."notification_preferences" from "service_role";

revoke truncate on table "public"."notification_preferences" from "service_role";

revoke update on table "public"."notification_preferences" from "service_role";

revoke delete on table "public"."offerings" from "anon";

revoke insert on table "public"."offerings" from "anon";

revoke references on table "public"."offerings" from "anon";

revoke select on table "public"."offerings" from "anon";

revoke trigger on table "public"."offerings" from "anon";

revoke truncate on table "public"."offerings" from "anon";

revoke update on table "public"."offerings" from "anon";

revoke delete on table "public"."offerings" from "authenticated";

revoke insert on table "public"."offerings" from "authenticated";

revoke references on table "public"."offerings" from "authenticated";

revoke select on table "public"."offerings" from "authenticated";

revoke trigger on table "public"."offerings" from "authenticated";

revoke truncate on table "public"."offerings" from "authenticated";

revoke update on table "public"."offerings" from "authenticated";

revoke delete on table "public"."offerings" from "service_role";

revoke insert on table "public"."offerings" from "service_role";

revoke references on table "public"."offerings" from "service_role";

revoke select on table "public"."offerings" from "service_role";

revoke trigger on table "public"."offerings" from "service_role";

revoke truncate on table "public"."offerings" from "service_role";

revoke update on table "public"."offerings" from "service_role";

revoke delete on table "public"."operational_expenses" from "anon";

revoke insert on table "public"."operational_expenses" from "anon";

revoke references on table "public"."operational_expenses" from "anon";

revoke select on table "public"."operational_expenses" from "anon";

revoke trigger on table "public"."operational_expenses" from "anon";

revoke truncate on table "public"."operational_expenses" from "anon";

revoke update on table "public"."operational_expenses" from "anon";

revoke delete on table "public"."operational_expenses" from "authenticated";

revoke insert on table "public"."operational_expenses" from "authenticated";

revoke references on table "public"."operational_expenses" from "authenticated";

revoke select on table "public"."operational_expenses" from "authenticated";

revoke trigger on table "public"."operational_expenses" from "authenticated";

revoke truncate on table "public"."operational_expenses" from "authenticated";

revoke update on table "public"."operational_expenses" from "authenticated";

revoke delete on table "public"."operational_expenses" from "service_role";

revoke insert on table "public"."operational_expenses" from "service_role";

revoke references on table "public"."operational_expenses" from "service_role";

revoke select on table "public"."operational_expenses" from "service_role";

revoke trigger on table "public"."operational_expenses" from "service_role";

revoke truncate on table "public"."operational_expenses" from "service_role";

revoke update on table "public"."operational_expenses" from "service_role";

revoke delete on table "public"."orders" from "anon";

revoke insert on table "public"."orders" from "anon";

revoke references on table "public"."orders" from "anon";

revoke select on table "public"."orders" from "anon";

revoke trigger on table "public"."orders" from "anon";

revoke truncate on table "public"."orders" from "anon";

revoke update on table "public"."orders" from "anon";

revoke delete on table "public"."orders" from "authenticated";

revoke insert on table "public"."orders" from "authenticated";

revoke references on table "public"."orders" from "authenticated";

revoke select on table "public"."orders" from "authenticated";

revoke trigger on table "public"."orders" from "authenticated";

revoke truncate on table "public"."orders" from "authenticated";

revoke update on table "public"."orders" from "authenticated";

revoke delete on table "public"."orders" from "service_role";

revoke insert on table "public"."orders" from "service_role";

revoke references on table "public"."orders" from "service_role";

revoke select on table "public"."orders" from "service_role";

revoke trigger on table "public"."orders" from "service_role";

revoke truncate on table "public"."orders" from "service_role";

revoke update on table "public"."orders" from "service_role";

revoke delete on table "public"."organizations" from "anon";

revoke insert on table "public"."organizations" from "anon";

revoke references on table "public"."organizations" from "anon";

revoke select on table "public"."organizations" from "anon";

revoke trigger on table "public"."organizations" from "anon";

revoke truncate on table "public"."organizations" from "anon";

revoke update on table "public"."organizations" from "anon";

revoke delete on table "public"."organizations" from "authenticated";

revoke insert on table "public"."organizations" from "authenticated";

revoke references on table "public"."organizations" from "authenticated";

revoke select on table "public"."organizations" from "authenticated";

revoke trigger on table "public"."organizations" from "authenticated";

revoke truncate on table "public"."organizations" from "authenticated";

revoke update on table "public"."organizations" from "authenticated";

revoke delete on table "public"."organizations" from "service_role";

revoke insert on table "public"."organizations" from "service_role";

revoke references on table "public"."organizations" from "service_role";

revoke select on table "public"."organizations" from "service_role";

revoke trigger on table "public"."organizations" from "service_role";

revoke truncate on table "public"."organizations" from "service_role";

revoke update on table "public"."organizations" from "service_role";

revoke delete on table "public"."permission_sets" from "anon";

revoke insert on table "public"."permission_sets" from "anon";

revoke references on table "public"."permission_sets" from "anon";

revoke select on table "public"."permission_sets" from "anon";

revoke trigger on table "public"."permission_sets" from "anon";

revoke truncate on table "public"."permission_sets" from "anon";

revoke update on table "public"."permission_sets" from "anon";

revoke delete on table "public"."permission_sets" from "authenticated";

revoke insert on table "public"."permission_sets" from "authenticated";

revoke references on table "public"."permission_sets" from "authenticated";

revoke select on table "public"."permission_sets" from "authenticated";

revoke trigger on table "public"."permission_sets" from "authenticated";

revoke truncate on table "public"."permission_sets" from "authenticated";

revoke update on table "public"."permission_sets" from "authenticated";

revoke delete on table "public"."permission_sets" from "service_role";

revoke insert on table "public"."permission_sets" from "service_role";

revoke references on table "public"."permission_sets" from "service_role";

revoke select on table "public"."permission_sets" from "service_role";

revoke trigger on table "public"."permission_sets" from "service_role";

revoke truncate on table "public"."permission_sets" from "service_role";

revoke update on table "public"."permission_sets" from "service_role";

revoke delete on table "public"."phone_numbers" from "anon";

revoke insert on table "public"."phone_numbers" from "anon";

revoke references on table "public"."phone_numbers" from "anon";

revoke select on table "public"."phone_numbers" from "anon";

revoke trigger on table "public"."phone_numbers" from "anon";

revoke truncate on table "public"."phone_numbers" from "anon";

revoke update on table "public"."phone_numbers" from "anon";

revoke delete on table "public"."phone_numbers" from "authenticated";

revoke insert on table "public"."phone_numbers" from "authenticated";

revoke references on table "public"."phone_numbers" from "authenticated";

revoke select on table "public"."phone_numbers" from "authenticated";

revoke trigger on table "public"."phone_numbers" from "authenticated";

revoke truncate on table "public"."phone_numbers" from "authenticated";

revoke update on table "public"."phone_numbers" from "authenticated";

revoke delete on table "public"."phone_numbers" from "service_role";

revoke insert on table "public"."phone_numbers" from "service_role";

revoke references on table "public"."phone_numbers" from "service_role";

revoke select on table "public"."phone_numbers" from "service_role";

revoke trigger on table "public"."phone_numbers" from "service_role";

revoke truncate on table "public"."phone_numbers" from "service_role";

revoke update on table "public"."phone_numbers" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."properties" from "anon";

revoke insert on table "public"."properties" from "anon";

revoke references on table "public"."properties" from "anon";

revoke select on table "public"."properties" from "anon";

revoke trigger on table "public"."properties" from "anon";

revoke truncate on table "public"."properties" from "anon";

revoke update on table "public"."properties" from "anon";

revoke delete on table "public"."properties" from "authenticated";

revoke insert on table "public"."properties" from "authenticated";

revoke references on table "public"."properties" from "authenticated";

revoke select on table "public"."properties" from "authenticated";

revoke trigger on table "public"."properties" from "authenticated";

revoke truncate on table "public"."properties" from "authenticated";

revoke update on table "public"."properties" from "authenticated";

revoke delete on table "public"."properties" from "service_role";

revoke insert on table "public"."properties" from "service_role";

revoke references on table "public"."properties" from "service_role";

revoke select on table "public"."properties" from "service_role";

revoke trigger on table "public"."properties" from "service_role";

revoke truncate on table "public"."properties" from "service_role";

revoke update on table "public"."properties" from "service_role";

revoke delete on table "public"."qualification_events" from "anon";

revoke insert on table "public"."qualification_events" from "anon";

revoke references on table "public"."qualification_events" from "anon";

revoke select on table "public"."qualification_events" from "anon";

revoke trigger on table "public"."qualification_events" from "anon";

revoke truncate on table "public"."qualification_events" from "anon";

revoke update on table "public"."qualification_events" from "anon";

revoke delete on table "public"."qualification_events" from "authenticated";

revoke insert on table "public"."qualification_events" from "authenticated";

revoke references on table "public"."qualification_events" from "authenticated";

revoke select on table "public"."qualification_events" from "authenticated";

revoke trigger on table "public"."qualification_events" from "authenticated";

revoke truncate on table "public"."qualification_events" from "authenticated";

revoke update on table "public"."qualification_events" from "authenticated";

revoke delete on table "public"."qualification_events" from "service_role";

revoke insert on table "public"."qualification_events" from "service_role";

revoke references on table "public"."qualification_events" from "service_role";

revoke select on table "public"."qualification_events" from "service_role";

revoke trigger on table "public"."qualification_events" from "service_role";

revoke truncate on table "public"."qualification_events" from "service_role";

revoke update on table "public"."qualification_events" from "service_role";

revoke delete on table "public"."rate_limits" from "anon";

revoke insert on table "public"."rate_limits" from "anon";

revoke references on table "public"."rate_limits" from "anon";

revoke select on table "public"."rate_limits" from "anon";

revoke trigger on table "public"."rate_limits" from "anon";

revoke truncate on table "public"."rate_limits" from "anon";

revoke update on table "public"."rate_limits" from "anon";

revoke delete on table "public"."rate_limits" from "authenticated";

revoke insert on table "public"."rate_limits" from "authenticated";

revoke references on table "public"."rate_limits" from "authenticated";

revoke select on table "public"."rate_limits" from "authenticated";

revoke trigger on table "public"."rate_limits" from "authenticated";

revoke truncate on table "public"."rate_limits" from "authenticated";

revoke update on table "public"."rate_limits" from "authenticated";

revoke delete on table "public"."rate_limits" from "service_role";

revoke insert on table "public"."rate_limits" from "service_role";

revoke references on table "public"."rate_limits" from "service_role";

revoke select on table "public"."rate_limits" from "service_role";

revoke trigger on table "public"."rate_limits" from "service_role";

revoke truncate on table "public"."rate_limits" from "service_role";

revoke update on table "public"."rate_limits" from "service_role";

revoke delete on table "public"."re_engagement_campaigns" from "anon";

revoke insert on table "public"."re_engagement_campaigns" from "anon";

revoke references on table "public"."re_engagement_campaigns" from "anon";

revoke select on table "public"."re_engagement_campaigns" from "anon";

revoke trigger on table "public"."re_engagement_campaigns" from "anon";

revoke truncate on table "public"."re_engagement_campaigns" from "anon";

revoke update on table "public"."re_engagement_campaigns" from "anon";

revoke delete on table "public"."re_engagement_campaigns" from "authenticated";

revoke insert on table "public"."re_engagement_campaigns" from "authenticated";

revoke references on table "public"."re_engagement_campaigns" from "authenticated";

revoke select on table "public"."re_engagement_campaigns" from "authenticated";

revoke trigger on table "public"."re_engagement_campaigns" from "authenticated";

revoke truncate on table "public"."re_engagement_campaigns" from "authenticated";

revoke update on table "public"."re_engagement_campaigns" from "authenticated";

revoke delete on table "public"."re_engagement_campaigns" from "service_role";

revoke insert on table "public"."re_engagement_campaigns" from "service_role";

revoke references on table "public"."re_engagement_campaigns" from "service_role";

revoke select on table "public"."re_engagement_campaigns" from "service_role";

revoke trigger on table "public"."re_engagement_campaigns" from "service_role";

revoke truncate on table "public"."re_engagement_campaigns" from "service_role";

revoke update on table "public"."re_engagement_campaigns" from "service_role";

revoke delete on table "public"."re_engagement_templates" from "anon";

revoke insert on table "public"."re_engagement_templates" from "anon";

revoke references on table "public"."re_engagement_templates" from "anon";

revoke select on table "public"."re_engagement_templates" from "anon";

revoke trigger on table "public"."re_engagement_templates" from "anon";

revoke truncate on table "public"."re_engagement_templates" from "anon";

revoke update on table "public"."re_engagement_templates" from "anon";

revoke delete on table "public"."re_engagement_templates" from "authenticated";

revoke insert on table "public"."re_engagement_templates" from "authenticated";

revoke references on table "public"."re_engagement_templates" from "authenticated";

revoke select on table "public"."re_engagement_templates" from "authenticated";

revoke trigger on table "public"."re_engagement_templates" from "authenticated";

revoke truncate on table "public"."re_engagement_templates" from "authenticated";

revoke update on table "public"."re_engagement_templates" from "authenticated";

revoke delete on table "public"."re_engagement_templates" from "service_role";

revoke insert on table "public"."re_engagement_templates" from "service_role";

revoke references on table "public"."re_engagement_templates" from "service_role";

revoke select on table "public"."re_engagement_templates" from "service_role";

revoke trigger on table "public"."re_engagement_templates" from "service_role";

revoke truncate on table "public"."re_engagement_templates" from "service_role";

revoke update on table "public"."re_engagement_templates" from "service_role";

revoke delete on table "public"."reports" from "anon";

revoke insert on table "public"."reports" from "anon";

revoke references on table "public"."reports" from "anon";

revoke select on table "public"."reports" from "anon";

revoke trigger on table "public"."reports" from "anon";

revoke truncate on table "public"."reports" from "anon";

revoke update on table "public"."reports" from "anon";

revoke delete on table "public"."reports" from "authenticated";

revoke insert on table "public"."reports" from "authenticated";

revoke references on table "public"."reports" from "authenticated";

revoke select on table "public"."reports" from "authenticated";

revoke trigger on table "public"."reports" from "authenticated";

revoke truncate on table "public"."reports" from "authenticated";

revoke update on table "public"."reports" from "authenticated";

revoke delete on table "public"."reports" from "service_role";

revoke insert on table "public"."reports" from "service_role";

revoke references on table "public"."reports" from "service_role";

revoke select on table "public"."reports" from "service_role";

revoke trigger on table "public"."reports" from "service_role";

revoke truncate on table "public"."reports" from "service_role";

revoke update on table "public"."reports" from "service_role";

revoke delete on table "public"."room_units" from "anon";

revoke insert on table "public"."room_units" from "anon";

revoke references on table "public"."room_units" from "anon";

revoke select on table "public"."room_units" from "anon";

revoke trigger on table "public"."room_units" from "anon";

revoke truncate on table "public"."room_units" from "anon";

revoke update on table "public"."room_units" from "anon";

revoke delete on table "public"."room_units" from "authenticated";

revoke insert on table "public"."room_units" from "authenticated";

revoke references on table "public"."room_units" from "authenticated";

revoke select on table "public"."room_units" from "authenticated";

revoke trigger on table "public"."room_units" from "authenticated";

revoke truncate on table "public"."room_units" from "authenticated";

revoke update on table "public"."room_units" from "authenticated";

revoke delete on table "public"."room_units" from "service_role";

revoke insert on table "public"."room_units" from "service_role";

revoke references on table "public"."room_units" from "service_role";

revoke select on table "public"."room_units" from "service_role";

revoke trigger on table "public"."room_units" from "service_role";

revoke truncate on table "public"."room_units" from "service_role";

revoke update on table "public"."room_units" from "service_role";

revoke delete on table "public"."rubric_templates" from "anon";

revoke insert on table "public"."rubric_templates" from "anon";

revoke references on table "public"."rubric_templates" from "anon";

revoke select on table "public"."rubric_templates" from "anon";

revoke trigger on table "public"."rubric_templates" from "anon";

revoke truncate on table "public"."rubric_templates" from "anon";

revoke update on table "public"."rubric_templates" from "anon";

revoke delete on table "public"."rubric_templates" from "authenticated";

revoke insert on table "public"."rubric_templates" from "authenticated";

revoke references on table "public"."rubric_templates" from "authenticated";

revoke select on table "public"."rubric_templates" from "authenticated";

revoke trigger on table "public"."rubric_templates" from "authenticated";

revoke truncate on table "public"."rubric_templates" from "authenticated";

revoke update on table "public"."rubric_templates" from "authenticated";

revoke delete on table "public"."rubric_templates" from "service_role";

revoke insert on table "public"."rubric_templates" from "service_role";

revoke references on table "public"."rubric_templates" from "service_role";

revoke select on table "public"."rubric_templates" from "service_role";

revoke trigger on table "public"."rubric_templates" from "service_role";

revoke truncate on table "public"."rubric_templates" from "service_role";

revoke update on table "public"."rubric_templates" from "service_role";

revoke delete on table "public"."secret_rotation_tracking" from "anon";

revoke insert on table "public"."secret_rotation_tracking" from "anon";

revoke references on table "public"."secret_rotation_tracking" from "anon";

revoke select on table "public"."secret_rotation_tracking" from "anon";

revoke trigger on table "public"."secret_rotation_tracking" from "anon";

revoke truncate on table "public"."secret_rotation_tracking" from "anon";

revoke update on table "public"."secret_rotation_tracking" from "anon";

revoke delete on table "public"."secret_rotation_tracking" from "authenticated";

revoke insert on table "public"."secret_rotation_tracking" from "authenticated";

revoke references on table "public"."secret_rotation_tracking" from "authenticated";

revoke select on table "public"."secret_rotation_tracking" from "authenticated";

revoke trigger on table "public"."secret_rotation_tracking" from "authenticated";

revoke truncate on table "public"."secret_rotation_tracking" from "authenticated";

revoke update on table "public"."secret_rotation_tracking" from "authenticated";

revoke delete on table "public"."secret_rotation_tracking" from "service_role";

revoke insert on table "public"."secret_rotation_tracking" from "service_role";

revoke references on table "public"."secret_rotation_tracking" from "service_role";

revoke select on table "public"."secret_rotation_tracking" from "service_role";

revoke trigger on table "public"."secret_rotation_tracking" from "service_role";

revoke truncate on table "public"."secret_rotation_tracking" from "service_role";

revoke update on table "public"."secret_rotation_tracking" from "service_role";

revoke delete on table "public"."social_platforms" from "anon";

revoke insert on table "public"."social_platforms" from "anon";

revoke references on table "public"."social_platforms" from "anon";

revoke select on table "public"."social_platforms" from "anon";

revoke trigger on table "public"."social_platforms" from "anon";

revoke truncate on table "public"."social_platforms" from "anon";

revoke update on table "public"."social_platforms" from "anon";

revoke delete on table "public"."social_platforms" from "authenticated";

revoke insert on table "public"."social_platforms" from "authenticated";

revoke references on table "public"."social_platforms" from "authenticated";

revoke select on table "public"."social_platforms" from "authenticated";

revoke trigger on table "public"."social_platforms" from "authenticated";

revoke truncate on table "public"."social_platforms" from "authenticated";

revoke update on table "public"."social_platforms" from "authenticated";

revoke delete on table "public"."social_platforms" from "service_role";

revoke insert on table "public"."social_platforms" from "service_role";

revoke references on table "public"."social_platforms" from "service_role";

revoke select on table "public"."social_platforms" from "service_role";

revoke trigger on table "public"."social_platforms" from "service_role";

revoke truncate on table "public"."social_platforms" from "service_role";

revoke update on table "public"."social_platforms" from "service_role";

revoke delete on table "public"."team_chat_members" from "anon";

revoke insert on table "public"."team_chat_members" from "anon";

revoke references on table "public"."team_chat_members" from "anon";

revoke select on table "public"."team_chat_members" from "anon";

revoke trigger on table "public"."team_chat_members" from "anon";

revoke truncate on table "public"."team_chat_members" from "anon";

revoke update on table "public"."team_chat_members" from "anon";

revoke delete on table "public"."team_chat_members" from "authenticated";

revoke insert on table "public"."team_chat_members" from "authenticated";

revoke references on table "public"."team_chat_members" from "authenticated";

revoke select on table "public"."team_chat_members" from "authenticated";

revoke trigger on table "public"."team_chat_members" from "authenticated";

revoke truncate on table "public"."team_chat_members" from "authenticated";

revoke update on table "public"."team_chat_members" from "authenticated";

revoke delete on table "public"."team_chat_members" from "service_role";

revoke insert on table "public"."team_chat_members" from "service_role";

revoke references on table "public"."team_chat_members" from "service_role";

revoke select on table "public"."team_chat_members" from "service_role";

revoke trigger on table "public"."team_chat_members" from "service_role";

revoke truncate on table "public"."team_chat_members" from "service_role";

revoke update on table "public"."team_chat_members" from "service_role";

revoke delete on table "public"."team_chat_messages" from "anon";

revoke insert on table "public"."team_chat_messages" from "anon";

revoke references on table "public"."team_chat_messages" from "anon";

revoke select on table "public"."team_chat_messages" from "anon";

revoke trigger on table "public"."team_chat_messages" from "anon";

revoke truncate on table "public"."team_chat_messages" from "anon";

revoke update on table "public"."team_chat_messages" from "anon";

revoke delete on table "public"."team_chat_messages" from "authenticated";

revoke insert on table "public"."team_chat_messages" from "authenticated";

revoke references on table "public"."team_chat_messages" from "authenticated";

revoke select on table "public"."team_chat_messages" from "authenticated";

revoke trigger on table "public"."team_chat_messages" from "authenticated";

revoke truncate on table "public"."team_chat_messages" from "authenticated";

revoke update on table "public"."team_chat_messages" from "authenticated";

revoke delete on table "public"."team_chat_messages" from "service_role";

revoke insert on table "public"."team_chat_messages" from "service_role";

revoke references on table "public"."team_chat_messages" from "service_role";

revoke select on table "public"."team_chat_messages" from "service_role";

revoke trigger on table "public"."team_chat_messages" from "service_role";

revoke truncate on table "public"."team_chat_messages" from "service_role";

revoke update on table "public"."team_chat_messages" from "service_role";

revoke delete on table "public"."team_chat_reactions" from "anon";

revoke insert on table "public"."team_chat_reactions" from "anon";

revoke references on table "public"."team_chat_reactions" from "anon";

revoke select on table "public"."team_chat_reactions" from "anon";

revoke trigger on table "public"."team_chat_reactions" from "anon";

revoke truncate on table "public"."team_chat_reactions" from "anon";

revoke update on table "public"."team_chat_reactions" from "anon";

revoke delete on table "public"."team_chat_reactions" from "authenticated";

revoke insert on table "public"."team_chat_reactions" from "authenticated";

revoke references on table "public"."team_chat_reactions" from "authenticated";

revoke select on table "public"."team_chat_reactions" from "authenticated";

revoke trigger on table "public"."team_chat_reactions" from "authenticated";

revoke truncate on table "public"."team_chat_reactions" from "authenticated";

revoke update on table "public"."team_chat_reactions" from "authenticated";

revoke delete on table "public"."team_chat_reactions" from "service_role";

revoke insert on table "public"."team_chat_reactions" from "service_role";

revoke references on table "public"."team_chat_reactions" from "service_role";

revoke select on table "public"."team_chat_reactions" from "service_role";

revoke trigger on table "public"."team_chat_reactions" from "service_role";

revoke truncate on table "public"."team_chat_reactions" from "service_role";

revoke update on table "public"."team_chat_reactions" from "service_role";

revoke delete on table "public"."team_chats" from "anon";

revoke insert on table "public"."team_chats" from "anon";

revoke references on table "public"."team_chats" from "anon";

revoke select on table "public"."team_chats" from "anon";

revoke trigger on table "public"."team_chats" from "anon";

revoke truncate on table "public"."team_chats" from "anon";

revoke update on table "public"."team_chats" from "anon";

revoke delete on table "public"."team_chats" from "authenticated";

revoke insert on table "public"."team_chats" from "authenticated";

revoke references on table "public"."team_chats" from "authenticated";

revoke select on table "public"."team_chats" from "authenticated";

revoke trigger on table "public"."team_chats" from "authenticated";

revoke truncate on table "public"."team_chats" from "authenticated";

revoke update on table "public"."team_chats" from "authenticated";

revoke delete on table "public"."team_chats" from "service_role";

revoke insert on table "public"."team_chats" from "service_role";

revoke references on table "public"."team_chats" from "service_role";

revoke select on table "public"."team_chats" from "service_role";

revoke trigger on table "public"."team_chats" from "service_role";

revoke truncate on table "public"."team_chats" from "service_role";

revoke update on table "public"."team_chats" from "service_role";

revoke delete on table "public"."team_members" from "anon";

revoke insert on table "public"."team_members" from "anon";

revoke references on table "public"."team_members" from "anon";

revoke select on table "public"."team_members" from "anon";

revoke trigger on table "public"."team_members" from "anon";

revoke truncate on table "public"."team_members" from "anon";

revoke update on table "public"."team_members" from "anon";

revoke delete on table "public"."team_members" from "authenticated";

revoke insert on table "public"."team_members" from "authenticated";

revoke references on table "public"."team_members" from "authenticated";

revoke select on table "public"."team_members" from "authenticated";

revoke trigger on table "public"."team_members" from "authenticated";

revoke truncate on table "public"."team_members" from "authenticated";

revoke update on table "public"."team_members" from "authenticated";

revoke delete on table "public"."team_members" from "service_role";

revoke insert on table "public"."team_members" from "service_role";

revoke references on table "public"."team_members" from "service_role";

revoke select on table "public"."team_members" from "service_role";

revoke trigger on table "public"."team_members" from "service_role";

revoke truncate on table "public"."team_members" from "service_role";

revoke update on table "public"."team_members" from "service_role";

revoke delete on table "public"."teams" from "anon";

revoke insert on table "public"."teams" from "anon";

revoke references on table "public"."teams" from "anon";

revoke select on table "public"."teams" from "anon";

revoke trigger on table "public"."teams" from "anon";

revoke truncate on table "public"."teams" from "anon";

revoke update on table "public"."teams" from "anon";

revoke delete on table "public"."teams" from "authenticated";

revoke insert on table "public"."teams" from "authenticated";

revoke references on table "public"."teams" from "authenticated";

revoke select on table "public"."teams" from "authenticated";

revoke trigger on table "public"."teams" from "authenticated";

revoke truncate on table "public"."teams" from "authenticated";

revoke update on table "public"."teams" from "authenticated";

revoke delete on table "public"."teams" from "service_role";

revoke insert on table "public"."teams" from "service_role";

revoke references on table "public"."teams" from "service_role";

revoke select on table "public"."teams" from "service_role";

revoke trigger on table "public"."teams" from "service_role";

revoke truncate on table "public"."teams" from "service_role";

revoke update on table "public"."teams" from "service_role";

revoke delete on table "public"."training_modules" from "anon";

revoke insert on table "public"."training_modules" from "anon";

revoke references on table "public"."training_modules" from "anon";

revoke select on table "public"."training_modules" from "anon";

revoke trigger on table "public"."training_modules" from "anon";

revoke truncate on table "public"."training_modules" from "anon";

revoke update on table "public"."training_modules" from "anon";

revoke delete on table "public"."training_modules" from "authenticated";

revoke insert on table "public"."training_modules" from "authenticated";

revoke references on table "public"."training_modules" from "authenticated";

revoke select on table "public"."training_modules" from "authenticated";

revoke trigger on table "public"."training_modules" from "authenticated";

revoke truncate on table "public"."training_modules" from "authenticated";

revoke update on table "public"."training_modules" from "authenticated";

revoke delete on table "public"."training_modules" from "service_role";

revoke insert on table "public"."training_modules" from "service_role";

revoke references on table "public"."training_modules" from "service_role";

revoke select on table "public"."training_modules" from "service_role";

revoke trigger on table "public"."training_modules" from "service_role";

revoke truncate on table "public"."training_modules" from "service_role";

revoke update on table "public"."training_modules" from "service_role";

revoke delete on table "public"."training_sessions" from "anon";

revoke insert on table "public"."training_sessions" from "anon";

revoke references on table "public"."training_sessions" from "anon";

revoke select on table "public"."training_sessions" from "anon";

revoke trigger on table "public"."training_sessions" from "anon";

revoke truncate on table "public"."training_sessions" from "anon";

revoke update on table "public"."training_sessions" from "anon";

revoke delete on table "public"."training_sessions" from "authenticated";

revoke insert on table "public"."training_sessions" from "authenticated";

revoke references on table "public"."training_sessions" from "authenticated";

revoke select on table "public"."training_sessions" from "authenticated";

revoke trigger on table "public"."training_sessions" from "authenticated";

revoke truncate on table "public"."training_sessions" from "authenticated";

revoke update on table "public"."training_sessions" from "authenticated";

revoke delete on table "public"."training_sessions" from "service_role";

revoke insert on table "public"."training_sessions" from "service_role";

revoke references on table "public"."training_sessions" from "service_role";

revoke select on table "public"."training_sessions" from "service_role";

revoke trigger on table "public"."training_sessions" from "service_role";

revoke truncate on table "public"."training_sessions" from "service_role";

revoke update on table "public"."training_sessions" from "service_role";

revoke delete on table "public"."user_permissions" from "anon";

revoke insert on table "public"."user_permissions" from "anon";

revoke references on table "public"."user_permissions" from "anon";

revoke select on table "public"."user_permissions" from "anon";

revoke trigger on table "public"."user_permissions" from "anon";

revoke truncate on table "public"."user_permissions" from "anon";

revoke update on table "public"."user_permissions" from "anon";

revoke delete on table "public"."user_permissions" from "authenticated";

revoke insert on table "public"."user_permissions" from "authenticated";

revoke references on table "public"."user_permissions" from "authenticated";

revoke select on table "public"."user_permissions" from "authenticated";

revoke trigger on table "public"."user_permissions" from "authenticated";

revoke truncate on table "public"."user_permissions" from "authenticated";

revoke update on table "public"."user_permissions" from "authenticated";

revoke delete on table "public"."user_permissions" from "service_role";

revoke insert on table "public"."user_permissions" from "service_role";

revoke references on table "public"."user_permissions" from "service_role";

revoke select on table "public"."user_permissions" from "service_role";

revoke trigger on table "public"."user_permissions" from "service_role";

revoke truncate on table "public"."user_permissions" from "service_role";

revoke update on table "public"."user_permissions" from "service_role";

revoke delete on table "public"."user_role_audit" from "anon";

revoke insert on table "public"."user_role_audit" from "anon";

revoke references on table "public"."user_role_audit" from "anon";

revoke select on table "public"."user_role_audit" from "anon";

revoke trigger on table "public"."user_role_audit" from "anon";

revoke truncate on table "public"."user_role_audit" from "anon";

revoke update on table "public"."user_role_audit" from "anon";

revoke delete on table "public"."user_role_audit" from "authenticated";

revoke insert on table "public"."user_role_audit" from "authenticated";

revoke references on table "public"."user_role_audit" from "authenticated";

revoke select on table "public"."user_role_audit" from "authenticated";

revoke trigger on table "public"."user_role_audit" from "authenticated";

revoke truncate on table "public"."user_role_audit" from "authenticated";

revoke update on table "public"."user_role_audit" from "authenticated";

revoke delete on table "public"."user_role_audit" from "service_role";

revoke insert on table "public"."user_role_audit" from "service_role";

revoke references on table "public"."user_role_audit" from "service_role";

revoke select on table "public"."user_role_audit" from "service_role";

revoke trigger on table "public"."user_role_audit" from "service_role";

revoke truncate on table "public"."user_role_audit" from "service_role";

revoke update on table "public"."user_role_audit" from "service_role";

revoke delete on table "public"."user_roles" from "anon";

revoke insert on table "public"."user_roles" from "anon";

revoke references on table "public"."user_roles" from "anon";

revoke select on table "public"."user_roles" from "anon";

revoke trigger on table "public"."user_roles" from "anon";

revoke truncate on table "public"."user_roles" from "anon";

revoke update on table "public"."user_roles" from "anon";

revoke delete on table "public"."user_roles" from "authenticated";

revoke insert on table "public"."user_roles" from "authenticated";

revoke references on table "public"."user_roles" from "authenticated";

revoke select on table "public"."user_roles" from "authenticated";

revoke trigger on table "public"."user_roles" from "authenticated";

revoke truncate on table "public"."user_roles" from "authenticated";

revoke update on table "public"."user_roles" from "authenticated";

revoke delete on table "public"."user_roles" from "service_role";

revoke insert on table "public"."user_roles" from "service_role";

revoke references on table "public"."user_roles" from "service_role";

revoke select on table "public"."user_roles" from "service_role";

revoke trigger on table "public"."user_roles" from "service_role";

revoke truncate on table "public"."user_roles" from "service_role";

revoke update on table "public"."user_roles" from "service_role";

revoke delete on table "public"."user_sessions" from "anon";

revoke insert on table "public"."user_sessions" from "anon";

revoke references on table "public"."user_sessions" from "anon";

revoke select on table "public"."user_sessions" from "anon";

revoke trigger on table "public"."user_sessions" from "anon";

revoke truncate on table "public"."user_sessions" from "anon";

revoke update on table "public"."user_sessions" from "anon";

revoke delete on table "public"."user_sessions" from "authenticated";

revoke insert on table "public"."user_sessions" from "authenticated";

revoke references on table "public"."user_sessions" from "authenticated";

revoke select on table "public"."user_sessions" from "authenticated";

revoke trigger on table "public"."user_sessions" from "authenticated";

revoke truncate on table "public"."user_sessions" from "authenticated";

revoke update on table "public"."user_sessions" from "authenticated";

revoke delete on table "public"."user_sessions" from "service_role";

revoke insert on table "public"."user_sessions" from "service_role";

revoke references on table "public"."user_sessions" from "service_role";

revoke select on table "public"."user_sessions" from "service_role";

revoke trigger on table "public"."user_sessions" from "service_role";

revoke truncate on table "public"."user_sessions" from "service_role";

revoke update on table "public"."user_sessions" from "service_role";

revoke delete on table "public"."webhook_health" from "anon";

revoke insert on table "public"."webhook_health" from "anon";

revoke references on table "public"."webhook_health" from "anon";

revoke select on table "public"."webhook_health" from "anon";

revoke trigger on table "public"."webhook_health" from "anon";

revoke truncate on table "public"."webhook_health" from "anon";

revoke update on table "public"."webhook_health" from "anon";

revoke delete on table "public"."webhook_health" from "authenticated";

revoke insert on table "public"."webhook_health" from "authenticated";

revoke references on table "public"."webhook_health" from "authenticated";

revoke select on table "public"."webhook_health" from "authenticated";

revoke trigger on table "public"."webhook_health" from "authenticated";

revoke truncate on table "public"."webhook_health" from "authenticated";

revoke update on table "public"."webhook_health" from "authenticated";

revoke delete on table "public"."webhook_health" from "service_role";

revoke insert on table "public"."webhook_health" from "service_role";

revoke references on table "public"."webhook_health" from "service_role";

revoke select on table "public"."webhook_health" from "service_role";

revoke trigger on table "public"."webhook_health" from "service_role";

revoke truncate on table "public"."webhook_health" from "service_role";

revoke update on table "public"."webhook_health" from "service_role";

revoke delete on table "public"."webhook_processed_messages" from "anon";

revoke insert on table "public"."webhook_processed_messages" from "anon";

revoke references on table "public"."webhook_processed_messages" from "anon";

revoke select on table "public"."webhook_processed_messages" from "anon";

revoke trigger on table "public"."webhook_processed_messages" from "anon";

revoke truncate on table "public"."webhook_processed_messages" from "anon";

revoke update on table "public"."webhook_processed_messages" from "anon";

revoke delete on table "public"."webhook_processed_messages" from "authenticated";

revoke insert on table "public"."webhook_processed_messages" from "authenticated";

revoke references on table "public"."webhook_processed_messages" from "authenticated";

revoke select on table "public"."webhook_processed_messages" from "authenticated";

revoke trigger on table "public"."webhook_processed_messages" from "authenticated";

revoke truncate on table "public"."webhook_processed_messages" from "authenticated";

revoke update on table "public"."webhook_processed_messages" from "authenticated";

revoke delete on table "public"."webhook_processed_messages" from "service_role";

revoke insert on table "public"."webhook_processed_messages" from "service_role";

revoke references on table "public"."webhook_processed_messages" from "service_role";

revoke select on table "public"."webhook_processed_messages" from "service_role";

revoke trigger on table "public"."webhook_processed_messages" from "service_role";

revoke truncate on table "public"."webhook_processed_messages" from "service_role";

revoke update on table "public"."webhook_processed_messages" from "service_role";

revoke delete on table "public"."workflow_runs" from "anon";

revoke insert on table "public"."workflow_runs" from "anon";

revoke references on table "public"."workflow_runs" from "anon";

revoke select on table "public"."workflow_runs" from "anon";

revoke trigger on table "public"."workflow_runs" from "anon";

revoke truncate on table "public"."workflow_runs" from "anon";

revoke update on table "public"."workflow_runs" from "anon";

revoke delete on table "public"."workflow_runs" from "authenticated";

revoke insert on table "public"."workflow_runs" from "authenticated";

revoke references on table "public"."workflow_runs" from "authenticated";

revoke select on table "public"."workflow_runs" from "authenticated";

revoke trigger on table "public"."workflow_runs" from "authenticated";

revoke truncate on table "public"."workflow_runs" from "authenticated";

revoke update on table "public"."workflow_runs" from "authenticated";

revoke delete on table "public"."workflow_runs" from "service_role";

revoke insert on table "public"."workflow_runs" from "service_role";

revoke references on table "public"."workflow_runs" from "service_role";

revoke select on table "public"."workflow_runs" from "service_role";

revoke trigger on table "public"."workflow_runs" from "service_role";

revoke truncate on table "public"."workflow_runs" from "service_role";

revoke update on table "public"."workflow_runs" from "service_role";

revoke delete on table "public"."workflows" from "anon";

revoke insert on table "public"."workflows" from "anon";

revoke references on table "public"."workflows" from "anon";

revoke select on table "public"."workflows" from "anon";

revoke trigger on table "public"."workflows" from "anon";

revoke truncate on table "public"."workflows" from "anon";

revoke update on table "public"."workflows" from "anon";

revoke delete on table "public"."workflows" from "authenticated";

revoke insert on table "public"."workflows" from "authenticated";

revoke references on table "public"."workflows" from "authenticated";

revoke select on table "public"."workflows" from "authenticated";

revoke trigger on table "public"."workflows" from "authenticated";

revoke truncate on table "public"."workflows" from "authenticated";

revoke update on table "public"."workflows" from "authenticated";

revoke delete on table "public"."workflows" from "service_role";

revoke insert on table "public"."workflows" from "service_role";

revoke references on table "public"."workflows" from "service_role";

revoke select on table "public"."workflows" from "service_role";

revoke trigger on table "public"."workflows" from "service_role";

revoke truncate on table "public"."workflows" from "service_role";

revoke update on table "public"."workflows" from "service_role";

alter table "public"."audit_logs" drop constraint "action_valid";

alter table "public"."audit_logs" drop constraint "audit_logs_organization_id_fkey";

alter table "public"."booking_note_history" drop constraint "booking_note_history_property_id_fkey";

alter table "public"."booking_templates" drop constraint "booking_templates_property_id_fkey";

alter table "public"."booking_templates" drop constraint "booking_templates_property_org_match";

alter table "public"."bookings" drop constraint "bookings_property_id_fkey";

alter table "public"."bookings" drop constraint "bookings_property_org_match";

alter table "public"."calendar_sync_events" drop constraint "calendar_sync_events_property_id_fkey";

alter table "public"."calendar_sync_events" drop constraint "calendar_sync_events_property_org_match";

alter table "public"."filter_presets" drop constraint "filter_presets_property_id_fkey";

alter table "public"."filter_presets" drop constraint "filter_presets_property_org_match";

alter table "public"."properties" drop constraint "properties_organization_id_fkey";

alter table "public"."room_units" drop constraint "room_units_property_id_fkey";

alter table "public"."room_units" drop constraint "room_units_property_org_match";

alter table "public"."audit_logs" drop constraint "audit_logs_user_id_fkey";

drop function if exists "public"."get_tables_rls_status_batch"();

drop function if exists "public"."property_belongs_to_org"(p_property_id uuid, p_org_id uuid);

drop view if exists "public"."profiles_safe";

drop view if exists "public"."user_role_view";

alter table "public"."properties" drop constraint "properties_pkey";

drop index if exists "public"."idx_agent_priorities_org";

drop index if exists "public"."idx_ai_alert_history_acknowledged";

drop index if exists "public"."idx_ai_alert_history_created_at";

drop index if exists "public"."idx_ai_alert_history_org";

drop index if exists "public"."idx_ai_alert_history_rule";

drop index if exists "public"."idx_ai_alert_rules_enabled";

drop index if exists "public"."idx_ai_alert_rules_org";

drop index if exists "public"."idx_ai_alert_rules_user";

drop index if exists "public"."idx_ai_conversations_created_at";

drop index if exists "public"."idx_ai_conversations_lead_id";

drop index if exists "public"."idx_ai_conversations_organization_id";

drop index if exists "public"."idx_ai_conversations_status";

drop index if exists "public"."idx_ai_messages_conversation_id";

drop index if exists "public"."idx_ai_messages_created_at";

drop index if exists "public"."idx_ai_metrics_org_type_recorded";

drop index if exists "public"."idx_ai_metrics_recorded_at";

drop index if exists "public"."idx_ai_metrics_type";

drop index if exists "public"."idx_ai_metrics_type_recorded";

drop index if exists "public"."idx_ai_snapshots_date";

drop index if exists "public"."idx_ai_snapshots_org_date";

drop index if exists "public"."idx_alert_notifications_rule";

drop index if exists "public"."idx_alert_notifications_triggered";

drop index if exists "public"."idx_alert_notifications_unsent";

drop index if exists "public"."idx_analytics_events_category_action";

drop index if exists "public"."idx_analytics_events_created_at";

drop index if exists "public"."idx_analytics_events_session_created";

drop index if exists "public"."idx_analytics_events_type";

drop index if exists "public"."idx_audit_logs_action";

drop index if exists "public"."idx_audit_logs_created_at";

drop index if exists "public"."idx_audit_logs_organization_id";

drop index if exists "public"."idx_audit_logs_table_name";

drop index if exists "public"."idx_audit_logs_user_id";

drop index if exists "public"."idx_booking_note_history_booking";

drop index if exists "public"."idx_booking_note_history_property";

drop index if exists "public"."idx_booking_note_history_user";

drop index if exists "public"."idx_booking_templates_org_property";

drop index if exists "public"."idx_booking_templates_room";

drop index if exists "public"."idx_booking_templates_user_org";

drop index if exists "public"."idx_bookings_check_in";

drop index if exists "public"."idx_bookings_confirmed_by";

drop index if exists "public"."idx_bookings_dates";

drop index if exists "public"."idx_bookings_lead_id";

drop index if exists "public"."idx_bookings_new_created";

drop index if exists "public"."idx_bookings_org_property";

drop index if exists "public"."idx_bookings_organization_id";

drop index if exists "public"."idx_bookings_pending_checkin";

drop index if exists "public"."idx_bookings_room_unit_id";

drop index if exists "public"."idx_calendar_events_org";

drop index if exists "public"."idx_calendar_events_time";

drop index if exists "public"."idx_calendar_events_user";

drop index if exists "public"."idx_calendar_sync_events_org_dates";

drop index if exists "public"."idx_calendar_sync_events_org_property";

drop index if exists "public"."idx_calendar_sync_events_room_dates";

drop index if exists "public"."idx_calendar_sync_events_source_platform";

drop index if exists "public"."idx_call_logs_created_at";

drop index if exists "public"."idx_call_logs_lead_id";

drop index if exists "public"."idx_communications_created";

drop index if exists "public"."idx_communications_org";

drop index if exists "public"."idx_conversation_metadata_conv_id";

drop index if exists "public"."idx_conversation_metadata_created_at";

drop index if exists "public"."idx_conversation_metadata_lead_id";

drop index if exists "public"."idx_conversation_metadata_sentiment";

drop index if exists "public"."idx_dashboard_layouts_org";

drop index if exists "public"."idx_dashboard_layouts_user";

drop index if exists "public"."idx_demo_requests_created_at_email";

drop index if exists "public"."idx_email_queue_status";

drop index if exists "public"."idx_filter_presets_is_default";

drop index if exists "public"."idx_filter_presets_org_property";

drop index if exists "public"."idx_filter_presets_user_org";

drop index if exists "public"."idx_handoff_events_agent";

drop index if exists "public"."idx_handoff_events_completed";

drop index if exists "public"."idx_handoff_events_created_at";

drop index if exists "public"."idx_handoff_events_lead_id";

drop index if exists "public"."idx_inventory_items_category";

drop index if exists "public"."idx_inventory_items_low_stock";

drop index if exists "public"."idx_inventory_items_organization";

drop index if exists "public"."idx_ip_blocklist_active";

drop index if exists "public"."idx_kb_performance_article";

drop index if exists "public"."idx_kb_performance_conversion";

drop index if exists "public"."idx_kb_performance_last_used";

drop index if exists "public"."idx_kb_performance_shown";

drop index if exists "public"."idx_kb_versions_article";

drop index if exists "public"."idx_kb_versions_article_version";

drop index if exists "public"."idx_kb_versions_created_at";

drop index if exists "public"."idx_knowledge_base_entries_image_urls";

drop index if exists "public"."idx_knowledge_base_entries_is_active";

drop index if exists "public"."idx_knowledge_base_entries_organization_id";

drop index if exists "public"."idx_lead_engagement_profiles_lead_id";

drop index if exists "public"."idx_lead_engagement_profiles_org_id";

drop index if exists "public"."idx_lead_engagement_profiles_updated_at";

drop index if exists "public"."idx_lead_offerings_lead_id";

drop index if exists "public"."idx_lead_offerings_offering_id";

drop index if exists "public"."idx_lead_qual_scores_lead_id";

drop index if exists "public"."idx_lead_qual_scores_org_status";

drop index if exists "public"."idx_lead_qual_scores_score";

drop index if exists "public"."idx_lead_qual_scores_status";

drop index if exists "public"."idx_leads_assigned_agent_id";

drop index if exists "public"."idx_leads_created_at";

drop index if exists "public"."idx_leads_is_ai_managed";

drop index if exists "public"."idx_leads_lead_temperature";

drop index if exists "public"."idx_leads_org_status";

drop index if exists "public"."idx_leads_organization_id";

drop index if exists "public"."idx_leads_platform_user_id";

drop index if exists "public"."idx_leads_qualification_status";

drop index if exists "public"."idx_leads_status";

drop index if exists "public"."idx_leads_temperature";

drop index if exists "public"."idx_login_attempts_attempted_at";

drop index if exists "public"."idx_login_attempts_coords";

drop index if exists "public"."idx_login_attempts_country";

drop index if exists "public"."idx_login_attempts_email_time";

drop index if exists "public"."idx_login_attempts_ip_time";

drop index if exists "public"."idx_maintenance_blocks_org_dates";

drop index if exists "public"."idx_maintenance_blocks_room";

drop index if exists "public"."idx_message_buffer_sender";

drop index if exists "public"."idx_message_buffer_unprocessed";

drop index if exists "public"."idx_message_reactions_communication_id";

drop index if exists "public"."idx_message_reactions_user_id";

drop index if exists "public"."idx_migration_logs_can_undo";

drop index if exists "public"."idx_migration_logs_performed_by";

drop index if exists "public"."idx_notification_history_created_at";

drop index if exists "public"."idx_notification_history_is_read";

drop index if exists "public"."idx_notification_history_user_id";

drop index if exists "public"."idx_offerings_image_urls";

drop index if exists "public"."idx_offerings_is_active";

drop index if exists "public"."idx_offerings_organization_id";

drop index if exists "public"."idx_operational_expenses_category";

drop index if exists "public"."idx_operational_expenses_date";

drop index if exists "public"."idx_operational_expenses_due_date";

drop index if exists "public"."idx_operational_expenses_org";

drop index if exists "public"."idx_operational_expenses_recurring";

drop index if exists "public"."idx_operational_expenses_room";

drop index if exists "public"."idx_operational_expenses_unpaid";

drop index if exists "public"."idx_orders_created_at";

drop index if exists "public"."idx_orders_lead_id";

drop index if exists "public"."idx_orders_organization_id";

drop index if exists "public"."idx_orders_pending_pickup";

drop index if exists "public"."idx_orders_status";

drop index if exists "public"."idx_organizations_is_archived";

drop index if exists "public"."idx_profiles_is_active";

drop index if exists "public"."idx_profiles_organization_id";

drop index if exists "public"."idx_profiles_totp_enabled";

drop index if exists "public"."idx_properties_org";

drop index if exists "public"."idx_properties_org_name_unique";

drop index if exists "public"."idx_qual_events_created_at";

drop index if exists "public"."idx_qual_events_event_type";

drop index if exists "public"."idx_qual_events_lead_id";

drop index if exists "public"."idx_rate_limits_key_window";

drop index if exists "public"."idx_reengagement_campaign_type";

drop index if exists "public"."idx_reengagement_lead_id";

drop index if exists "public"."idx_reengagement_response";

drop index if exists "public"."idx_reengagement_sent_at";

drop index if exists "public"."idx_reengagement_templates_enabled";

drop index if exists "public"."idx_reengagement_templates_org_type";

drop index if exists "public"."idx_reengagement_templates_success";

drop index if exists "public"."idx_reports_scheduled";

drop index if exists "public"."idx_room_units_category";

drop index if exists "public"."idx_room_units_org_property";

drop index if exists "public"."idx_room_units_organization_id";

drop index if exists "public"."idx_rubric_templates_org";

drop index if exists "public"."idx_team_members_role";

drop index if exists "public"."idx_team_members_team";

drop index if exists "public"."idx_team_members_user";

drop index if exists "public"."idx_teams_lead";

drop index if exists "public"."idx_teams_organization";

drop index if exists "public"."idx_training_modules_org";

drop index if exists "public"."idx_training_sessions_module";

drop index if exists "public"."idx_training_sessions_org";

drop index if exists "public"."idx_training_sessions_user";

drop index if exists "public"."idx_user_permissions_set";

drop index if exists "public"."idx_user_permissions_user";

drop index if exists "public"."idx_user_role_audit_created";

drop index if exists "public"."idx_user_role_audit_user";

drop index if exists "public"."idx_user_roles_expires";

drop index if exists "public"."idx_user_sessions_active";

drop index if exists "public"."idx_user_sessions_user";

drop index if exists "public"."idx_webhook_health_organization_id";

drop index if exists "public"."idx_webhook_health_platform_id";

drop index if exists "public"."idx_workflow_runs_workflow";

drop index if exists "public"."idx_workflows_org";

drop index if exists "public"."properties_pkey";

drop index if exists "public"."webhook_processed_messages_external_id_idx";

drop table "public"."properties";

alter table "public"."audit_logs" drop column "description";

alter table "public"."audit_logs" drop column "new_values";

alter table "public"."audit_logs" drop column "old_values";

alter table "public"."audit_logs" drop column "organization_id";

alter table "public"."audit_logs" drop column "record_id";

alter table "public"."audit_logs" drop column "table_name";

alter table "public"."audit_logs" add column "details" jsonb;

alter table "public"."audit_logs" add column "resource_id" text;

alter table "public"."audit_logs" add column "resource_type" text not null;

alter table "public"."audit_logs" alter column "action" set data type text using "action"::text;

alter table "public"."audit_logs" alter column "id" set default gen_random_uuid();

alter table "public"."audit_logs" alter column "ip_address" set data type text using "ip_address"::text;

alter table "public"."audit_logs" alter column "user_id" drop not null;

alter table "public"."booking_note_history" alter column "property_id" drop not null;

alter table "public"."booking_templates" alter column "property_id" drop not null;

alter table "public"."bookings" alter column "property_id" drop not null;

alter table "public"."calendar_sync_events" alter column "property_id" drop not null;

alter table "public"."filter_presets" alter column "property_id" drop not null;

alter table "public"."profiles" drop column "user_role";

alter table "public"."room_units" alter column "property_id" drop not null;

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

set check_function_bodies = off;

create or replace view "public"."profiles_safe" as  SELECT id,
    organization_id,
    email,
    full_name,
    avatar_url,
    is_active,
    created_at,
    updated_at,
    totp_enabled,
    totp_verified_at
   FROM public.profiles;


CREATE OR REPLACE FUNCTION public.update_conversation_timestamp_from_communication()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Find the most recent conversation for this lead and update its timestamp
  UPDATE public.ai_conversations
  SET updated_at = NEW.created_at
  WHERE id = (
    SELECT id 
    FROM public.ai_conversations 
    WHERE lead_id = NEW.lead_id
    ORDER BY updated_at DESC
    LIMIT 1
  );
  RETURN NEW;
END;
$function$
;

create or replace view "public"."user_role_view" as  SELECT ur.user_id,
    ur.role,
    p.organization_id
   FROM (public.user_roles ur
     JOIN public.profiles p ON ((p.id = ur.user_id)));



  create policy "unified_agent_priorities_policy"
  on "public"."agent_priorities"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR (agent_id = ( SELECT auth.uid() AS uid))))));



  create policy "unified_ai_alert_history_policy"
  on "public"."ai_alert_history"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_ai_alert_rules_policy"
  on "public"."ai_alert_rules"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_ai_analytics_snapshots_policy"
  on "public"."ai_analytics_snapshots"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_ai_conversations_policy"
  on "public"."ai_conversations"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR public.is_assigned_to_lead(( SELECT auth.uid() AS uid), lead_id)))));



  create policy "unified_ai_performance_metrics_policy"
  on "public"."ai_performance_metrics"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_analytics_delete"
  on "public"."analytics_events"
  as permissive
  for delete
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_analytics_insert"
  on "public"."analytics_events"
  as permissive
  for insert
  to public
with check ((id IS NOT NULL));



  create policy "unified_analytics_select"
  on "public"."analytics_events"
  as permissive
  for select
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_analytics_update"
  on "public"."analytics_events"
  as permissive
  for update
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_audit_logs_insert"
  on "public"."audit_logs"
  as permissive
  for insert
  to public
with check (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));



  create policy "unified_audit_logs_select"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_bookings_policy"
  on "public"."bookings"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR public.is_assigned_to_lead(( SELECT auth.uid() AS uid), lead_id)))));



  create policy "unified_calendar_events_access"
  on "public"."calendar_events"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR (user_id = ( SELECT auth.uid() AS uid))))));



  create policy "unified_calendar_sync_policy"
  on "public"."calendar_sync_events"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_communications_policy"
  on "public"."communications"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR (lead_id IS NULL) OR public.is_assigned_to_lead(( SELECT auth.uid() AS uid), lead_id)))));



  create policy "unified_conversation_metadata_policy"
  on "public"."conversation_metadata"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_dashboard_layouts_policy"
  on "public"."dashboard_layouts"
  as permissive
  for all
  to public
using (((user_id = ( SELECT auth.uid() AS uid)) OR ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) OR public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role)))));



  create policy "unified_handoff_events_policy"
  on "public"."handoff_events"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_ip_blocklist_policy"
  on "public"."ip_blocklist"
  as permissive
  for all
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_kb_documents_policy"
  on "public"."knowledge_base_documents"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_kb_entries_policy"
  on "public"."knowledge_base_entries"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_kb_performance_policy"
  on "public"."knowledge_base_performance"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_kb_versions_policy"
  on "public"."knowledge_base_versions"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_lead_qualification_scores_policy"
  on "public"."lead_qualification_scores"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_leads_policy"
  on "public"."leads"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR (assigned_agent_id = ( SELECT auth.uid() AS uid)))) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_message_reactions_policy"
  on "public"."message_reactions"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (user_id = ( SELECT auth.uid() AS uid))) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_message_templates_policy"
  on "public"."message_templates"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_offerings_policy"
  on "public"."offerings"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_orders_policy"
  on "public"."orders"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.org_uses_shared_access(organization_id) OR public.is_assigned_to_lead(( SELECT auth.uid() AS uid), lead_id)))));



  create policy "unified_organizations_policy"
  on "public"."organizations"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_permission_sets_delete"
  on "public"."permission_sets"
  as permissive
  for delete
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_permission_sets_insert"
  on "public"."permission_sets"
  as permissive
  for insert
  to public
with check (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_permission_sets_select"
  on "public"."permission_sets"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "unified_permission_sets_update"
  on "public"."permission_sets"
  as permissive
  for update
  to public
using (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "unified_phone_numbers_policy"
  on "public"."phone_numbers"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_profiles_policy"
  on "public"."profiles"
  as permissive
  for all
  to public
using (((id = ( SELECT auth.uid() AS uid)) OR public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))))));



  create policy "unified_qualification_events_policy"
  on "public"."qualification_events"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_re_engagement_campaigns_policy"
  on "public"."re_engagement_campaigns"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_re_engagement_templates_policy"
  on "public"."re_engagement_templates"
  as permissive
  for all
  to public
using ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "unified_reports_policy"
  on "public"."reports"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_room_units_policy"
  on "public"."room_units"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_rubric_templates_policy"
  on "public"."rubric_templates"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_social_platforms_policy"
  on "public"."social_platforms"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_team_members_policy"
  on "public"."team_members"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (user_id = ( SELECT auth.uid() AS uid)) OR public.is_team_lead(( SELECT auth.uid() AS uid), team_id) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_members.team_id) AND (t.organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))))))));



  create policy "unified_teams_policy"
  on "public"."teams"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) OR public.has_role(( SELECT auth.uid() AS uid), 'agent'::public.app_role)))));



  create policy "unified_training_modules_policy"
  on "public"."training_modules"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "unified_training_sessions_policy"
  on "public"."training_sessions"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))) OR ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (user_id = ( SELECT auth.uid() AS uid)))));



  create policy "unified_user_permissions_policy"
  on "public"."user_permissions"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_permissions.user_id) AND (p.organization_id = public.get_user_org(( SELECT auth.uid() AS uid))))))) OR (user_id = ( SELECT auth.uid() AS uid))));



  create policy "unified_user_role_audit_policy"
  on "public"."user_role_audit"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_role_audit.user_id) AND (p.organization_id = public.get_user_org(( SELECT auth.uid() AS uid))))))) OR (user_id = ( SELECT auth.uid() AS uid))));



  create policy "unified_user_roles_policy"
  on "public"."user_roles"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (user_id = ( SELECT auth.uid() AS uid)) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))))))));



  create policy "unified_user_sessions_policy"
  on "public"."user_sessions"
  as permissive
  for all
  to public
using (((user_id = ( SELECT auth.uid() AS uid)) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = user_sessions.user_id) AND (p.organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))))))));



  create policy "unified_webhook_health_policy"
  on "public"."webhook_health"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))))));



  create policy "unified_workflows_policy"
  on "public"."workflows"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "Users can insert messages to their org conversations"
  on "public"."ai_messages"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.ai_conversations c
     JOIN public.profiles p ON ((p.organization_id = c.organization_id)))
  WHERE ((c.id = ai_messages.conversation_id) AND (p.id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can read messages from their org conversations"
  on "public"."ai_messages"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.ai_conversations c
     JOIN public.profiles p ON ((p.organization_id = c.organization_id)))
  WHERE ((c.id = ai_messages.conversation_id) AND (p.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))));



  create policy "Super admins can view alert notifications"
  on "public"."alert_notifications"
  as permissive
  for select
  to public
using ((( SELECT ( SELECT auth.uid() AS uid) AS uid) IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE (user_roles.role = 'super_admin'::public.app_role))));



  create policy "Super admins can manage alert rules"
  on "public"."alert_rules"
  as permissive
  for all
  to public
using ((( SELECT ( SELECT auth.uid() AS uid) AS uid) IN ( SELECT user_roles.user_id
   FROM public.user_roles
  WHERE (user_roles.role = 'super_admin'::public.app_role))));



  create policy "Users can insert note history for bookings in their org"
  on "public"."booking_note_history"
  as permissive
  for insert
  to public
with check ((booking_id IN ( SELECT bookings.id
   FROM public.bookings
  WHERE (bookings.organization_id IN ( SELECT bookings.organization_id
           FROM public.user_roles
          WHERE (user_roles.user_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users can view note history for bookings in their org"
  on "public"."booking_note_history"
  as permissive
  for select
  to public
using ((booking_id IN ( SELECT bookings.id
   FROM public.bookings
  WHERE (bookings.organization_id IN ( SELECT bookings.organization_id
           FROM public.user_roles
          WHERE (user_roles.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))));



  create policy "Users can delete booking templates in their org"
  on "public"."booking_templates"
  as permissive
  for delete
  to public
using ((organization_id IN ( SELECT booking_templates.organization_id
   FROM public.user_roles
  WHERE (user_roles.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can insert booking templates in their org"
  on "public"."booking_templates"
  as permissive
  for insert
  to public
with check ((organization_id IN ( SELECT booking_templates.organization_id
   FROM public.user_roles
  WHERE (user_roles.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "Users can update booking templates in their org"
  on "public"."booking_templates"
  as permissive
  for update
  to public
using ((organization_id IN ( SELECT booking_templates.organization_id
   FROM public.user_roles
  WHERE (user_roles.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can view their org's booking templates"
  on "public"."booking_templates"
  as permissive
  for select
  to public
using ((organization_id IN ( SELECT booking_templates.organization_id
   FROM public.user_roles
  WHERE (user_roles.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Agents create call logs"
  on "public"."call_logs"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = agent_id));



  create policy "Users view authorized call logs"
  on "public"."call_logs"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = call_logs.lead_id) AND (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'client_admin'::public.app_role) AND (l.organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid)))) OR (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'agent'::public.app_role) AND (l.organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))) AND (public.org_uses_shared_access(l.organization_id) OR (l.assigned_agent_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))))));



  create policy "Users view authorized chat messages"
  on "public"."chat_messages"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.leads l
  WHERE ((l.id = chat_messages.lead_id) AND (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role) OR (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'client_admin'::public.app_role) AND (l.organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid)))) OR (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'agent'::public.app_role) AND (l.organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))) AND (public.org_uses_shared_access(l.organization_id) OR (l.assigned_agent_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))))))));



  create policy "Super admins can update demo requests"
  on "public"."demo_requests"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (user_roles.role = 'super_admin'::public.app_role)))));



  create policy "Super admins can view demo requests"
  on "public"."demo_requests"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) AND (user_roles.role = 'super_admin'::public.app_role)))));



  create policy "Users can delete their own filter presets"
  on "public"."filter_presets"
  as permissive
  for delete
  to public
using ((( SELECT ( SELECT auth.uid() AS uid) AS uid) = user_id));



  create policy "Users can insert their own filter presets"
  on "public"."filter_presets"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update their own filter presets"
  on "public"."filter_presets"
  as permissive
  for update
  to public
using ((( SELECT ( SELECT auth.uid() AS uid) AS uid) = user_id));



  create policy "Users can view their own filter presets"
  on "public"."filter_presets"
  as permissive
  for select
  to public
using ((( SELECT ( SELECT auth.uid() AS uid) AS uid) = user_id));



  create policy "Users can delete their own tokens"
  on "public"."google_calendar_tokens"
  as permissive
  for delete
  to public
using ((( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) = user_id));



  create policy "Users can insert their own tokens"
  on "public"."google_calendar_tokens"
  as permissive
  for insert
  to public
with check ((( SELECT ( SELECT auth.uid() AS uid) AS uid) = user_id));



  create policy "Users can update their own tokens"
  on "public"."google_calendar_tokens"
  as permissive
  for update
  to public
using ((( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) = user_id));



  create policy "Users can view their own tokens"
  on "public"."google_calendar_tokens"
  as permissive
  for select
  to public
using ((( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) = user_id));



  create policy "Super admins can view health history"
  on "public"."health_check_history"
  as permissive
  for select
  to public
using (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role));



  create policy "Super admins can manage health thresholds"
  on "public"."health_check_thresholds"
  as permissive
  for all
  to public
using (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role))
with check (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "Assigned admins and super admins can update tickets"
  on "public"."helpdesk_tickets"
  as permissive
  for update
  to public
using (((assigned_admin_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Users can create helpdesk tickets"
  on "public"."helpdesk_tickets"
  as permissive
  for insert
  to public
with check (((requester_id = ( SELECT auth.uid() AS uid)) AND (organization_id = public.get_user_org(( SELECT auth.uid() AS uid)))));



  create policy "Users can view their own tickets"
  on "public"."helpdesk_tickets"
  as permissive
  for select
  to public
using (((requester_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR (assigned_admin_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Users can create inventory items in their organization"
  on "public"."inventory_items"
  as permissive
  for insert
  to public
with check ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));



  create policy "Users can delete inventory items in their organization"
  on "public"."inventory_items"
  as permissive
  for delete
  to public
using ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can update inventory items in their organization"
  on "public"."inventory_items"
  as permissive
  for update
  to public
using ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can view inventory items in their organization"
  on "public"."inventory_items"
  as permissive
  for select
  to public
using ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can delete engagement profiles in their org"
  on "public"."lead_engagement_profiles"
  as permissive
  for delete
  to public
using ((organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))));



  create policy "Users can insert engagement profiles in their org"
  on "public"."lead_engagement_profiles"
  as permissive
  for insert
  to public
with check ((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))));



  create policy "Users can update engagement profiles in their org"
  on "public"."lead_engagement_profiles"
  as permissive
  for update
  to public
using ((organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))));



  create policy "Users can view engagement profiles in their org"
  on "public"."lead_engagement_profiles"
  as permissive
  for select
  to public
using ((organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))));



  create policy "Users can delete lead offerings in their organization"
  on "public"."lead_offerings"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.leads
  WHERE ((leads.id = lead_offerings.lead_id) AND (leads.organization_id IN ( SELECT profiles.organization_id
           FROM public.profiles
          WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))))));



  create policy "Users can insert lead offerings in their organization"
  on "public"."lead_offerings"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.leads
  WHERE ((leads.id = lead_offerings.lead_id) AND (leads.organization_id IN ( SELECT profiles.organization_id
           FROM public.profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid))))))));



  create policy "Users can update lead offerings in their organization"
  on "public"."lead_offerings"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.leads
  WHERE ((leads.id = lead_offerings.lead_id) AND (leads.organization_id IN ( SELECT profiles.organization_id
           FROM public.profiles
          WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))))));



  create policy "Users can view lead offerings in their organization"
  on "public"."lead_offerings"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.leads
  WHERE ((leads.id = lead_offerings.lead_id) AND (leads.organization_id IN ( SELECT profiles.organization_id
           FROM public.profiles
          WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))))))));



  create policy "Super admins view login attempts"
  on "public"."login_attempts"
  as permissive
  for select
  to public
using (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role));



  create policy "System can record login attempts"
  on "public"."login_attempts"
  as permissive
  for insert
  to public
with check ((email IS NOT NULL));



  create policy "Client admins can create maintenance blocks"
  on "public"."maintenance_blocks"
  as permissive
  for insert
  to public
with check (((organization_id = public.get_user_org(( SELECT auth.uid() AS uid))) AND (public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) OR public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role))));



  create policy "Client admins can delete maintenance blocks"
  on "public"."maintenance_blocks"
  as permissive
  for delete
  to public
using (((organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))) AND (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'client_admin'::public.app_role) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role))));



  create policy "Client admins can update maintenance blocks"
  on "public"."maintenance_blocks"
  as permissive
  for update
  to public
using (((organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))) AND (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'client_admin'::public.app_role) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role))));



  create policy "Users can view maintenance blocks in their org"
  on "public"."maintenance_blocks"
  as permissive
  for select
  to public
using ((organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid))));



  create policy "Super admins manage migration_logs"
  on "public"."migration_logs"
  as permissive
  for all
  to public
using ((public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role) AND (NOT public.is_impersonating(( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users view own notifications"
  on "public"."notification_history"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = user_id) AND ((organization_id IS NULL) OR (organization_id = public.get_user_org(( SELECT auth.uid() AS uid))))));



  create policy "Users can insert their own notification preferences"
  on "public"."notification_preferences"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update their own notification preferences"
  on "public"."notification_preferences"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can view their own notification preferences"
  on "public"."notification_preferences"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can create expenses for their organization"
  on "public"."operational_expenses"
  as permissive
  for insert
  to public
with check ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));



  create policy "Users can delete expenses for their organization"
  on "public"."operational_expenses"
  as permissive
  for delete
  to public
using ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can update expenses for their organization"
  on "public"."operational_expenses"
  as permissive
  for update
  to public
using ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Users can view expenses for their organization"
  on "public"."operational_expenses"
  as permissive
  for select
  to public
using ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)))));



  create policy "Super admins can manage secret rotation"
  on "public"."secret_rotation_tracking"
  as permissive
  for all
  to public
using (public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role))
with check (public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role));



  create policy "Chat admins can remove members"
  on "public"."team_chat_members"
  as permissive
  for delete
  to public
using ((public.is_chat_admin(( SELECT ( SELECT auth.uid() AS uid) AS uid), chat_id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role) OR (user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))));



  create policy "Chat admins can update members"
  on "public"."team_chat_members"
  as permissive
  for update
  to public
using ((public.is_chat_admin(( SELECT ( SELECT auth.uid() AS uid) AS uid), chat_id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role) OR (user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid))));



  create policy "Chat creators/admins can add members"
  on "public"."team_chat_members"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.team_chats c
  WHERE ((c.id = team_chat_members.chat_id) AND (c.created_by = ( SELECT auth.uid() AS uid)) AND (c.organization_id = ( SELECT p.organization_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid))))))) OR public.is_chat_admin(( SELECT auth.uid() AS uid), chat_id) OR public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role)));



  create policy "Members can view chat members"
  on "public"."team_chat_members"
  as permissive
  for select
  to public
using ((public.is_chat_member(( SELECT ( SELECT auth.uid() AS uid) AS uid), chat_id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Members can send messages"
  on "public"."team_chat_messages"
  as permissive
  for insert
  to public
with check ((public.is_chat_member(( SELECT auth.uid() AS uid), chat_id) AND (sender_id = ( SELECT auth.uid() AS uid))));



  create policy "Members can view messages"
  on "public"."team_chat_messages"
  as permissive
  for select
  to public
using ((public.is_chat_member(( SELECT ( SELECT auth.uid() AS uid) AS uid), chat_id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Senders and admins can delete messages"
  on "public"."team_chat_messages"
  as permissive
  for delete
  to public
using (((sender_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR public.is_chat_admin(( SELECT ( SELECT auth.uid() AS uid) AS uid), chat_id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Senders can edit their messages"
  on "public"."team_chat_messages"
  as permissive
  for update
  to public
using ((sender_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));



  create policy "Members can add reactions"
  on "public"."team_chat_reactions"
  as permissive
  for insert
  to public
with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.team_chat_messages m
  WHERE ((m.id = team_chat_reactions.message_id) AND public.is_chat_member(( SELECT auth.uid() AS uid), m.chat_id))))));



  create policy "Members can view reactions"
  on "public"."team_chat_reactions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.team_chat_messages m
  WHERE ((m.id = team_chat_reactions.message_id) AND public.is_chat_member(( SELECT ( SELECT auth.uid() AS uid) AS uid), m.chat_id)))));



  create policy "Users can remove their reactions"
  on "public"."team_chat_reactions"
  as permissive
  for delete
  to public
using ((user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)));



  create policy "Authenticated users can create chats in their org"
  on "public"."team_chats"
  as permissive
  for insert
  to public
with check (((created_by = ( SELECT auth.uid() AS uid)) AND (organization_id = ( SELECT p.organization_id
   FROM public.profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))) AND ((chat_type = ANY (ARRAY['direct'::public.chat_type, 'helpdesk'::public.chat_type])) OR public.has_role(( SELECT auth.uid() AS uid), 'client_admin'::public.app_role) OR public.has_role(( SELECT auth.uid() AS uid), 'super_admin'::public.app_role))));



  create policy "Chat admins can delete chats"
  on "public"."team_chats"
  as permissive
  for delete
  to public
using ((public.is_chat_admin(( SELECT ( SELECT auth.uid() AS uid) AS uid), id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Chat admins can update chats"
  on "public"."team_chats"
  as permissive
  for update
  to public
using ((public.is_chat_admin(( SELECT ( SELECT auth.uid() AS uid) AS uid), id) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Users can view chats they are members of"
  on "public"."team_chats"
  as permissive
  for select
  to public
using ((public.is_chat_member(( SELECT ( SELECT auth.uid() AS uid) AS uid), id) OR (created_by = ( SELECT ( SELECT auth.uid() AS uid) AS uid)) OR public.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::public.app_role)));



  create policy "Users can view workflow runs in their organization"
  on "public"."workflow_runs"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.workflows w
  WHERE ((w.id = workflow_runs.workflow_id) AND (w.organization_id = public.get_user_org(( SELECT ( SELECT auth.uid() AS uid) AS uid)))))));


drop policy "Chat members can upload attachments" on "storage"."objects";

drop policy "Chat members can view attachments" on "storage"."objects";


  create policy "Authenticated users can delete item images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'item-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can update their item images"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'item-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can upload item images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'item-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Client admins can delete knowledge base files"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'knowledge-base'::text) AND (public.has_role(auth.uid(), 'client_admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));



  create policy "Client admins can upload knowledge base files"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'knowledge-base'::text) AND (public.has_role(auth.uid(), 'client_admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));



  create policy "Item images are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'item-images'::text));



  create policy "Users can view knowledge base files in their organization"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'knowledge-base'::text) AND (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.knowledge_base_documents kbd
  WHERE ((kbd.file_path = objects.name) AND (kbd.organization_id = public.get_user_org(auth.uid()))))))));



  create policy "Chat members can upload attachments"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'chat-attachments'::text) AND (auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.team_chat_members tcm
  WHERE ((tcm.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] = (tcm.chat_id)::text))))));



  create policy "Chat members can view attachments"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'chat-attachments'::text) AND (auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.team_chat_members tcm
  WHERE ((tcm.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] = (tcm.chat_id)::text))))));



