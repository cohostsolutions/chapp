-- Drop existing agent-restrictive policies for call_logs
DROP POLICY IF EXISTS "Users view authorized call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents create call logs" ON public.call_logs;

-- Create new SELECT policy for call_logs
CREATE POLICY "Users view authorized call logs" 
ON public.call_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM leads l
    WHERE l.id = call_logs.lead_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (has_role(auth.uid(), 'client_admin'::app_role) AND l.organization_id = get_user_org(auth.uid()))
      OR (
        has_role(auth.uid(), 'agent'::app_role) 
        AND l.organization_id = get_user_org(auth.uid())
        AND (
          org_uses_shared_access(l.organization_id)
          OR l.assigned_agent_id = auth.uid()
        )
      )
    )
  )
);

-- Create new INSERT policy for call_logs
CREATE POLICY "Agents create call logs" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

-- Drop existing agent-restrictive policies for calendar_events
DROP POLICY IF EXISTS "Agents view authorized calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Agents manage own calendar events" ON public.calendar_events;

-- Create new SELECT policy for agents on calendar_events
CREATE POLICY "Agents view authorized calendar events" 
ON public.calendar_events 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    -- May/Cece orgs: agents see all calendar events in their org
    org_uses_shared_access(organization_id)
    -- Jay orgs: agents see own events or events for assigned leads
    OR user_id = auth.uid()
    OR (related_lead_id IS NOT NULL AND is_assigned_to_lead(auth.uid(), related_lead_id))
  )
);

-- Create new ALL policy for agents on calendar_events
DROP POLICY IF EXISTS "Agents manage authorized calendar events" ON public.calendar_events;

CREATE POLICY "Agents manage authorized calendar events" 
ON public.calendar_events 
FOR ALL 
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR user_id = auth.uid()
  )
);