/**
 * Enhanced AI Communication System - Database Query Examples & Testing Guide
 * Use these queries to verify functionality as you implement each enhancement
 * 
 * Location: docs/database-queries-examples.sql
 */

-- ============================================================================
-- TEST DATA SETUP
-- ============================================================================

-- Create test lead (if not exists)
INSERT INTO leads (id, organization_id, phone, email, name, status)
VALUES (
  'test-lead-001'::uuid,
  (SELECT id FROM organizations LIMIT 1),
  '+1234567890',
  'test@example.com',
  'Test Lead',
  'new'
) ON CONFLICT DO NOTHING;

-- Create test organization (if needed)
INSERT INTO organizations (name, subdomain)
VALUES ('Test Org', 'testorg-' || gen_random_uuid()::text)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ENHANCEMENT #1: AI Response Context Enhancement
-- Verify: Lead engagement profiles created and queries work
-- ============================================================================

-- Query 1: Insert engagement profile for test lead
INSERT INTO lead_engagement_profiles (
  organization_id,
  lead_id,
  communication_style,
  response_speed_avg_minutes,
  topics_discussed,
  abandoned_topics,
  interaction_count
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'test-lead-001'::uuid,
  'quick_responses',
  15,
  '["pricing", "availability"]'::jsonb,
  '["custom_features"]'::jsonb,
  5
) ON CONFLICT (lead_id) DO UPDATE SET
  interaction_count = lead_engagement_profiles.interaction_count + 1,
  updated_at = NOW();

-- Query 2: Retrieve engagement profile
SELECT 
  id,
  lead_id,
  communication_style,
  topics_discussed,
  interaction_count,
  updated_at
FROM lead_engagement_profiles
WHERE lead_id = 'test-lead-001'::uuid;

-- Expected: Returns 1 row with communication_style = 'quick_responses'

-- Query 3: Find all leads with abandoned topics
SELECT 
  lep.lead_id,
  lep.communication_style,
  lep.abandoned_topics,
  lep.interaction_count
FROM lead_engagement_profiles lep
WHERE lep.abandoned_topics::jsonb @> '"custom_features"'::jsonb
  AND lep.organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1);

-- Expected: Returns rows with abandoned topics

-- ============================================================================
-- ENHANCEMENT #3: Lead Qualification Score & Tracking
-- Verify: Qualification scores calculated and updated correctly
-- ============================================================================

-- Query 4: Insert initial qualification score
INSERT INTO lead_qualification_scores (
  organization_id,
  lead_id,
  score,
  scoring_breakdown,
  status
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'test-lead-001'::uuid,
  35,
  '{
    "budget_confirmed": 0,
    "timeline_known": 20,
    "decision_maker_identified": 15,
    "product_interest_level": 0
  }'::jsonb,
  'contacted'
) ON CONFLICT (lead_id) DO UPDATE SET
  score = 35,
  scoring_breakdown = '{
    "budget_confirmed": 0,
    "timeline_known": 20,
    "decision_maker_identified": 15,
    "product_interest_level": 0
  }'::jsonb,
  status = 'contacted',
  updated_at = NOW();

-- Query 5: Retrieve qualification score
SELECT 
  lead_id,
  score,
  scoring_breakdown,
  status,
  updated_at
FROM lead_qualification_scores
WHERE lead_id = 'test-lead-001'::uuid;

-- Expected: Returns 1 row with score = 35, status = 'contacted'

-- Query 6: Get all qualified leads (score > 40)
SELECT 
  lqs.lead_id,
  l.name,
  lqs.score,
  lqs.status,
  lqs.scoring_breakdown
FROM lead_qualification_scores lqs
JOIN leads l ON lqs.lead_id = l.id
WHERE lqs.score > 40
  AND lqs.organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
ORDER BY lqs.score DESC;

-- Expected: Returns qualified leads sorted by score

-- Query 7: Log a qualification event
INSERT INTO qualification_events (
  organization_id,
  lead_id,
  event_type,
  event_value,
  score_impact
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'test-lead-001'::uuid,
  'budget_confirmed',
  '{"budget": "$5000", "currency": "USD"}'::jsonb,
  25
);

-- Query 8: Get qualification events for a lead
SELECT 
  event_type,
  event_value,
  score_impact,
  created_at
FROM qualification_events
WHERE lead_id = 'test-lead-001'::uuid
ORDER BY created_at DESC;

-- Expected: Returns events in reverse chronological order

-- Query 9: Get status change history
SELECT 
  lead_id,
  status,
  score,
  status_changed_at
FROM lead_qualification_scores
WHERE lead_id = 'test-lead-001'::uuid
  AND status_changed_at IS NOT NULL
ORDER BY status_changed_at DESC;

-- Expected: Returns status changes with timestamps

-- ============================================================================
-- ENHANCEMENT #4: Smart Re-engagement
-- Verify: Dormant leads identified and campaigns tracked
-- ============================================================================

-- Query 10: Identify dormant leads (no activity for 72 hours)
-- First, create a function to find them:
CREATE OR REPLACE FUNCTION find_dormant_leads(
  p_org_id UUID,
  p_hours_inactive INTEGER DEFAULT 72
)
RETURNS TABLE(lead_id UUID, lead_name TEXT, last_message TIMESTAMP) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    (SELECT MAX(created_at) FROM communications WHERE lead_id = l.id AND direction = 'inbound') as last_msg
  FROM leads l
  LEFT JOIN lead_qualification_scores lqs ON l.id = lqs.lead_id
  WHERE l.organization_id = p_org_id
    AND (
      SELECT MAX(created_at)
      FROM communications
      WHERE lead_id = l.id AND direction = 'inbound'
    ) < NOW() - (p_hours_inactive || ' hours')::INTERVAL
    AND lqs.status NOT IN ('booked', 'lost')
  ORDER BY lqs.score DESC;
END;
$$ LANGUAGE plpgsql;

-- Usage:
SELECT * FROM find_dormant_leads((SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1), 48);

-- Expected: Returns leads with no inbound messages for 48+ hours

-- Query 11: Insert re-engagement campaign
INSERT INTO re_engagement_campaigns (
  organization_id,
  lead_id,
  campaign_type,
  message_sent,
  sent_at,
  attempt_number
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'test-lead-001'::uuid,
  'generic',
  'Hi Test Lead, just checking in! Any updates on your booking?',
  NOW(),
  1
);

-- Query 12: Get re-engagement campaign history
SELECT 
  campaign_type,
  message_sent,
  sent_at,
  response_received,
  attempt_number,
  escalated_to_agent
FROM re_engagement_campaigns
WHERE lead_id = 'test-lead-001'::uuid
ORDER BY sent_at DESC;

-- Expected: Returns campaign history with response tracking

-- Query 13: Get re-engagement success rate by campaign type
SELECT 
  campaign_type,
  COUNT(*) as total_sent,
  SUM(CASE WHEN response_received THEN 1 ELSE 0 END) as responses,
  ROUND(100.0 * SUM(CASE WHEN response_received THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate_pct
FROM re_engagement_campaigns
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
GROUP BY campaign_type
ORDER BY success_rate_pct DESC;

-- Expected: Returns success rates for each campaign type

-- Query 14: Get re-engagement templates with performance
SELECT 
  id,
  campaign_type,
  template_text,
  used_count,
  success_count,
  ROUND(success_rate * 100, 1) as success_rate_pct,
  enabled
FROM re_engagement_templates
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
ORDER BY success_rate DESC;

-- Expected: Returns templates ranked by success rate

-- ============================================================================
-- ENHANCEMENT #2: Intelligent Message Handoff
-- Verify: Handoff events logged with full context
-- ============================================================================

-- Query 15: Log handoff event
INSERT INTO handoff_events (
  organization_id,
  lead_id,
  trigger_reason,
  handoff_data
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'test-lead-001'::uuid,
  'high_score',
  '{
    "qualification_score": 82,
    "handoff_summary": "Test Lead is a hot prospect ready for agent call",
    "key_requirements": {"budget": "$5000", "timeline": "Feb 15"},
    "recommended_action": "Call to schedule consultation"
  }'::jsonb
);

-- Query 16: Get pending handoffs for agent
SELECT 
  id,
  lead_id,
  trigger_reason,
  handoff_data->>'handoff_summary' as summary,
  handoff_data->>'recommended_action' as action,
  created_at
FROM handoff_events
WHERE assigned_to_agent IS NULL
  AND completed = FALSE
  AND organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
ORDER BY created_at DESC;

-- Expected: Returns unassigned, incomplete handoffs

-- Query 17: Assign handoff to agent
UPDATE handoff_events
SET assigned_to_agent = (SELECT id FROM auth.users LIMIT 1)
WHERE id = (SELECT id FROM handoff_events WHERE lead_id = 'test-lead-001'::uuid ORDER BY created_at DESC LIMIT 1);

-- Query 18: Mark handoff as completed
UPDATE handoff_events
SET completed = TRUE, completed_at = NOW()
WHERE lead_id = 'test-lead-001'::uuid
  AND completed = FALSE;

-- Query 19: Get handoff metrics
SELECT 
  COUNT(*) as total_handoffs,
  SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN completed THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as completion_rate_pct,
  COUNT(DISTINCT trigger_reason) as trigger_types
FROM handoff_events
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1);

-- Expected: Returns handoff statistics

-- ============================================================================
-- ENHANCEMENT #5: Dynamic Knowledge Base Integration
-- Verify: KB article performance tracked
-- ============================================================================

-- Query 20: Track KB article usage
INSERT INTO knowledge_base_performance (
  organization_id,
  kb_article_id,
  shown_count,
  converted_count,
  conversion_rate,
  last_used
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  (SELECT id FROM knowledge_base LIMIT 1),
  10,
  4,
  0.4,
  NOW()
) ON CONFLICT (kb_article_id) DO UPDATE SET
  shown_count = knowledge_base_performance.shown_count + 1,
  last_used = NOW();

-- Query 21: Get top performing KB articles
SELECT 
  kp.kb_article_id,
  kb.title,
  kp.shown_count,
  kp.converted_count,
  ROUND(kp.conversion_rate * 100, 1) as conversion_rate_pct,
  kp.last_used
FROM knowledge_base_performance kp
JOIN knowledge_base kb ON kp.kb_article_id = kb.id
WHERE kp.organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
ORDER BY kp.conversion_rate DESC
LIMIT 10;

-- Expected: Returns top 10 articles by conversion rate

-- Query 22: Get low-performing articles (consider deprecating)
SELECT 
  kp.kb_article_id,
  kb.title,
  kp.shown_count,
  kp.conversion_rate,
  kp.last_used
FROM knowledge_base_performance kp
JOIN knowledge_base kb ON kp.kb_article_id = kb.id
WHERE kp.organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
  AND kp.shown_count > 5
  AND kp.conversion_rate < 0.1
ORDER BY kp.conversion_rate ASC;

-- Expected: Returns articles with >5 views but <10% conversion (deprecate candidates)

-- Query 23: Track KB article versions
INSERT INTO knowledge_base_versions (
  organization_id,
  kb_article_id,
  version_number,
  content,
  changed_fields,
  reason
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  (SELECT id FROM knowledge_base LIMIT 1),
  1,
  'New article content',
  '{"title": ["Old Title", "New Title"], "price": ["$99", "$79"]}'::jsonb,
  'Updated pricing for January promo'
);

-- Query 24: Get article version history
SELECT 
  version_number,
  changed_fields,
  reason,
  created_at
FROM knowledge_base_versions
WHERE kb_article_id = (SELECT id FROM knowledge_base LIMIT 1)
ORDER BY version_number DESC;

-- Expected: Returns version history with change tracking

-- ============================================================================
-- ENHANCEMENT #7: Performance & Response Monitoring
-- Verify: Metrics recorded and aggregated
-- ============================================================================

-- Query 25: Record performance metric
INSERT INTO performance_metrics (
  organization_id,
  metric_type,
  metric_value,
  context
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'response_time',
  2.5,
  '{"lead_id": "test-lead-001", "channel": "messenger"}'::jsonb
);

-- Query 26: Get average response time (last 7 days)
SELECT 
  ROUND(AVG(metric_value), 2) as avg_response_time_seconds,
  ROUND(MIN(metric_value), 2) as min_response_time,
  ROUND(MAX(metric_value), 2) as max_response_time,
  COUNT(*) as sample_count
FROM performance_metrics
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
  AND metric_type = 'response_time'
  AND recorded_at >= NOW() - INTERVAL '7 days';

-- Expected: Returns response time statistics

-- Query 27: Get metrics by type (last 24 hours)
SELECT 
  metric_type,
  COUNT(*) as count,
  ROUND(AVG(metric_value), 3) as avg_value,
  ROUND(MIN(metric_value), 3) as min_value,
  ROUND(MAX(metric_value), 3) as max_value
FROM performance_metrics
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
  AND recorded_at >= NOW() - INTERVAL '24 hours'
GROUP BY metric_type
ORDER BY count DESC;

-- Expected: Returns metrics aggregated by type

-- Query 28: Create daily snapshot
INSERT INTO analytics_snapshots (
  organization_id,
  snapshot_date,
  metrics
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  CURRENT_DATE,
  '{
    "total_leads": 150,
    "new_leads": 12,
    "qualified_leads": 45,
    "avg_response_time": 2.3,
    "avg_confidence": 0.78,
    "engagement_rate": 0.72,
    "re_engagement_success": 0.35
  }'::jsonb
) ON CONFLICT (organization_id, snapshot_date) DO UPDATE SET
  metrics = EXCLUDED.metrics;

-- Query 29: Get metric trends (last 30 days)
SELECT 
  snapshot_date,
  (metrics->>'total_leads')::int as total_leads,
  (metrics->>'qualified_leads')::int as qualified_leads,
  (metrics->>'avg_response_time')::float as avg_response_time,
  (metrics->>'engagement_rate')::float as engagement_rate
FROM analytics_snapshots
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
  AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY snapshot_date DESC;

-- Expected: Returns daily metrics for trend analysis

-- Query 30: Create alert rule
INSERT INTO alert_rules (
  organization_id,
  name,
  description,
  condition,
  alert_to_user_id,
  enabled
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  'High Stalled Leads',
  'Alert when >5 leads have no response for 72+ hours',
  '{
    "check": "dormant_leads_count",
    "operator": ">",
    "value": 5,
    "hours": 72
  }'::jsonb,
  (SELECT id FROM auth.users LIMIT 1),
  TRUE
);

-- Query 31: Get active alert rules
SELECT 
  id,
  name,
  description,
  condition,
  enabled
FROM alert_rules
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
  AND enabled = TRUE
ORDER BY created_at DESC;

-- Expected: Returns active alert rules

-- Query 32: Log alert history
INSERT INTO alert_history (
  organization_id,
  alert_rule_id,
  message,
  severity
) VALUES (
  (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1),
  (SELECT id FROM alert_rules WHERE name = 'High Stalled Leads' LIMIT 1),
  'Currently 7 leads with no response for 72+ hours',
  'high'
);

-- Query 33: Get unacknowledged alerts
SELECT 
  ah.id,
  ar.name,
  ah.message,
  ah.severity,
  ah.created_at
FROM alert_history ah
JOIN alert_rules ar ON ah.alert_rule_id = ar.id
WHERE ah.organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)
  AND ah.acknowledged = FALSE
ORDER BY ah.created_at DESC;

-- Expected: Returns unread alerts

-- Query 34: Acknowledge alert
UPDATE alert_history
SET acknowledged = TRUE, acknowledged_by = (SELECT id FROM auth.users LIMIT 1), acknowledged_at = NOW()
WHERE id = (SELECT id FROM alert_history WHERE acknowledged = FALSE LIMIT 1);

-- ============================================================================
-- COMPREHENSIVE HEALTH CHECK
-- Run this to verify all enhancements are functioning
-- ============================================================================

-- Query 35: Overall system health
SELECT 
  'Engagement Profiles' as system,
  COUNT(*) as count,
  MAX(updated_at) as last_update
FROM lead_engagement_profiles
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

UNION ALL

SELECT 'Qualification Scores', COUNT(*), MAX(updated_at)
FROM lead_qualification_scores
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

UNION ALL

SELECT 'Re-engagement Campaigns', COUNT(*), MAX(created_at)
FROM re_engagement_campaigns
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

UNION ALL

SELECT 'Handoff Events', COUNT(*), MAX(created_at)
FROM handoff_events
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

UNION ALL

SELECT 'KB Performance', COUNT(*), MAX(updated_at)
FROM knowledge_base_performance
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

UNION ALL

SELECT 'Performance Metrics', COUNT(*), MAX(recorded_at)
FROM performance_metrics
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

UNION ALL

SELECT 'Analytics Snapshots', COUNT(*), MAX(created_at)
FROM analytics_snapshots
WHERE organization_id = (SELECT id FROM organizations WHERE name = 'Test Org' LIMIT 1)

ORDER BY system;

-- Expected: All systems showing data with recent timestamps

-- ============================================================================
-- END OF TESTING GUIDE
-- Use these queries as you implement to verify functionality
-- ============================================================================

