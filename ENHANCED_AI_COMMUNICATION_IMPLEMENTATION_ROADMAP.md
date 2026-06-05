# Enhanced AI Communication System - Complete Implementation Roadmap

**Objective:** Implement all 7 enhancements to ensure NO LEADS FALL THROUGH CRACKS  
**Current Date:** January 17, 2026  
**Priority:** Smart Re-engagement, Qualification Scoring, Context Retention  
**Estimated Total Effort:** 6-8 weeks for complete implementation (80-120 development hours)

---

## Strategic Overview

### Why These 7 Enhancements?

Your system currently handles leads reactively (AI responds to messages). These enhancements make it **proactive**:

```
OLD FLOW (Reactive):
User sends message → AI responds → Wait for next user message → If no response... lead is lost

NEW FLOW (Proactive):
User sends message → AI responds (with context) → Track engagement → Auto-identify stalled leads 
→ Auto-re-engage or escalate → Dashboard alerts humans → Zero lead loss
```

### The "No Leads Fall Through" Strategy

**Three Defense Layers:**

| Layer | Enhancement | Purpose | Prevents |
|-------|-------------|---------|----------|
| **Depth** | AI Response Context (#1) + Lead Qualification (#3) | Understand each lead deeply | Confusion/repetition |
| **Continuity** | Smart Re-engagement (#4) + Message Handoff (#2) | Keep leads warm; escalate when needed | Abandonment/timeout |
| **Visibility** | Performance Monitoring (#7) + Qualification Dashboard | See every lead's status in real-time | Invisible stalls |

---

## Implementation Phases

### Phase 0: Database Foundation (Week 1)
**Goal:** Set up data structures for all 7 enhancements  
**Effort:** 16 hours  
**Owner:** Backend Engineer

**What Gets Built:**
1. Lead engagement tracking tables
2. Conversation metadata storage
3. Qualification score calculation system
4. Re-engagement campaign tracking
5. Performance metrics aggregation
6. Knowledge base versioning

**Deliverables:**
- [STEP 1] Database schema migrations
- [STEP 2] Supabase table setup
- [STEP 3] Index creation for performance
- [STEP 4] RLS policies for security

---

### Phase 1A: AI Response Context (#1) + Lead Qualification (#3) (Week 1-2)
**Goal:** Make AI smarter by understanding each lead's history and qualification level  
**Effort:** 24 hours  
**Owners:** Backend + AI Prompt Engineer  
**Priority:** CRITICAL (foundation for others)

**Core Changes:**
1. Track conversation patterns per lead
2. Extract key information automatically (budget, timeline, decision-maker)
3. Calculate live qualification score (0-100)
4. Auto-update lead status based on conversation

**Deliverables:**
- [STEP 5] Lead engagement profile tracker
- [STEP 6] Conversation metadata extractor
- [STEP 7] Qualification scoring system (0-100)
- [STEP 8] Lead status auto-updater
- [STEP 9] AI prompt enhancement for context

---

### Phase 1B: Smart Re-engagement (#4) (Week 2)
**Goal:** Automatically re-engage dormant leads before they're lost  
**Effort:** 20 hours  
**Owner:** Backend Engineer + AI Prompt  
**Priority:** CRITICAL (prevents lead loss)

**Core Changes:**
1. Identify leads silent for 48-72 hours
2. Generate personalized re-engagement messages
3. Schedule automatic sends
4. Track re-engagement results (A/B testing)
5. Escalate if no response after 2nd attempt

**Deliverables:**
- [STEP 10] Re-engagement trigger system
- [STEP 11] Smart re-engagement message generator
- [STEP 12] Campaign scheduler + executor
- [STEP 13] A/B testing framework
- [STEP 14] Escalation rules engine

---

### Phase 1C: Intelligent Message Handoff (#2) (Week 2-3)
**Goal:** Smooth transitions from AI to human agents with context  
**Effort:** 16 hours  
**Owner:** Backend Engineer + UI/UX  
**Priority:** HIGH (improves agent efficiency)

**Core Changes:**
1. Generate AI handoff summary on escalation
2. Auto-escalate when: AI can't answer, lead is qualified, sentiment drops, agent requested
3. Package handoff data (score, needs, objections, recommended action)
4. Create handoff dashboard for agents

**Deliverables:**
- [STEP 15] Handoff summary generator
- [STEP 16] Auto-escalation trigger system
- [STEP 17] Handoff data package builder
- [STEP 18] Agent handoff dashboard UI
- [STEP 19] Lead takeover improvements

---

### Phase 1D: Dynamic Knowledge Base (#5) (Week 3)
**Goal:** KB evolves based on conversation context and performance  
**Effort:** 12 hours  
**Owner:** Backend Engineer  
**Priority:** MEDIUM (improves answer quality)

**Core Changes:**
1. Load KB sections based on conversation context (not just keywords)
2. Track which KB articles convert best
3. Version control for pricing/availability updates
4. Feedback loop: AI learns which answers work

**Deliverables:**
- [STEP 20] Context-aware KB loader
- [STEP 21] KB article performance tracker
- [STEP 22] Dynamic KB ranking system
- [STEP 23] KB versioning & changelog

---

### Phase 2A: Burst Messaging Integration (#6) (Week 3-4)
**Goal:** Complete integration of multi-message, human-like responses  
**Effort:** 8 hours  
**Owner:** Backend Engineer  
**Priority:** HIGH (enhances conversation quality)

**Current Status:** ✅ burst-messaging.ts created, import added to social-webhook  
**Remaining Work:** Implement in processMessage() flow

**Deliverables:**
- [STEP 24] Implement sendBurstMessages() function
- [STEP 25] Update processMessage() to use burst handler
- [STEP 26] Add burst instruction to AI prompt
- [STEP 27] Test on all platforms (Messenger, WhatsApp, Instagram)

---

### Phase 2B: Performance & Response Monitoring (#7) (Week 4)
**Goal:** Real-time visibility into AI communication effectiveness  
**Effort:** 20 hours  
**Owner:** Backend Engineer + Data Analyst + Frontend  
**Priority:** MEDIUM (enables optimization)

**Core Changes:**
1. Track AI response quality metrics (speed, relevance, sentiment)
2. Monitor lead satisfaction (response rates, re-engagement success)
3. Identify underperforming topics/products
4. Create analytics dashboard
5. Alert system for problematic patterns

**Deliverables:**
- [STEP 28] Metrics aggregation system
- [STEP 29] Analytics dashboard UI
- [STEP 30] Alert rules & notifications
- [STEP 31] A/B testing analysis tools
- [STEP 32] Performance reporting endpoints

---

### Phase 3: Integration & Optimization (Week 5)
**Goal:** Connect all 7 enhancements into seamless system  
**Effort:** 16 hours  
**Owner:** Full Team  
**Priority:** HIGH (makes everything work together)

**Core Changes:**
1. Ensure all enhancements feed into each other
2. Optimize database queries across all new systems
3. Handle edge cases and error scenarios
4. Comprehensive testing (integration, performance, security)

**Deliverables:**
- [STEP 33] Full system integration testing
- [STEP 34] Performance optimization
- [STEP 35] Comprehensive error handling
- [STEP 36] Security audit & RLS policies

---

### Phase 4: Training & Launch (Week 6)
**Goal:** Team knows how to use new system  
**Effort:** 12 hours  
**Owner:** Product Manager + Training Team

**Deliverables:**
- [STEP 37] Agent training on new handoff dashboard
- [STEP 38] Admin guide for re-engagement campaigns
- [STEP 39] Monitoring dashboard walkthrough
- [STEP 40] Documentation & video tutorials

---

## Implementation Details by Enhancement

### Enhancement #1: AI Response Context Enhancement

**What Gets Tracked Per Lead:**
```json
{
  "lead_id": "123",
  "engagement_profile": {
    "communication_style": "quick_responses|detailed_info|visual|text",
    "response_speed": "avg_minutes",
    "topics_discussed": ["pricing", "availability", "features"],
    "abandoned_topics": ["custom_features"],
    "objections_raised": [
      { "topic": "pricing", "objection": "too_expensive", "resolution": "monthly_plan_suggested" }
    ],
    "product_interests": ["standard_room", "deluxe_suite"],
    "previous_offers_declined": ["discount_10pct"],
    "interaction_count": 12,
    "last_interaction": "2026-01-15T14:30:00Z"
  }
}
```

**New Conversation Context in AI Prompt:**
```
CONVERSATION HISTORY CONTEXT:
- This lead has discussed pricing 3 times (prefers monthly plans)
- Previously interested in: deluxe_suite (not contacted since)
- Objection: Price sensitive - suggest budget-friendly options
- Communication style: Prefers quick, bullet-point responses
- Last contact: 2 days ago about availability

Use this context to:
1. Avoid repeating previous answers
2. Anticipate objections
3. Match communication style
4. Continue from where conversation left off
```

**Database Tables Needed:**
```sql
CREATE TABLE lead_engagement_profiles (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  communication_style TEXT,
  response_speed_avg_minutes INTEGER,
  topics_discussed JSONB,
  abandoned_topics JSONB,
  objections_history JSONB,
  interaction_count INTEGER,
  last_interaction TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversation_metadata (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  lead_id UUID REFERENCES leads(id),
  topics_extracted JSONB,
  key_information JSONB,
  sentiment TEXT,
  confidence_score FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Code to Implement:**
1. `functions/ai-chat/context-loader.ts` - Load engagement context for each lead
2. `functions/ai-chat/metadata-extractor.ts` - Extract info from conversations
3. `hooks/useLeadEngagementProfile.ts` - Frontend hook for profile data

---

### Enhancement #3: Lead Qualification Score & Tracking

**Qualification Scoring Formula:**

```
QUALIFICATION SCORE (0-100) = 
  Budget Confirmed (0-25 pts)
  + Timeline Known (0-20 pts)
  + Decision-Maker Identified (0-15 pts)
  + Product Interest Level (0-20 pts)
  + Engagement Velocity (0-10 pts)
  + Positive Sentiment (0-10 pts)

Example:
Budget confirmed ($2000+) = 25 pts
Timeline: Within 30 days = 20 pts
Decision-maker: Yes = 15 pts
Product match: High = 20 pts
Responds within 2hrs = 10 pts
Positive sentiment = 10 pts
TOTAL = 100 pts → Ready for agent
```

**Lead Status Auto-Update Rules:**
```
Score 0-20:   Status = "new"         (not engaged yet)
Score 21-40:  Status = "contacted"   (engaged, exploring)
Score 41-70:  Status = "qualified"   (likely to convert, needs nurture)
Score 71-100: Status = "hot_lead"    (ready for agent, high priority)
```

**Database Tables Needed:**
```sql
CREATE TABLE lead_qualification_scores (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  score INTEGER,
  scoring_breakdown JSONB, -- {budget: 25, timeline: 20, ...}
  last_updated TIMESTAMP,
  status TEXT, -- new|contacted|qualified|hot_lead
  status_changed_at TIMESTAMP
);

CREATE TABLE qualification_events (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  event_type TEXT, -- budget_confirmed|timeline_known|decision_maker_identified
  event_value JSONB,
  score_impact INTEGER,
  created_at TIMESTAMP
);
```

**Code to Implement:**
1. `functions/_shared/qualification-engine.ts` - Calculate & update scores
2. `functions/social-webhook/score-updater.ts` - Extract info from messages
3. `components/LeadQualificationCard.tsx` - Show score in UI
4. `hooks/useLeadQualification.ts` - Frontend hook

---

### Enhancement #4: Smart Re-engagement Campaigns

**Re-engagement Logic:**

```
TRIGGER: Lead has no new messages for 48-72 hours
    AND Lead is not "booked" or "lost"
    AND Lead score > 20 (not completely unqualified)

STEP 1: Generate personalized re-engagement message
        (Based on last topic, objections, communication style)

STEP 2: Send message automatically (timing: evening/morning)

STEP 3: Wait 48 hours for response

STEP 4: If no response → Send 2nd re-engagement message
        (Different angle, offer something new)

STEP 5: Wait 48 hours

STEP 6: If still no response → Escalate to agent
        (Create task: "Follow up with {lead_name}")

STEP 7: Track engagement rate for A/B testing
        (Which messages get better responses?)
```

**Example Re-engagement Messages:**

| Scenario | Message | Purpose |
|----------|---------|---------|
| Budget objection | "We've been thinking about your budget concern... here's a flexible payment plan option" | Overcome objection |
| Time objection | "Your timeline (Feb) is coming up! Want to lock in your dates now?" | Create urgency |
| Feature interest | "Btw, you asked about our deluxe rooms - we just got photos!" | Resume abandoned topic |
| Generic silence | "Just checking in! Any other questions about your stay?" | Re-engage |

**Database Tables Needed:**
```sql
CREATE TABLE re_engagement_campaigns (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  campaign_type TEXT, -- budget_objection|time_objection|feature_interest|generic
  message_sent TEXT,
  sent_at TIMESTAMP,
  response_received BOOLEAN,
  response_time_minutes INTEGER,
  attempt_number INTEGER,
  escalated_to_agent BOOLEAN,
  created_at TIMESTAMP
);

CREATE TABLE re_engagement_templates (
  id UUID PRIMARY KEY,
  campaign_type TEXT,
  template_text TEXT,
  trigger_conditions JSONB,
  success_rate FLOAT,
  created_at TIMESTAMP
);
```

**Code to Implement:**
1. `functions/check-stalled-leads/index.ts` - Identify dormant leads (scheduled)
2. `functions/generate-reengagement-message/index.ts` - Create personalized message
3. `functions/send-reengagement-message/index.ts` - Execute send
4. `components/ReengagementCampaignDashboard.tsx` - Admin interface
5. `hooks/useReengagementCampaigns.ts` - Frontend hook

---

### Enhancement #2: Intelligent Message Handoff

**Auto-escalation Triggers:**

```
TRIGGER 1: AI Can't Answer
  - Confidence score < 0.4
  - Message contains phrase: "speak to human", "talk to agent"
  → ACTION: Generate handoff summary, escalate

TRIGGER 2: Lead is Hot
  - Qualification score > 80
  - Lead has confirmed budget + timeline
  → ACTION: Auto-offer agent call, package handoff

TRIGGER 3: Sentiment Drops
  - Sentiment: negative (frustration detected)
  - Multiple objections unresolved
  → ACTION: Escalate to senior agent

TRIGGER 4: Request for Agent
  - Message explicitly requests human
  → ACTION: Immediate escalation with full context
```

**Handoff Data Package:**

```json
{
  "lead_id": "123",
  "handoff_timestamp": "2026-01-17T14:30:00Z",
  "qualification_score": 78,
  "handoff_summary": "Sarah has budgeted $3000-4000, needs room for 4 guests arriving Feb 15-20. Concerned about parking availability. Very interested in deluxe suite but price-sensitive. Prefers email over calls. 5 interactions over 3 days, responds quickly.",
  "key_requirements": {
    "capacity": 4,
    "check_in": "2026-02-15",
    "check_out": "2026-02-20",
    "budget": "$3000-4000",
    "special_requests": "Accessible room"
  },
  "previous_objections": [
    { "objection": "parking_availability", "status": "unresolved" },
    { "objection": "price", "status": "discussed_options" }
  ],
  "recommended_action": "Offer deluxe suite with complimentary parking, send pricing proposal",
  "agent_notes": "Lead is highly qualified and ready to convert. Quick decision-maker."
}
```

**Database Tables Needed:**
```sql
CREATE TABLE handoff_events (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  trigger_reason TEXT, -- cant_answer|high_score|sentiment_drop|request_agent
  handoff_data JSONB,
  assigned_to_agent UUID REFERENCES auth.users(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP
);
```

**Code to Implement:**
1. `functions/_shared/handoff-generator.ts` - Create handoff summary
2. `functions/social-webhook/auto-escalation.ts` - Trigger escalation
3. `components/HandoffDashboard.tsx` - Agent view
4. `functions/ai-chat/escalation-detector.ts` - Detect escalation needs

---

### Enhancement #5: Dynamic Knowledge Base Integration

**Context-Aware KB Loading:**

```
CONVERSATION STATE:
  Lead: "We need a room for 4 people"
  
CONTEXT ANALYSIS:
  - Implicit need: "room" → Search KB for "room_types"
  - Implied requirement: "4 people" → Filter for capacity >= 4
  - Previous mention: User asked about "parking" → Load "parking_policy"

KB LOADING (Priority Order):
  1. Exact matches (room_types with capacity 4+)
  2. Related: amenities that families want
  3. Remember: parking_policy (previously interested)
  4. New: seasonal_rates (Jan 2026 pricing)

AI RECEIVES:
  "Here are room options for 4 people:
   - Family Suite (2 beds): $150/night, free parking
   - 2 Connect Rooms: $200/night, free parking
   We have safe parking for all vehicles."
```

**KB Performance Tracking:**

```
METRIC: KB_Article_Conversion_Rate
  Article: "Deluxe Room Features"
  Shown: 47 times
  Converted: 18 times
  Conversion Rate: 38.3%
  → High performing, always include

  Article: "Resort History"
  Shown: 34 times
  Converted: 1 time
  Conversion Rate: 2.9%
  → Low performing, use sparingly
```

**Database Tables Needed:**
```sql
CREATE TABLE knowledge_base_performance (
  id UUID PRIMARY KEY,
  kb_article_id UUID REFERENCES knowledge_base(id),
  shown_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  conversion_rate FLOAT,
  last_used TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE knowledge_base_versions (
  id UUID PRIMARY KEY,
  kb_article_id UUID REFERENCES knowledge_base(id),
  version_number INTEGER,
  content TEXT,
  changed_fields JSONB,
  reason TEXT,
  created_at TIMESTAMP
);
```

**Code to Implement:**
1. `functions/_shared/context-aware-kb-loader.ts` - Load KB intelligently
2. `functions/social-webhook/kb-performance-tracker.ts` - Track metrics
3. `functions/_shared/kb-ranker.ts` - Rank articles by performance

---

### Enhancement #7: Performance & Response Monitoring

**Key Metrics to Track:**

```
AI RESPONSE QUALITY:
  - Response time (should be 2-5 seconds)
  - Message clarity (can measure via subsequent questions)
  - Answer relevance (did response address question?)
  - Confidence score (AI's own assessment)

LEAD ENGAGEMENT:
  - Response rate (% of AI messages that get replies)
  - Time-to-response (how quickly does lead reply?)
  - Sentiment progression (getting more/less positive?)
  - Re-engagement success (% of dormant leads re-engaged)

CONVERSION METRICS:
  - Qualification score distribution
  - Score improvement over time
  - Handoff-to-booking rate
  - Time from first contact to booking
  - Revenue per lead

PRODUCT/TOPIC PERFORMANCE:
  - Which products get most interest?
  - Which topics cause objections?
  - Which KB articles drive conversions?
  - Which questions are asked most?
```

**Analytics Dashboard Sections:**

| Section | Metrics | Purpose |
|---------|---------|---------|
| **Lead Pipeline** | Total leads, by status, qualification scores | Overview health |
| **Engagement** | Response rates, re-engagement success, stalled leads | Identify risks |
| **AI Performance** | Response times, quality scores, sentiment, confidence | Optimize AI |
| **Conversions** | Booked, revenue, handoff success rate | Revenue impact |
| **A/B Testing** | Re-engagement message variants, subject lines | Optimization |

**Alert Rules:**

```
ALERT: High number of stalled leads
  Condition: > 5 leads with no response for 72+ hours
  Action: Notify manager, suggest re-engagement campaign

ALERT: AI quality issue
  Condition: Avg confidence score < 0.5 OR sentiment trending negative
  Action: Review recent AI responses, check knowledge base

ALERT: Lead dropout surge
  Condition: Last 24hrs conversions < 50% of 7-day avg
  Action: Check for technical issues, review recent changes

ALERT: Re-engagement campaign success
  Condition: Campaign conversion rate > 40%
  Action: Notify team, scale up campaign
```

**Database Tables Needed:**
```sql
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY,
  metric_type TEXT, -- response_time|confidence|sentiment|engagement_rate
  metric_value FLOAT,
  context JSONB,
  recorded_at TIMESTAMP
);

CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY,
  snapshot_date DATE,
  metrics JSONB,
  created_at TIMESTAMP
);

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  name TEXT,
  condition JSONB,
  alert_to_user_id UUID REFERENCES auth.users(id),
  enabled BOOLEAN,
  created_at TIMESTAMP
);
```

**Code to Implement:**
1. `functions/aggregrate-metrics/index.ts` - Collect metrics (scheduled)
2. `components/AnalyticsDashboard.tsx` - Main dashboard UI
3. `functions/alert-processor/index.ts` - Process alert rules
4. `hooks/useAnalytics.ts` - Frontend hook

---

## Database Schema Migration Plan

### Pre-Implementation Database Check

**Run these commands to see current schema:**
```bash
# List all tables
supabase db list tables

# Check existing lead tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name ILIKE 'lead%';
```

### New Tables to Create

```sql
-- 1. Lead Engagement Profiles
CREATE TABLE lead_engagement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  communication_style TEXT DEFAULT 'neutral',
  response_speed_avg_minutes INTEGER,
  topics_discussed JSONB DEFAULT '[]',
  abandoned_topics JSONB DEFAULT '[]',
  objections_history JSONB DEFAULT '[]',
  interaction_count INTEGER DEFAULT 0,
  last_interaction TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- 2. Conversation Metadata
CREATE TABLE conversation_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  topics_extracted JSONB DEFAULT '{}',
  key_information JSONB DEFAULT '{}',
  sentiment TEXT DEFAULT 'neutral',
  confidence_score FLOAT DEFAULT 0.5,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Lead Qualification Scores
CREATE TABLE lead_qualification_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  score INTEGER DEFAULT 0,
  scoring_breakdown JSONB DEFAULT '{}',
  status TEXT DEFAULT 'new',
  status_changed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- 4. Qualification Events
CREATE TABLE qualification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  event_type TEXT,
  event_value JSONB,
  score_impact INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Re-engagement Campaigns
CREATE TABLE re_engagement_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  campaign_type TEXT,
  message_sent TEXT,
  sent_at TIMESTAMP,
  response_received BOOLEAN DEFAULT FALSE,
  response_time_minutes INTEGER,
  attempt_number INTEGER DEFAULT 1,
  escalated_to_agent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Re-engagement Templates
CREATE TABLE re_engagement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  campaign_type TEXT,
  template_text TEXT,
  trigger_conditions JSONB DEFAULT '{}',
  success_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Handoff Events
CREATE TABLE handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  trigger_reason TEXT,
  handoff_data JSONB,
  assigned_to_agent UUID REFERENCES auth.users(id),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Knowledge Base Performance
CREATE TABLE knowledge_base_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kb_article_id UUID NOT NULL REFERENCES knowledge_base(id),
  shown_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  conversion_rate FLOAT DEFAULT 0,
  last_used TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(kb_article_id)
);

-- 9. Knowledge Base Versions
CREATE TABLE knowledge_base_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  kb_article_id UUID NOT NULL REFERENCES knowledge_base(id),
  version_number INTEGER,
  content TEXT,
  changed_fields JSONB,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Performance Metrics
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  metric_type TEXT,
  metric_value FLOAT,
  context JSONB DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- 11. Analytics Snapshots (Daily)
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  snapshot_date DATE,
  metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, snapshot_date)
);

-- 12. Alert Rules
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT,
  condition JSONB,
  alert_to_user_id UUID NOT NULL REFERENCES auth.users(id),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_lead_engagement_profiles_lead_id 
  ON lead_engagement_profiles(lead_id);
CREATE INDEX idx_lead_engagement_profiles_updated_at 
  ON lead_engagement_profiles(updated_at DESC);

CREATE INDEX idx_qualification_scores_lead_id 
  ON lead_qualification_scores(lead_id);
CREATE INDEX idx_qualification_scores_status 
  ON lead_qualification_scores(status);
CREATE INDEX idx_qualification_scores_score 
  ON lead_qualification_scores(score DESC);

CREATE INDEX idx_qualification_events_lead_id 
  ON qualification_events(lead_id);
CREATE INDEX idx_qualification_events_created_at 
  ON qualification_events(created_at DESC);

CREATE INDEX idx_re_engagement_campaigns_lead_id 
  ON re_engagement_campaigns(lead_id);
CREATE INDEX idx_re_engagement_campaigns_sent_at 
  ON re_engagement_campaigns(sent_at DESC);

CREATE INDEX idx_handoff_events_lead_id 
  ON handoff_events(lead_id);
CREATE INDEX idx_handoff_events_assigned_to_agent 
  ON handoff_events(assigned_to_agent);

CREATE INDEX idx_performance_metrics_metric_type 
  ON performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_recorded_at 
  ON performance_metrics(recorded_at DESC);

-- Set up RLS (Row Level Security)
ALTER TABLE lead_engagement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_qualification_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_engagement_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy Example (all tables follow this pattern)
CREATE POLICY "Users can view their organization's data"
  ON lead_engagement_profiles FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations 
    WHERE user_id = auth.uid()
  ));
```

---

## Implementation Sequence

### Week 1: Foundation (Phase 0 + 1A)

**STEP 1:** Create all database tables and migrations  
**STEP 2:** Deploy new RLS policies  
**STEP 3:** Implement lead engagement profile tracker  
**STEP 4:** Implement conversation metadata extractor  
**STEP 5:** Create qualification scoring engine  
**STEP 6:** Hook scoring into message processing  

**Verification:**
```bash
# Test 1: Send a message from test lead
# Check: lead_engagement_profiles row created
# Check: conversation_metadata row created
# Check: lead_qualification_scores updated

# Test 2: Verify AI receives context
# Check: Logs show engagement context loaded
# Check: AI prompt includes context
```

---

### Week 2: Re-engagement + Handoff (Phase 1B + 1C)

**STEP 7:** Create re-engagement trigger job (scheduled, runs every 12 hours)  
**STEP 8:** Implement re-engagement message generator  
**STEP 9:** Create campaign scheduler and executor  
**STEP 10:** Implement handoff summary generator  
**STEP 11:** Add auto-escalation triggers  
**STEP 12:** Create agent handoff dashboard  

**Verification:**
```bash
# Test 1: Create test lead, wait 72 hours (or trigger manually)
# Check: Re-engagement message sent automatically
# Check: Campaign tracked in database

# Test 2: Set high qualification score
# Check: Auto-escalate trigger fires
# Check: Agent receives handoff with context
```

---

### Week 3: Knowledge Base + Burst (Phase 1D + 2A)

**STEP 13:** Implement context-aware KB loader  
**STEP 14:** Create KB performance tracker  
**STEP 15:** Complete burst messaging integration  
**STEP 16:** Test burst on all platforms  

**Verification:**
```bash
# Test 1: Send message mentioning product
# Check: Relevant KB articles loaded
# Check: Performance stats updated

# Test 2: Send message that triggers burst
# Check: Multiple messages sent with delays
# Check: Timing between messages is 1-3 seconds
```

---

### Week 4: Monitoring (Phase 2B)

**STEP 17:** Create metrics aggregation system  
**STEP 18:** Build analytics dashboard UI  
**STEP 19:** Implement alert rules engine  
**STEP 20:** Create performance reporting endpoints  

**Verification:**
```bash
# Test 1: Check dashboard
# Verify: All metrics populated
# Verify: Charts rendering correctly

# Test 2: Trigger alert condition
# Verify: Alert sent to manager
# Verify: Alert logged in database
```

---

### Week 5: Integration (Phase 3)

**STEP 21:** Full system integration testing  
**STEP 22:** Performance optimization  
**STEP 23:** Comprehensive error handling  
**STEP 24:** Security audit  

---

### Week 6: Launch (Phase 4)

**STEP 25:** Agent training  
**STEP 26:** Documentation + videos  
**STEP 27:** Gradual rollout (start with 1 org, 10%)  
**STEP 28:** Monitor and iterate  

---

## Success Metrics

### Goal: No Leads Fall Through Cracks

| Metric | Target | Success Criteria |
|--------|--------|------------------|
| **Lead Response Rate** | 95% | 95% of qualified leads get AI response within 30min |
| **Re-engagement Rate** | 40%+ | 40%+ of stalled leads re-engaged by AI |
| **Escalation Accuracy** | 90%+ | 90%+ correct auto-escalations (score > 70) |
| **Handoff Quality** | 95%+ | 95%+ of agents find handoff helpful |
| **AI Confidence** | 75%+ avg | Average AI confidence score > 0.75 |
| **Time-to-Qualify** | < 3 days | Most leads reach "qualified" within 3 days |
| **Conversion Rate** | +20% increase | 20% improvement vs baseline |
| **Agent Efficiency** | +30% faster | Agents close leads 30% faster with context |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Database bloat** | Implement data retention policies (archive old metrics after 90 days) |
| **AI over-escalating** | Start with conservative thresholds, tune based on agent feedback |
| **Re-engagement spam** | Max 2 attempts per week, check lead preferences |
| **Privacy concerns** | Implement full RLS, mask PII in logs, audit access |
| **Performance degradation** | Add indexes, cache KB queries, batch metrics updates |

---

## Dependencies & Prerequisites

### Must Complete Before Starting:

- ✅ Burst messaging architecture (done)
- ⏳ Burst messaging integration in social-webhook (in progress)
- ⏳ Database access for migrations
- ⏳ Supabase schema review
- ⏳ AI prompt engineering review

### Team Requirements:

- **1 Backend Engineer** (primary)
- **1 Database Engineer** (schema design + optimization)
- **1 AI/Prompt Engineer** (enhance prompts with context)
- **1 Frontend Engineer** (dashboards + UI)
- **1 QA Engineer** (testing)
- **Product Manager** (requirements clarification)

---

## Next Steps

**IMMEDIATE ACTIONS:**

1. **Review this roadmap** - Team alignment on scope and timeline
2. **Approve database schema** - Finance/Security review
3. **Create GitHub milestones** - Week-by-week tracking
4. **Set up Supabase env** - Staging database for development
5. **Schedule kickoff** - Week 1 starts Monday

**Ready to begin Phase 0 (Database Foundation)?**

