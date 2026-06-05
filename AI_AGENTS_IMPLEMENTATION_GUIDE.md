# AI Agents Page - Implementation Guide for Fixes

## Overview
This guide provides specific code examples for implementing all identified issues.

---

## PHASE 1: CRITICAL FIXES (4-6 hours)

### Fix #1: Add Error Boundaries (15 minutes)

**File:** `src/pages/AIAgents.tsx`

**Current Code (Line 385):**
```tsx
<AITestChat onGetStarted={() => setLeadDialogOpen(true)} />
```

**Replace With:**
```tsx
<ErrorBoundary 
  fallback={
    <div className="max-w-2xl mx-auto p-6 text-center">
      <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/30">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Demo Temporarily Unavailable</h3>
        <p className="text-muted-foreground mb-4">
          We're having trouble loading the demo. Please try refreshing the page or contact support.
        </p>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
    </div>
  }
>
  <AITestChat onGetStarted={() => setLeadDialogOpen(true)} />
</ErrorBoundary>
```

**Required Imports:**
```tsx
import { AlertCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary'; // Check if exists
```

---

### Fix #2: Improve Error Handling in AITestChat (1-2 hours)

**File:** `src/components/landing/AITestChat.tsx`

**Current Code (Lines 196-207):**
```tsx
catch (error) {
  console.error('Demo AI error:', error);
  toast.error('Demo temporarily unavailable. Please try again.');
  // Remove the user message if we failed
  setMessages(messages);
}
```

**Replace With:**
```tsx
catch (error) {
  console.error('Demo AI error:', error);
  
  // Remove the user message since we failed to get a response
  setMessages(messages);
  
  // Determine error type and provide specific feedback
  let errorMessage = 'Demo temporarily unavailable. Please try again.';
  let showRetry = true;
  
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      errorMessage = 'Request took too long. Please try with a shorter message.';
    } else if (error.message.includes('rate')) {
      errorMessage = 'Too many requests. Please wait a moment before trying again.';
      showRetry = false;
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection.';
    }
  }
  
  toast.error(errorMessage);
  
  // Show retry UI if appropriate
  if (showRetry) {
    const retryMessage: Message = {
      id: `system-${Date.now()}`,
      role: 'assistant',
      content: `⚠️ ${errorMessage}\n\nYou can try again now.`,
    };
    setMessages(prev => [...prev, retryMessage]);
  }
}
```

**Also Add Offline Detection (Line 161):**
```tsx
const handleSend = async () => {
  // Check if user is online
  if (!navigator.onLine) {
    toast.error('Demo requires an internet connection');
    return;
  }
  
  if (!inputValue.trim() || hasReachedLimit || isTyping) return;
  // ... rest of code
```

---

### Fix #3: Fix Accessibility - Semantic HTML (1 hour)

**File:** `src/pages/AIAgents.tsx`

**Current Code (Lines 253-313) - Agent Cards:**
```tsx
<motion.div
  key={agent.name}
  initial={{ opacity: 0, y: 20 }}
  animate={cardsVisible ? { opacity: 1, y: 0 } : {}}
  transition={{ delay: index * 0.1, duration: 0.5 }}
  onClick={() => setSelectedAgent(agent)}  // ❌ DIV CLICK
  className={cn(
    "relative p-8 rounded-3xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
    // ...
  )}
>
```

**Replace With:**
```tsx
<motion.button
  key={agent.name}
  initial={{ opacity: 0, y: 20 }}
  animate={cardsVisible ? { opacity: 1, y: 0 } : {}}
  transition={{ delay: index * 0.1, duration: 0.5 }}
  onClick={() => setSelectedAgent(agent)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedAgent(agent);
    }
  }}
  aria-label={`Learn more about ${agent.name}, ${agent.role}`}
  aria-expanded={selectedAgent?.name === agent.name}
  className={cn(
    "relative p-8 rounded-3xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl text-left",
    agent.popular 
      ? `bg-card ${agent.borderColor} shadow-lg`
      : 'bg-card/50 border-border/50 hover:border-primary/30'
  )}
  type="button"
>
```

**Add to Chat Container (Line 313):**
```tsx
<div 
  ref={chatContainerRef} 
  className="p-3 sm:p-4 min-h-[220px] sm:min-h-[280px] max-h-[280px] sm:max-h-[350px] overflow-y-auto space-y-2 sm:space-y-3 bg-muted/20"
  role="log"
  aria-live="polite"
  aria-label="Chat messages"
>
```

**Fix Send Button (Line 395):**
```tsx
<button
  onClick={handleSend}
  disabled={!inputValue.trim() || hasReachedLimit || isTyping}
  aria-label="Send message"
  aria-disabled={!inputValue.trim() || hasReachedLimit || isTyping}
  className={cn(
    "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors shrink-0",
    inputValue.trim() && !hasReachedLimit && !isTyping
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "bg-muted text-muted-foreground"
  )}
>
  {isTyping ? (
    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
  ) : (
    <Send className="w-4 h-4" />
  )}
</button>
```

**Fix Language Selection Buttons:**
```tsx
{languages.map((lang) => (
  <button
    key={lang.code}
    onClick={() => setSelectedLanguage(lang.code)}
    aria-current={selectedLanguage === lang.code ? 'page' : undefined}
    aria-label={`Select ${lang.name}`}
    className={cn(
      "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-all duration-300",
      selectedLanguage === lang.code
        ? "bg-primary/20 text-primary font-medium ring-1 ring-primary/50"
        : "bg-muted/50 text-muted-foreground hover:bg-muted"
    )}
    type="button"
  >
    <span aria-hidden="true">{lang.flag}</span>
    <span className="hidden xs:inline sm:inline">{lang.name}</span>
  </button>
))}
```

---

### Fix #4: Add Analytics Tracking (1-2 hours)

**File:** `src/pages/AIAgents.tsx`

**Add Import at Top:**
```tsx
import { trackEvent } from '@/hooks/useAnalyticsTracking';
```

**Add Tracking to Agent Card Click (Line 263):**
```tsx
onClick={() => {
  trackEvent('ai_agent_selected', {
    agent: agent.name.toLowerCase(),
    from_page: 'ai_agents'
  });
  setSelectedAgent(agent);
}}
```

**Add Tracking to "Get Started" Button (Line 297):**
```tsx
onClick={(e) => {
  e.stopPropagation();
  trackEvent('agent_get_started_clicked', {
    agent: agent.name.toLowerCase(),
    location: 'agent_card'
  });
  setLeadDialogOpen(true);
}}
```

**Add Tracking to Hero CTA (Line 231-232):**
```tsx
<Button 
  size="xl" 
  variant="glow" 
  onClick={() => {
    trackEvent('demo_button_clicked', {
      location: 'hero_section'
    });
    setTestChatOpen(true);
  }}
>
  Try Live Demo
  <ArrowRight className="w-5 h-5 ml-2" />
</Button>

<Button 
  size="xl" 
  variant="outline" 
  asChild
  onClick={() => {
    trackEvent('pricing_link_clicked', {
      location: 'hero_section'
    });
  }}
>
  <Link to="/pricing">View Pricing</Link>
</Button>
```

**File:** `src/components/landing/AITestChat.tsx`

**Add Tracking to AI Selection (Line 190):**
```tsx
<button
  key={ai}
  onClick={() => {
    trackEvent('demo_ai_switched', {
      from: selectedAI,
      to: ai
    });
    setSelectedAI(ai);
  }}
  // ... rest of code
>
```

**Add Tracking to Language Selection (Line 230):**
```tsx
{languages.map((lang) => (
  <button
    key={lang.code}
    onClick={() => {
      if (selectedLanguage !== lang.code) {
        trackEvent('demo_language_changed', {
          from: selectedLanguage,
          to: lang.code,
          agent: selectedAI
        });
      }
      setSelectedLanguage(lang.code);
    }}
    // ... rest of code
  >
```

**Add Tracking to Message Send (Line 169):**
```tsx
const handleSend = async () => {
  if (!navigator.onLine) {
    toast.error('Demo requires an internet connection');
    return;
  }

  if (!inputValue.trim() || hasReachedLimit || isTyping) return;

  // Track message send
  trackEvent('demo_message_sent', {
    agent: selectedAI,
    language: selectedLanguage,
    messageLength: inputValue.trim().length,
    totalMessagesInSession: messages.length + 1
  });

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: inputValue.trim(),
  };
  // ... rest of code
```

**Add Tracking for Demo Limit Reached (Line 366):**
```tsx
{hasReachedLimit && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-4 text-center"
    onAnimationComplete={() => {
      trackEvent('demo_limit_reached', {
        agent: selectedAI,
        language: selectedLanguage
      });
    }}
  >
    <Button 
      variant="glow" 
      size="lg" 
      onClick={() => {
        trackEvent('demo_limit_cta_clicked', {
          agent: config.name.toLowerCase()
        });
        onGetStarted();
      }}
    >
      Get Started with {config.name}
    </Button>
  </motion.div>
)}
```

---

## PHASE 2: MEDIUM PRIORITY IMPROVEMENTS (4-5 hours)

### Fix #5: Preserve Language Selection on Agent Switch (30 minutes)

**File:** `src/components/landing/AITestChat.tsx`

**Current Code (Line 166):**
```tsx
useEffect(() => {
  setMessages([]);
  setKnowledgeBase(aiAgentConfig[selectedAI].defaultPrompt);
  setInputValue('');
}, [selectedAI, selectedLanguage]);
```

**Replace With:**
```tsx
useEffect(() => {
  // Show notification when switching agents
  if (messages.length > 0) {
    toast.info(`Switched to ${aiAgentConfig[selectedAI].name}. Chat history cleared.`);
  }
  
  setMessages([]);
  setKnowledgeBase(aiAgentConfig[selectedAI].defaultPrompt);
  setInputValue('');
  // Language is NOT reset - persists across agent switches
}, [selectedAI]); // Remove selectedLanguage from dependency
```

---

### Fix #6: Add Knowledge Base Validation (30 minutes)

**File:** `src/components/landing/AITestChat.tsx`

**Current Code (Line 259):**
```tsx
<Textarea
  value={knowledgeBase}
  onChange={(e) => setKnowledgeBase(e.target.value)}
  placeholder={`Enter information ${config.name} should know about your business...`}
  className="min-h-[60px] sm:min-h-[80px] text-xs sm:text-sm bg-muted/30"
/>
```

**Replace With:**
```tsx
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <label className="block text-xs sm:text-sm font-medium text-foreground">
      Knowledge Base (customize what {config.name} knows)
    </label>
    <span className={cn(
      "text-xs",
      knowledgeBase.length > 2000 ? "text-orange-500" : "text-muted-foreground"
    )}>
      {knowledgeBase.length}/2000
    </span>
  </div>
  <Textarea
    value={knowledgeBase}
    onChange={(e) => {
      const truncated = e.target.value.slice(0, 2000);
      setKnowledgeBase(truncated);
      if (truncated.length >= 1800) {
        toast.warning('Knowledge base is getting full (max 2000 chars)');
      }
    }}
    placeholder={`Enter information ${config.name} should know about your business...`}
    className={cn(
      "min-h-[60px] sm:min-h-[80px] text-xs sm:text-sm bg-muted/30",
      knowledgeBase.length > 2000 && "border-orange-500"
    )}
  />
  <p className="text-[10px] text-muted-foreground">
    Tip: Use clear sections like "Our products:", "Hours:", "Contact:" for better AI understanding
  </p>
</div>
```

---

### Fix #7: Add Offline Detection & Better Messaging (1 hour)

**File:** `src/components/landing/AITestChat.tsx`

**Add State & Effect:**
```tsx
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);
```

**Update handleSend:**
```tsx
const handleSend = async () => {
  if (!isOnline) {
    toast.error('Demo requires internet connection. Please check your connection.');
    return;
  }

  if (!inputValue.trim() || hasReachedLimit || isTyping) return;
  // ... rest
```

**Add Offline Indicator to Chat Header:**
```tsx
<div className={cn("flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-border", config.bgColor)}>
  <div className={cn(
    "w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br flex items-center justify-center",
    config.color
  )}>
    <config.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="font-semibold text-foreground text-sm sm:text-base">{config.name} AI</p>
    <p className={cn(
      "text-[10px] sm:text-xs",
      isOnline 
        ? "text-foreground/70" 
        : "text-orange-500 font-medium"
    )}>
      {isOnline 
        ? `Live Demo • ${MAX_AI_RESPONSES - aiResponseCount} responses left`
        : "⚠️ Offline - Chat unavailable"
      }
    </p>
  </div>
</div>
```

---

### Fix #8: Add Response Time Indicator (30 minutes)

**File:** `src/components/landing/AITestChat.tsx`

**Update Message Display (Line 342):**
```tsx
<AnimatePresence>
  {messages.map((message, idx) => (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-2",
        message.role === 'user' ? "justify-end" : "justify-start"
      )}
    >
      {message.role === 'assistant' && (
        <div className={cn(
          "w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0",
          config.color
        )}>
          <config.icon className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            "max-w-[75%] px-3 py-2 rounded-2xl text-sm",
            message.role === 'user'
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border text-foreground rounded-bl-md"
          )}
        >
          {message.role === 'assistant' 
            ? parseMessageContent(message.content)
            : message.content
          }
        </div>
        {message.role === 'assistant' && idx < messages.length - 1 && (
          <p className="text-[10px] text-muted-foreground px-3">
            {format(new Date(parseInt(message.id.split('-')[1])), 'HH:mm:ss')}
          </p>
        )}
      </div>
      {message.role === 'user' && (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  ))}
</AnimatePresence>
```

**Add import:**
```tsx
import { format } from 'date-fns';
```

---

## PHASE 3: ENHANCEMENT FEATURES (8-12 hours)

### Feature #9: Add Agent Comparison Table

**New File:** `src/components/landing/AgentComparisonTable.tsx`

```tsx
import { Bot, Utensils, Hotel, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonFeature {
  name: string;
  jay: string | boolean;
  may: string | boolean;
  cece: string | boolean;
}

const comparisonData: ComparisonFeature[] = [
  { name: 'Monthly Price', jay: '$299', may: '$249', cece: '$349' },
  { name: 'Lead Qualification', jay: true, may: false, cece: false },
  { name: 'Order Taking', jay: false, may: true, cece: false },
  { name: 'Booking Management', jay: false, may: false, cece: true },
  { name: 'Multi-Language', jay: true, may: true, cece: true },
  { name: 'Meta Integration', jay: true, may: true, cece: true },
  { name: 'Google Calendar', jay: true, may: true, cece: true },
  { name: 'Configurable Handoff Workflow', jay: true, may: false, cece: false },
  { name: '24/7 Availability', jay: true, may: true, cece: true },
];

export function AgentComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-4 font-semibold text-foreground">Features</th>
            <th className="text-center p-4 font-semibold text-primary">Jay</th>
            <th className="text-center p-4 font-semibold text-orange-500">May</th>
            <th className="text-center p-4 font-semibold text-emerald-500">Cece</th>
          </tr>
        </thead>
        <tbody>
          {comparisonData.map((row) => (
            <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30">
              <td className="p-4 text-foreground font-medium">{row.name}</td>
              <td className="p-4 text-center">
                {typeof row.jay === 'boolean' ? (
                  row.jay ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-300 mx-auto" />
                ) : (
                  <span className="font-semibold">{row.jay}</span>
                )}
              </td>
              <td className="p-4 text-center">
                {typeof row.may === 'boolean' ? (
                  row.may ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-300 mx-auto" />
                ) : (
                  <span className="font-semibold">{row.may}</span>
                )}
              </td>
              <td className="p-4 text-center">
                {typeof row.cece === 'boolean' ? (
                  row.cece ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-300 mx-auto" />
                ) : (
                  <span className="font-semibold">{row.cece}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Add to AIAgents.tsx after shared features section:**
```tsx
<section className="py-24">
  <div className="max-w-7xl mx-auto px-6">
    <div className="text-center mb-12">
      <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
        Agent Comparison
      </h2>
      <p className="text-muted-foreground max-w-2xl mx-auto">
        Choose the right AI agent for your business needs
      </p>
    </div>
    <div className="bg-card/50 rounded-2xl border border-border/50 overflow-hidden">
      <AgentComparisonTable />
    </div>
  </div>
</section>
```

---

## Testing & Validation

### Manual Testing Checklist

```typescript
// Before deploying, manually test:
1. ✅ Demo chat works with all 3 agents
2. ✅ Demo chat works with all 5 languages  
3. ✅ Rate limit triggers after 5 responses
4. ✅ "Get Started" button opens lead form
5. ✅ Lead form validates properly
6. ✅ Form submission succeeds
7. ✅ Keyboard navigation works (Tab through page)
8. ✅ Screen reader reads content (use NVDA/JAWS)
9. ✅ Mobile responsive (test at 375px, 768px, 1024px)
10. ✅ Offline mode shows appropriate message
11. ✅ Errors show specific messages (not generic)
12. ✅ Analytics events fire (check network tab in DevTools)
```

### Verification Commands

```bash
# Type check
npm run type-check

# Build test
npm run build

# Run tests
npm test

# Lighthouse audit
npm run build && npm run preview
# Then run Lighthouse in DevTools
```

---

## Summary of Code Changes

| Fix | File(s) | Lines Changed | Time |
|-----|---------|---------------|------|
| Error Boundary | AIAgents.tsx | 1 component wrap | 15 min |
| Error Handling | AITestChat.tsx | 20-30 lines | 30 min |
| Accessibility | Multiple | 40-50 lines | 60 min |
| Analytics | Multiple | 30-40 lines | 30 min |
| Language Persist | AITestChat.tsx | 10 lines | 15 min |
| Validation | AITestChat.tsx | 20 lines | 15 min |
| Offline Support | AITestChat.tsx | 15 lines | 15 min |
| Timestamps | AITestChat.tsx | 10 lines | 15 min |

**Total Phase 1 Time:** 4-5 hours  
**Total Phase 2 Time:** 4-5 hours  
**Total Phase 3 Time:** 8-12 hours

---

**Last Updated:** January 11, 2026  
**Ready to implement:** Yes  
**Dependencies:** None (all use existing libraries)
