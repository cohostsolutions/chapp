# Google Gemini Migration - Deployment Checklist

## Pre-Deployment (24 hours before)

### Code Review
- [ ] All 8 functions reviewed for API key references
- [ ] google-gemini.ts helper verified for retry logic
- [ ] Error handling paths tested
- [ ] Fallback responses validated
- [ ] Build passes: `npm run build` ✓

### Environment Preparation
- [ ] GOOGLE_API_KEY obtained from Google Cloud
- [ ] GOOGLE_API_KEY set in Supabase secrets
- [ ] Old LOVABLE_API_KEY kept in secure storage (30-day backup)
- [ ] `.env.example` updated locally
- [ ] Supabase connection verified

### Stakeholder Communication
- [ ] Team notified of migration plan
- [ ] Maintenance window communicated (if needed)
- [ ] Rollback contacts identified
- [ ] Monitoring team briefed

---

## Deployment Day

### Pre-Flight Checks (Morning)
- [ ] All source code committed to git
- [ ] Backup of current prod environment taken
- [ ] Database backups recent and verified
- [ ] Monitoring dashboards ready
- [ ] Team on standby

### Deployment Phase (Execute)
1. **Stage Functions**
   ```bash
   cd /workspaces/canvascapital
   supabase functions deploy
   ```
   - [ ] Command completed without errors
   - [ ] All 8 functions deployed
   - [ ] Deployment logs reviewed

2. **Update Environment**
   ```bash
   # Verify current secrets
   supabase secrets list
   
   # Update secrets
   supabase secrets set GOOGLE_API_KEY=your_google_api_key_here
   ```
   - [ ] GOOGLE_API_KEY set correctly
   - [ ] Verified in Supabase dashboard

3. **Verify Deployment**
   ```bash
   # Check function status
   supabase functions list
   
   # Tail logs for errors
   supabase functions logs generate-summary
   supabase functions logs ai-chat
   ```
   - [ ] All functions show status: "ACTIVE"
   - [ ] No error messages in logs
   - [ ] First few API calls succeed

### Smoke Testing (Post-Deployment)
- [ ] Test generate-summary function
  ```bash
  curl -X POST https://your-domain/functions/v1/generate-summary \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d '{...}'
  ```
  - [ ] Returns valid response
  - [ ] No timeout errors
  - [ ] Latency acceptable (~200ms)

- [ ] Test ai-chat function
  - [ ] Can send messages
  - [ ] Receives AI responses
  - [ ] Agent-specific temperatures work
  - [ ] Human escalation logic intact

- [ ] Test social-webhook
  - [ ] Facebook messages processed
  - [ ] Response times acceptable
  - [ ] No duplicate processing

- [ ] Test evaluate-training-session
  - [ ] Can evaluate sessions
  - [ ] Returns valid JSON evaluation
  - [ ] Score calculation correct

---

## Monitoring (First 24 Hours)

### Log Monitoring
- [ ] Check function logs every 2 hours
  ```bash
  supabase functions logs ai-chat --tail
  ```
- [ ] No timeout errors (>30s execution)
- [ ] No API key errors
- [ ] Retry logic activating appropriately
- [ ] Metrics logging appears in logs

### Performance Monitoring
- [ ] Response times: Should be 50-100ms faster
- [ ] Error rate: Should remain <1%
- [ ] API call volume: Normal or slightly increased
- [ ] Timeout occurrences: < 5 per 1000 calls

### Cost Monitoring
- [ ] Google Cloud console shows API usage
- [ ] Cost reduction ~50% vs. previous period
- [ ] No unexpected quota overages
- [ ] Token usage within estimates

### User Monitoring
- [ ] Chat responses working normally
- [ ] No user complaints about AI responses
- [ ] Lead follow-ups processing correctly
- [ ] Document processing completing on time

---

## Post-Deployment (After 24 Hours)

### Analysis & Validation
- [ ] Review 24-hour metrics
  - [ ] Latency improvement measured
  - [ ] Cost reduction calculated
  - [ ] Error rates acceptable
  - [ ] Retry effectiveness validated

- [ ] Compare with baseline
  ```
  Metric                Before    After    Expected
  ─────────────────────────────────────────────
  Avg Response (ms)     150-200   50-100   ✓
  Cost per 1k calls     $0.53     $0.41    ✓
  Error Rate (%)        0.8%      <0.8%    ✓
  Timeout Errors        ~5        <5       ✓
  ```

- [ ] Verify all edge cases
  - [ ] Large document processing
  - [ ] Multiple concurrent requests
  - [ ] Network error recovery
  - [ ] Rate limit handling

### Cleanup Tasks
- [ ] Remove old Lovable references from docs
- [ ] Update deployment documentation
- [ ] Update on-call runbooks
- [ ] Archive old audit files (optional)
- [ ] Schedule 30-day LOVABLE_API_KEY removal

---

## Incident Response (If Issues Occur)

### Symptom: API Errors or Timeouts
1. Check logs:
   ```bash
   supabase functions logs ai-chat --tail
   ```
2. Verify GOOGLE_API_KEY is set:
   ```bash
   supabase secrets list | grep GOOGLE_API_KEY
   ```
3. Check Google Cloud quotas (console.cloud.google.com)
4. If critical: Rollback to Lovable (see rollback plan)

### Symptom: Slow Responses
1. Monitor latency in logs
2. Check if retry logic is over-activating
3. Verify timeout values in GeminiCallOptions
4. Check Google Cloud API performance status

### Symptom: High Error Rate
1. Review error messages in logs
2. Check Google Cloud API status
3. Verify fallback responses triggering correctly
4. If >5% errors: Execute rollback

### Rollback Procedure (If Needed)
```bash
# 1. Revert environment variable
supabase secrets unset GOOGLE_API_KEY
supabase secrets set LOVABLE_API_KEY=your_lovable_key

# 2. Redeploy old functions (from git history)
git revert HEAD --no-commit
git commit -m "Rollback to Lovable gateway"

# 3. Deploy reverted code
supabase functions deploy

# 4. Notify team & close incident
```

Expected rollback time: ~10 minutes
Expected impact: Minimal if executed within 2 hours of detection

---

## Post-Rollback (If Executed)

- [ ] All systems operating normally
- [ ] Revert to old API key in production
- [ ] Schedule post-incident review
- [ ] Document issues encountered
- [ ] Fix identified issues before retry
- [ ] Plan next migration attempt

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | |
| QA Lead | | | |
| DevOps | | | |
| Project Manager | | | |
| Team Lead | | | |

---

## Notes

**Deployment Time**: ~15 minutes (functions deploy + smoke tests)

**Rollback Time**: ~10 minutes (git revert + redeploy)

**Monitoring Duration**: 48 hours (initial), 7 days (extended observation)

**Success Criteria**:
- ✅ All 8 functions using Google API
- ✅ No timeout errors (< 5 per 1000 calls)
- ✅ Response times 50% faster
- ✅ Cost reduction verified
- ✅ Zero user-visible impact
- ✅ All metrics logged properly

**Schedule Next Review**: 7 days post-deployment for final validation
