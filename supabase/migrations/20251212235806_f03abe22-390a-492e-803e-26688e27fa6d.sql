-- ============================================
-- COMPREHENSIVE RLS POLICY ENHANCEMENTS
-- ============================================

-- 1. AI MESSAGES: Tighten to use is_assigned_to_lead for agents
DROP POLICY IF EXISTS "Org users view ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Users view authorized ai_messages" ON public.ai_messages;

CREATE POLICY "Users view authorized ai_messages" 
ON public.ai_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM ai_conversations c
    WHERE c.id = ai_messages.conversation_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      (has_role(auth.uid(), 'client_admin'::app_role) AND c.organization_id = get_user_org(auth.uid())) OR
      (has_role(auth.uid(), 'agent'::app_role) AND is_assigned_to_lead(auth.uid(), c.lead_id))
    )
  )
);

-- 2. COMMUNICATIONS: Add role-based restrictions for agents
DROP POLICY IF EXISTS "Users can view communications in their organization" ON public.communications;
DROP POLICY IF EXISTS "Users can create communications in their organization" ON public.communications;
DROP POLICY IF EXISTS "Users can update communications in their organization" ON public.communications;

-- Admins see all org communications, agents only see communications for their assigned leads
DROP POLICY IF EXISTS "Users view authorized communications" ON public.communications;

CREATE POLICY "Users view authorized communications" 
ON public.communications 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid())) OR
  (has_role(auth.uid(), 'agent'::app_role) AND organization_id = get_user_org(auth.uid()) AND 
    (lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id)))
);

-- Agents can only create communications for their assigned leads
DROP POLICY IF EXISTS "Users create authorized communications" ON public.communications;

CREATE POLICY "Users create authorized communications" 
ON public.communications 
FOR INSERT 
WITH CHECK (
  organization_id = get_user_org(auth.uid()) AND
  (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'client_admin'::app_role) OR
    (has_role(auth.uid(), 'agent'::app_role) AND (lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id)))
  )
);

-- Agents can only update communications for their assigned leads
DROP POLICY IF EXISTS "Users update authorized communications" ON public.communications;

CREATE POLICY "Users update authorized communications" 
ON public.communications 
FOR UPDATE 
USING (
  organization_id = get_user_org(auth.uid()) AND
  (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'client_admin'::app_role) OR
    (has_role(auth.uid(), 'agent'::app_role) AND (lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id)))
  )
);

-- 3. CALL LOGS: Tighten to assigned leads only for agents
DROP POLICY IF EXISTS "Org users view call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Users view authorized call logs" ON public.call_logs;

CREATE POLICY "Users view authorized call logs" 
ON public.call_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = call_logs.lead_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      (has_role(auth.uid(), 'client_admin'::app_role) AND l.organization_id = get_user_org(auth.uid())) OR
      (has_role(auth.uid(), 'agent'::app_role) AND l.assigned_agent_id = auth.uid())
    )
  )
);

-- 4. CHAT MESSAGES: Tighten to assigned leads only for agents
DROP POLICY IF EXISTS "Org users view lead chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users view authorized chat messages" ON public.chat_messages;

CREATE POLICY "Users view authorized chat messages" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = chat_messages.lead_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      (has_role(auth.uid(), 'client_admin'::app_role) AND l.organization_id = get_user_org(auth.uid())) OR
      (has_role(auth.uid(), 'agent'::app_role) AND l.assigned_agent_id = auth.uid())
    )
  )
);

-- 5. SOCIAL PLATFORMS: Ensure agents can view safe view but not manage
-- The "Admins view social_platforms" policy already restricts SELECT to admins only
-- Add a policy for agents to view via the safe view
DROP POLICY IF EXISTS "Agents view social_platforms_safe" ON public.social_platforms;

CREATE POLICY "Agents view social_platforms_safe" 
ON public.social_platforms 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid())
);

-- 6. AGENT PRIORITIES: Tighten agent viewing to their own org only with explicit check
DROP POLICY IF EXISTS "Org users view agent_priorities" ON public.agent_priorities;
DROP POLICY IF EXISTS "Users view authorized agent_priorities" ON public.agent_priorities;

CREATE POLICY "Users view authorized agent_priorities" 
ON public.agent_priorities 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid())) OR
  (has_role(auth.uid(), 'agent'::app_role) AND organization_id = get_user_org(auth.uid()) AND agent_id = auth.uid())
);

-- 7. KNOWLEDGE BASE: Tighten to role-based access (agents read-only, no management)
-- Already properly set up - agents can only SELECT, admins can manage

-- 8. MESSAGE TEMPLATES: Ensure agents can only use templates, not modify them  
-- Already properly set up via existing policies

-- 9. BOOKINGS: Add role-based restrictions for agents
DROP POLICY IF EXISTS "Users can view bookings in their organization" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings in their organization" ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings in their organization" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete bookings in their organization" ON public.bookings;

-- Agents can only view bookings for their assigned leads
DROP POLICY IF EXISTS "Users view authorized bookings" ON public.bookings;

CREATE POLICY "Users view authorized bookings" 
ON public.bookings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid())) OR
  (has_role(auth.uid(), 'agent'::app_role) AND organization_id = get_user_org(auth.uid()) AND is_assigned_to_lead(auth.uid(), lead_id))
);

DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;

CREATE POLICY "Admins manage bookings" 
ON public.bookings 
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
);

-- Agents can create/update bookings for their assigned leads
DROP POLICY IF EXISTS "Agents manage assigned lead bookings" ON public.bookings;

CREATE POLICY "Agents manage assigned lead bookings" 
ON public.bookings 
FOR ALL
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  is_assigned_to_lead(auth.uid(), lead_id)
)
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  is_assigned_to_lead(auth.uid(), lead_id)
);

-- 10. ORDERS: Add role-based restrictions for agents
DROP POLICY IF EXISTS "Users can view orders in their organization" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders in their organization" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders in their organization" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders in their organization" ON public.orders;

-- Agents can only view orders for their assigned leads
DROP POLICY IF EXISTS "Users view authorized orders" ON public.orders;

CREATE POLICY "Users view authorized orders" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid())) OR
  (has_role(auth.uid(), 'agent'::app_role) AND organization_id = get_user_org(auth.uid()) AND is_assigned_to_lead(auth.uid(), lead_id))
);

DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;

CREATE POLICY "Admins manage orders" 
ON public.orders 
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
);

-- Agents can create/update orders for their assigned leads
DROP POLICY IF EXISTS "Agents manage assigned lead orders" ON public.orders;

CREATE POLICY "Agents manage assigned lead orders" 
ON public.orders 
FOR ALL
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  is_assigned_to_lead(auth.uid(), lead_id)
)
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  is_assigned_to_lead(auth.uid(), lead_id)
);

-- 11. CALENDAR EVENTS: Add role-based restrictions
DROP POLICY IF EXISTS "Users can view calendar events in their organization" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can create calendar events in their organization" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update calendar events in their organization" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete calendar events in their organization" ON public.calendar_events;

-- Admins can view all org calendar events
DROP POLICY IF EXISTS "Admins view all calendar events" ON public.calendar_events;

CREATE POLICY "Admins view all calendar events" 
ON public.calendar_events 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
);

-- Agents can view their own events or events for their assigned leads
DROP POLICY IF EXISTS "Agents view authorized calendar events" ON public.calendar_events;

CREATE POLICY "Agents view authorized calendar events" 
ON public.calendar_events 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND
  (user_id = auth.uid() OR (related_lead_id IS NOT NULL AND is_assigned_to_lead(auth.uid(), related_lead_id)))
);

-- Admins manage all calendar events
DROP POLICY IF EXISTS "Admins manage calendar events" ON public.calendar_events;

CREATE POLICY "Admins manage calendar events" 
ON public.calendar_events 
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
);

-- Agents can manage their own events
DROP POLICY IF EXISTS "Agents manage own calendar events" ON public.calendar_events;

CREATE POLICY "Agents manage own calendar events" 
ON public.calendar_events 
FOR ALL
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND
  user_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND
  user_id = auth.uid()
);

-- 12. NOTIFICATION HISTORY: Add org-level checks
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notification_history;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notification_history;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notification_history;
DROP POLICY IF EXISTS "Users view own notifications" ON public.notification_history;

CREATE POLICY "Users view own notifications" 
ON public.notification_history 
FOR SELECT 
USING (
  auth.uid() = user_id AND
  (organization_id IS NULL OR organization_id = get_user_org(auth.uid()))
);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notification_history;

CREATE POLICY "Users update own notifications" 
ON public.notification_history 
FOR UPDATE 
USING (
  auth.uid() = user_id AND
  (organization_id IS NULL OR organization_id = get_user_org(auth.uid()))
);

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notification_history;

CREATE POLICY "Users delete own notifications" 
ON public.notification_history 
FOR DELETE 
USING (
  auth.uid() = user_id AND
  (organization_id IS NULL OR organization_id = get_user_org(auth.uid()))
);