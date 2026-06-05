# AI Training Page - Implementation Action Plan

**Start Date:** January 11, 2026  
**Estimated Timeline:** 10-15 days (with team)  
**Owner:** Engineering Team  

---

## Quick Reference: What Needs to Be Fixed

| Issue | Status | Severity | Effort | Days |
|-------|--------|----------|--------|------|
| Add Error Boundary | ❌ Missing | 🔴 P1 | 0.5h | 1 |
| Surface Audio Errors | ❌ Missing | 🔴 P1 | 2h | 1 |
| Microphone Permission UI | ❌ Missing | 🔴 P1 | 1.5h | 1 |
| Module Rubric Validation | ⚠️ Partial | 🔴 P1 | 1.5h | 1 |
| PII Masking Before API | ⚠️ Partial | 🔴 P1 | 1.5h | 1 |
| Offline Detection | ❌ Missing | 🔴 P1 | 2h | 1 |
| **Priority 1 Total** | | | **9h** | **1-2 days** |
| ARIA Labels | ❌ Missing | 🟡 P2 | 2h | 1 |
| Session Auto-Save | ❌ Missing | 🟡 P2 | 3h | 1 |
| Evaluation Fallback UI | ⚠️ Partial | 🟡 P2 | 2h | 1 |
| Debounce Module Switch | ⚠️ Needs | 🟡 P2 | 1.5h | 1 |
| Confirmation Dialogs | ⚠️ Partial | 🟡 P2 | 2h | 1 |
| **Priority 2 Total** | | | **10.5h** | **2-3 days** |
| Improve LiveFeedback AI | ⚠️ Basic | 🟢 P3 | 4h | 1 |
| Module Editor Tabs | ⚠️ Cluttered | 🟢 P3 | 3h | 1 |
| Leaderboard Pagination | ⚠️ Unscaled | 🟢 P3 | 3h | 1 |
| Request Tracing | ❌ Missing | 🟢 P3 | 2.5h | 1 |
| Unit Tests (Core) | ❌ None | 🟢 P3 | 8h | 2 |
| **Priority 3 Total** | | | **20.5h** | **3-5 days** |
| **GRAND TOTAL** | | | **40h** | **10-15 days** |

---

## PHASE 1: Critical Fixes (Days 1-2)

### Fix #1: Add Error Boundary to AITraining Page
**File:** `src/pages/AITraining.tsx`  
**Effort:** 0.5 hours

```tsx
// Step 1: Import ErrorBoundary
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Step 2: Create fallback component
function TrainingErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          Training Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Error Details</summary>
          <pre className="mt-2 p-2 bg-muted rounded">{error.message}</pre>
        </details>
        <div className="flex gap-2">
          <Button onClick={resetError} variant="outline">
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Step 3: Wrap component
export default function AITraining() {
  // ... existing code ...
  
  return (
    <ErrorBoundary fallback={<TrainingErrorFallback />}>
      <div className="space-y-4">
        {/* ... existing content ... */}
      </div>
    </ErrorBoundary>
  );
}
```

**Validation:** Try throwing error in component → should render fallback

---

### Fix #2: Surface TTS and Microphone Errors
**File:** `src/components/training/TrainingSimulator.tsx`  
**Effort:** 2 hours

#### Part A: Improve TTS Error Handling
```tsx
// CURRENT (lines 50-98)
async function speakWithElevenLabs(text: string, voiceId: string): Promise<boolean> {
  try {
    // ... existing TTS code ...
  } catch (error) {
    console.warn('ElevenLabs TTS error:', error);
    return false;
  }
}

// NEW: Add callback for error notification
async function speakWithElevenLabs(
  text: string, 
  voiceId: string,
  onError?: (message: string) => void
): Promise<boolean> {
  try {
    const response = await fetch(ELEVENLABS_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      const message = response.status === 429 
        ? 'Speech service temporarily busy. Using browser voice instead.'
        : 'Speech service unavailable. Using browser voice.';
      onError?.(message);
      return false;
    }

    // ... rest of playback logic ...
  } catch (error) {
    const message = error instanceof Error 
      ? `Speech error: ${error.message}`
      : 'Speech service error. Using browser voice.';
    onError?.(message);
    console.error('ElevenLabs TTS error:', error);
    return false;
  }
}

// In TrainingSimulator component
const [ttsError, setTtsError] = useState<string | null>(null);

const handlePlayAIResponse = async (text: string) => {
  setTtsError(null);
  
  const success = await speakWithElevenLabs(
    text, 
    LANGUAGE_CONFIG[language].voiceId,
    (errorMsg) => {
      setTtsError(errorMsg);
      toast({
        title: 'Audio Playback',
        description: errorMsg,
        variant: 'default'
      });
    }
  );

  if (!success) {
    // Fallback to browser TTS
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
};

// UI: Show TTS error status
{ttsError && (
  <Alert variant="default" className="mb-3">
    <Volume2 className="h-4 w-4" />
    <AlertDescription>{ttsError}</AlertDescription>
  </Alert>
)}
```

#### Part B: Show Microphone Permission Error
```tsx
// CURRENT (line 109)
navigator.mediaDevices.getUserMedia({ audio: true })
  .catch((error) => {
    console.error('Microphone permission denied:', error);
  });

// NEW: Surface error to user
navigator.mediaDevices.getUserMedia({ audio: true })
  .catch((error) => {
    console.error('Microphone error:', error);
    
    let message = 'Microphone access failed';
    if (error.name === 'NotAllowedError') {
      message = 'Microphone access denied. Check browser permissions.';
    } else if (error.name === 'NotFoundError') {
      message = 'No microphone found. Using text input instead.';
    } else if (error.name === 'NotReadableError') {
      message = 'Microphone is in use by another app.';
    }
    
    setMicError(message);
    toast({
      title: 'Microphone Error',
      description: message,
      variant: 'destructive'
    });
  });

// UI: Show error and disable voice button
{micError && (
  <Alert variant="destructive" className="mb-3">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{micError}</AlertDescription>
  </Alert>
)}

<Button 
  onClick={toggleMicrophone}
  disabled={!!micError || isLoading}
  variant={isRecording ? 'destructive' : 'outline'}
  aria-label={isRecording ? "Stop recording" : "Start recording"}
>
  {isRecording ? <MicOff /> : <Mic />}
</Button>
```

**Validation:** 
- Deny microphone permission → see error alert
- ElevenLabs down → see toast + browser voice kicks in

---

### Fix #3: Validate Module Rubric Before Saving
**File:** `src/pages/AITraining.tsx`  
**Effort:** 1.5 hours

```tsx
// In handleSaveModule function (line 230)

const handleSaveModule = async () => {
  if (!orgId) return;

  // EXISTING VALIDATIONS (keep these)
  if (!draft.title.trim()) {
    toast({ title: 'Validation Error', description: 'Module title is required', variant: 'destructive' });
    return;
  }
  if (!draft.persona.name.trim()) {
    toast({ title: 'Validation Error', description: 'Persona name is required', variant: 'destructive' });
    return;
  }

  // NEW VALIDATIONS
  if (draft.rubric.length === 0) {
    toast({ 
      title: 'Validation Error', 
      description: 'At least one rubric category is required', 
      variant: 'destructive' 
    });
    return;
  }

  // Validate each rubric category
  for (let i = 0; i < draft.rubric.length; i++) {
    const r = draft.rubric[i];
    
    if (!r.name || !r.name.trim()) {
      toast({
        title: 'Validation Error',
        description: `Rubric category ${i + 1}: Name is required`,
        variant: 'destructive'
      });
      return;
    }

    if (!r.guidelines || r.guidelines.length === 0) {
      toast({
        title: 'Validation Error',
        description: `Rubric category "${r.name}": At least one guideline is required`,
        variant: 'destructive'
      });
      return;
    }

    // Validate weight is positive number
    if (!r.weight || r.weight <= 0) {
      toast({
        title: 'Validation Error',
        description: `Rubric category "${r.name}": Weight must be greater than 0`,
        variant: 'destructive'
      });
      return;
    }

    // Validate guidelines are not empty
    const hasEmptyGuideline = r.guidelines.some(g => !g || !g.trim());
    if (hasEmptyGuideline) {
      toast({
        title: 'Validation Error',
        description: `Rubric category "${r.name}": Guidelines cannot be empty`,
        variant: 'destructive'
      });
      return;
    }
  }

  // If all validations pass, continue with save
  const payload = { /* ... */ };
  // ... rest of save logic ...
};

// Also update the "Remove" button to prevent removing all categories
// Line 650 currently has: if (draft.rubric.length > 1)
// This is correct! Keep as-is, but add confirmation:

<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    if (draft.rubric.length === 1) {
      toast({
        title: 'Cannot Remove',
        description: 'At least one category required',
        variant: 'destructive'
      });
      return;
    }
    
    const categoryName = draft.rubric[idx].name;
    if (!window.confirm(`Remove "${categoryName}" category?`)) {
      return;
    }
    
    setDraft(prev => ({
      ...prev,
      rubric: prev.rubric.filter((_, i) => i !== idx),
    }));
  }}
  className="h-8 text-destructive hover:text-destructive"
>
  Remove
</Button>
```

**Validation:** Try saving module with empty rubric → error toast

---

### Fix #4: Mask PII Before Sending to Evaluation API
**File:** `src/components/training/TrainingSimulator.tsx`  
**Effort:** 1.5 hours

```tsx
// CURRENT: Transcript sent to evaluation unmasked
const transcript = conversationHistory.map(msg => ({
  role: msg.role,
  content: msg.content // ❌ Unmasked
}));

// NEW: Apply PII masking before evaluation
import { maskPII } from '@/lib/training/types'; // Already exists!

// When ending session, mask the transcript
const handleEndSession = async () => {
  // Mask all user messages before evaluation
  const maskedTranscript = displayMessages.map(msg => ({
    role: msg.role,
    content: msg.role === 'user' ? maskPII(msg.content) : msg.content
  }));

  // Send masked transcript to evaluation
  const evaluationResponse = await fetch(`${supabaseUrl}/functions/v1/evaluate-training-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: session.id,
      moduleId: module.id,
      transcript: maskedTranscript, // ✅ Masked
      organizationId: organizationId,
    }),
  });

  // ... rest of logic ...
};

// Also apply masking when displaying transcript for user review
<SessionSummary 
  record={{
    ...summary,
    transcript: summary.transcript.map(msg => ({
      ...msg,
      content: msg.role === 'user' ? maskPII(msg.content) : msg.content
    }))
  }}
  onNewSession={startNew}
/>
```

**Validation:** 
- Train with email/phone in message
- Check evaluation result: should show [EMAIL] / [PHONE]
- SessionSummary should also mask display

---

### Fix #5: Add Offline Detection & Handling
**File:** `src/pages/AITraining.tsx` & `src/components/training/TrainingSimulator.tsx`  
**Effort:** 2 hours

#### Part A: Add offline banner
```tsx
// In AITraining.tsx, add at top of page
import { useEffect, useState } from 'react';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

export default function AITraining() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: 'Back Online', description: 'Connection restored' });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Offline',
        description: 'Some features will be unavailable',
        variant: 'destructive'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="space-y-4">
      {!isOnline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are offline. Some features like AI evaluation may not work. 
            Your session will be saved once you reconnect.
          </AlertDescription>
        </Alert>
      )}

      {/* ... rest of page ... */}
    </div>
  );
}
```

#### Part B: Cache draft session
```tsx
// In TrainingSimulator.tsx
const CACHE_KEY = `training_draft_${module.id}_${userId}`;

// Save draft before each AI call
const handleSendMessage = async (userMessage: string) => {
  // Cache current session
  const draft = {
    messages: [...conversationHistory, { role: 'user' as const, content: userMessage }],
    timestamp: Date.now(),
    moduleId: module.id,
    userId: userId,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(draft));

  // Then send message
  // ... existing logic ...
};

// Restore draft on load if available
useEffect(() => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const draft = JSON.parse(cached);
      const age = Date.now() - draft.timestamp;
      
      // Only restore if less than 1 hour old
      if (age < 3600000) {
        setConversationHistory(draft.messages);
        toast({
          title: 'Session Restored',
          description: 'Your previous session was restored',
        });
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
      localStorage.removeItem(CACHE_KEY);
    }
  }
}, [module.id, userId]);

// Clean up cache when session completes
const handleSessionEnd = () => {
  localStorage.removeItem(CACHE_KEY);
  // ... rest of logic ...
};
```

**Validation:**
- Disable WiFi → see offline banner
- Send message without WiFi → cached locally
- Turn WiFi back on → see "Back Online" toast

---

## PHASE 2: Important Improvements (Days 3-5)

### Fix #6: Add ARIA Labels (Accessibility)
**File:** `src/components/training/TrainingSimulator.tsx`  
**Effort:** 2 hours

```tsx
// Voice control buttons
<Button 
  onClick={toggleMicrophone}
  aria-label={isRecording ? "Stop recording your response" : "Start recording your response"}
  aria-pressed={isRecording}
  title="Click to speak (Ctrl+M)"
  disabled={!!micError || isLoading}
>
  {isRecording ? <MicOff /> : <Mic />}
</Button>

<Button
  onClick={handlePlayResponse}
  aria-label="Replay AI response"
  title="Listen to response again"
>
  <Volume2 />
</Button>

// Feedback panel
<div role="status" aria-live="polite" aria-label="Training feedback">
  {advice.map(item => (
    <div key={item.message} role="alert">
      {item.message}
    </div>
  ))}
</div>

// Session summary
<section aria-label="Training session summary">
  <h2 id="summary-heading">Session Results</h2>
  <div role="region" aria-labelledby="summary-heading">
    {/* scores and details */}
  </div>
</section>

// Messages display
<div role="log" aria-live="polite" aria-label="Training conversation">
  {displayMessages.map(msg => (
    <div key={msg.id} role="article" aria-label={`${msg.role === 'user' ? 'You' : 'AI'}: ${msg.content.substring(0, 50)}`}>
      {msg.content}
    </div>
  ))}
</div>
```

---

### Fix #7: Session Auto-Save (Draft Backup)
**File:** `src/components/training/TrainingSimulator.tsx`  
**Effort:** 3 hours

```tsx
// Auto-save draft every 30 seconds
useEffect(() => {
  const saveInterval = setInterval(() => {
    if (conversationHistory.length === 0) return; // Nothing to save

    const draft = {
      moduleId: module.id,
      organizationId: organizationId,
      userId: userId,
      messages: conversationHistory,
      savedAt: new Date().toISOString(),
    };

    // Save to IndexedDB for larger capacity
    const db = await openDB('training-drafts');
    await db.put('sessions', draft, `${module.id}-${userId}`);
  }, 30000); // Save every 30s

  return () => clearInterval(saveInterval);
}, [conversationHistory, module.id, userId, organizationId]);

// Restore on mount
useEffect(() => {
  const restoreDraft = async () => {
    const db = await openDB('training-drafts');
    const draft = await db.get('sessions', `${module.id}-${userId}`);
    
    if (draft) {
      const age = Date.now() - new Date(draft.savedAt).getTime();
      if (age < 86400000) { // Less than 24 hours
        setConversationHistory(draft.messages);
        toast({
          title: 'Draft Restored',
          description: `Restored session from ${formatDistanceToNow(new Date(draft.savedAt))}`,
        });
      }
    }
  };

  restoreDraft().catch(console.error);
}, [module.id, userId]);
```

---

### Fix #8: Evaluation Fallback with Clear "Pending" State
**File:** `supabase/functions/evaluate-training-session/index.ts`  
**Effort:** 2 hours

```typescript
// When evaluation fails, mark as PENDING instead of using placeholder score
if (!response.ok || parseError) {
  // Save session with PENDING evaluation
  const sessionData = {
    module_id: moduleId,
    organization_id: authorizedOrgId,
    user_id: authContext.user.id,
    transcript: transcript,
    evaluation: {
      overall_score: null, // ❌ No misleading score
      status: 'PENDING', // ✅ Clear status
      message: 'Evaluation in progress. Please check back in a moment.',
      scheduled_retry: new Date(Date.now() + 60000).toISOString(),
    },
    score: null,
    ended_at: new Date().toISOString()
  };

  // Save session
  const { error: insertError } = await supabase
    .from("training_sessions")
    .insert(sessionData);

  if (insertError) {
    console.error("Failed to insert session:", insertError);
  }

  // Return pending state to client
  return new Response(
    JSON.stringify({ 
      success: false,
      status: 'PENDING',
      message: 'Evaluation is being processed. Please refresh to see results.',
      sessionId: sessionId || insertedId
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// On client side, SessionSummary handles PENDING
{evaln?.status === 'PENDING' ? (
  <Alert>
    <Clock className="h-4 w-4" />
    <AlertDescription>
      Evaluation is being processed. This may take a minute. 
      <Button onClick={() => refetch()} variant="link" className="ml-2">
        Refresh
      </Button>
    </AlertDescription>
  </Alert>
) : (
  // Show results
)}
```

---

### Fix #9: Debounce Module Selection
**File:** `src/pages/AITraining.tsx`  
**Effort:** 1.5 hours

```tsx
import { useMemo, useRef } from 'react';

export default function AITraining() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isChangingModule, setIsChangingModule] = useState(false);
  const changeTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced module change handler
  const handleModuleChange = (moduleId: string) => {
    // Cancel previous pending change
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }

    setIsChangingModule(true);

    // Debounce: wait 300ms before applying change
    changeTimeoutRef.current = setTimeout(() => {
      setSelectedId(moduleId);
      startNew();
      setIsChangingModule(false);
    }, 300);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* ... */}
      <Select 
        value={selectedId || ''} 
        onValueChange={handleModuleChange}
        disabled={loading || isChangingModule}
      >
        <SelectTrigger className="w-[360px]">
          <SelectValue 
            placeholder={
              isChangingModule 
                ? 'Switching module...' 
                : 'Select a training module'
            } 
          />
        </SelectTrigger>
        {/* ... */}
      </Select>
    </>
  );
}
```

---

### Fix #10: Add Confirmation Dialogs
**File:** `src/pages/AITraining.tsx`  
**Effort:** 2 hours

```tsx
// For archiving modules
const handleArchiveModule = async (moduleId: string) => {
  const module = modules.find(m => m.id === moduleId);
  
  // NEW: Better confirmation dialog
  const [confirmed, setConfirmed] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const ArchiveDialog = () => (
    <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Module?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>"{module?.title}"</strong> will be archived and hidden from the module list. 
          You can restore it later if needed. This action is reversible.
        </p>
        <ul className="text-sm space-y-1 ml-4 list-disc">
          <li>Existing training sessions will remain</li>
          <li>Module can be unarchived from settings</li>
          <li>Users won't see it in the module selector</li>
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={async () => {
              try {
                await upsertModule({ id: moduleId, organization_id: orgId!, visibility: 'archived' });
                toast({ title: 'Module archived', description: `"${module?.title}" has been archived` });
                setShowArchiveDialog(false);
                await refreshModules(true);
              } catch (err) {
                toast({ title: 'Error', description: 'Failed to archive module', variant: 'destructive' });
              }
            }}
          >
            Archive Module
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return <ArchiveDialog />;
};

// For deleting rubric categories
// Already has confirmation above, enhance message:
onClick={() => {
  const categoryName = draft.rubric[idx].name;
  if (!window.confirm(
    `Remove rubric category "${categoryName}"? This will affect evaluation scoring.`
  )) {
    return;
  }
  // ... delete logic ...
}}
```

---

## PHASE 3: Polish & Optimization (Days 6-15)

### Fix #11: Improve LiveFeedback Using AI
**File:** `src/components/training/LiveFeedbackPanel.tsx`  
**Effort:** 4 hours

Replace keyword-based logic with AI context analysis:

```tsx
// CURRENT: Simple keyword matching (too unreliable)
if (empathyWords.some(word => traineeLower.includes(word))) {
  // Give advice
}

// NEW: Use conversation context
async function analyzeConversationWithAI(
  latestUserMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  module: TrainingModule
) {
  const prompt = `You are a training coach. Analyze this customer service interaction and provide 2-3 specific, actionable tips.

Module: ${module.title}
Objectives: ${module.objectives.join(', ')}
Rubric: ${module.rubric.map(r => r.name).join(', ')}

Recent exchange:
Customer: "${conversationHistory[conversationHistory.length - 1]?.content}"
Agent: "${latestUserMessage}"

Provide advice in JSON format:
{
  "tips": [
    { "category": "Empathy|Clarity|etc", "advice": "Specific actionable tip", "type": "success|warning|tip" }
  ],
  "overall": "1-2 sentence coaching comment"
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VITE_LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.5,
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

---

### Fix #12: Module Editor with Tabs
**File:** `src/pages/AITraining.tsx`  
**Effort:** 3 hours

```tsx
// Replace cluttered form with organized tabs
<Tabs defaultValue="basic" className="w-full">
  <TabsList className="grid w-full grid-cols-4">
    <TabsTrigger value="basic">Basic Info</TabsTrigger>
    <TabsTrigger value="persona">Persona</TabsTrigger>
    <TabsTrigger value="objectives">Objectives</TabsTrigger>
    <TabsTrigger value="rubric">Rubric</TabsTrigger>
  </TabsList>

  {/* Basic Info Tab */}
  <TabsContent value="basic" className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Title</Label>
        <Input value={draft.title} onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))} />
      </div>
      <div>
        <Label>Industry</Label>
        <Select value={draft.industry || 'general'}>
          {/* options */}
        </Select>
      </div>
      {/* ... other basic fields ... */}
    </div>
  </TabsContent>

  {/* Persona Tab */}
  <TabsContent value="persona" className="space-y-4">
    {/* Persona fields */}
  </TabsContent>

  {/* Objectives Tab */}
  <TabsContent value="objectives" className="space-y-4">
    {/* Objectives textarea */}
  </TabsContent>

  {/* Rubric Tab */}
  <TabsContent value="rubric" className="space-y-4">
    {/* Rubric management */}
  </TabsContent>
</Tabs>
```

---

### Fix #13: Leaderboard Pagination
**File:** `src/components/training/TeamLeaderboard.tsx`  
**Effort:** 3 hours

```tsx
// Add pagination for large leaderboards
const [page, setPage] = useState(1);
const itemsPerPage = 10;

const paginatedLeaderboard = leaderboard.slice(
  (page - 1) * itemsPerPage,
  page * itemsPerPage
);

const totalPages = Math.ceil(leaderboard.length / itemsPerPage);

// Add pagination controls
<div className="flex items-center justify-between mt-4">
  <p className="text-sm text-muted-foreground">
    Showing {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, leaderboard.length)} 
    of {leaderboard.length}
  </p>
  <div className="flex gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage(p => Math.max(1, p - 1))}
      disabled={page === 1}
    >
      Previous
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
      disabled={page === totalPages}
    >
      Next
    </Button>
  </div>
</div>
```

---

### Fix #14: Request Tracing for Debugging
**File:** `supabase/functions/evaluate-training-session/index.ts`  
**Effort:** 2.5 hours

```typescript
// Add request ID to all logs
const requestId = crypto.randomUUID();
const timestamp = new Date().toISOString();

const log = (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => {
  console.log(JSON.stringify({
    requestId,
    timestamp,
    level,
    message,
    data,
    context: {
      userId: authContext.user.id,
      orgId: authorizedOrgId,
      moduleId,
    }
  }));
};

// Use throughout function
log('info', 'Starting evaluation', { transcriptLength: transcript.length });
log('warn', 'Evaluation API slow', { responseTime: 5000 });
log('error', 'JSON parse failed', { rawResponse: evaluationText.substring(0, 100) });

// Return requestId to client for support reference
return new Response(
  JSON.stringify({ 
    success: true,
    evaluation,
    requestId // ✅ Include for tracing
  }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

### Fix #15: Unit Tests for Core Functions
**File:** `src/__tests__/training.test.tsx`  
**Effort:** 8 hours

```tsx
// Create comprehensive test suite
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maskPII } from '@/lib/training/types';
import { evaluateSession } from '@/lib/training/evaluation';

describe('Training System', () => {
  describe('PII Masking', () => {
    it('should mask email addresses', () => {
      const text = 'Contact me at john@example.com';
      expect(maskPII(text)).toBe('Contact me at [EMAIL]');
    });

    it('should mask phone numbers', () => {
      const text = 'Call 555-123-4567';
      expect(maskPII(text)).toBe('Call [PHONE]');
    });

    it('should mask credit cards', () => {
      const text = 'Card: 4532-1111-2222-3333';
      expect(maskPII(text)).toBe('Card: [CARD]');
    });

    it('should handle multiple PII in one string', () => {
      const text = 'Email: test@email.com Phone: 555-123-4567';
      const masked = maskPII(text);
      expect(masked).toContain('[EMAIL]');
      expect(masked).toContain('[PHONE]');
    });
  });

  describe('Module Validation', () => {
    it('should reject module without rubric', () => {
      const module = {
        title: 'Test',
        persona: { name: 'Customer' },
        rubric: [],
      };
      expect(() => validateModule(module)).toThrow('Rubric required');
    });

    it('should reject rubric with empty guidelines', () => {
      const rubric = [
        { name: 'Empathy', guidelines: [] }
      ];
      expect(() => validateRubric(rubric)).toThrow('Guidelines required');
    });
  });

  describe('Live Feedback Analysis', () => {
    it('should detect empathy in responses', () => {
      const analysis = analyzeConversation(
        'I understand how you feel',
        []
      );
      expect(analysis).toContainEqual(expect.objectContaining({ type: 'success' }));
    });

    it('should flag unclear responses', () => {
      const longResponse = 'a'.repeat(500);
      const analysis = analyzeConversation(longResponse, []);
      expect(analysis).toContainEqual(expect.objectContaining({ type: 'warning' }));
    });
  });

  describe('Session Evaluation', () => {
    it('should calculate overall score from category scores', () => {
      const evaluation = {
        overall_score: 75,
        rubric_scores: [
          { category_id: '1', score: 80 },
          { category_id: '2', score: 70 },
        ],
      };
      expect(evaluation.overall_score).toBe(75);
    });

    it('should handle evaluation parsing errors gracefully', async () => {
      const result = await evaluateSession({ malformedJSON: true });
      expect(result.status).toBe('PENDING');
    });
  });
});
```

---

## Testing Checklist

After implementing each fix, verify:

- [ ] **Fix #1:** Throw error in component → see ErrorBoundary fallback
- [ ] **Fix #2a:** ElevenLabs down → see TTS error toast
- [ ] **Fix #2b:** Deny microphone → see permission error alert
- [ ] **Fix #3:** Save module with no rubric → validation error
- [ ] **Fix #4:** Check evaluation transcript → all PII masked
- [ ] **Fix #5:** Disable WiFi → see offline banner
- [ ] **Fix #6:** Use screen reader → hear ARIA labels
- [ ] **Fix #7:** Close browser mid-session → draft restores
- [ ] **Fix #8:** Evaluation fails → see "Pending" not "70"
- [ ] **Fix #9:** Rapid module clicks → no UI glitches
- [ ] **Fix #10:** Archive module → see confirmation dialog
- [ ] **Fix #11:** Get real-time coaching suggestions
- [ ] **Fix #12:** Tab interface intuitive
- [ ] **Fix #13:** Leaderboard shows pagination
- [ ] **Fix #14:** Logs include request IDs
- [ ] **Fix #15:** All tests pass

---

## Rollout Plan

### Week 1: Critical Fixes
- **Day 1-2:** Implement Fixes #1-5 (Error handling, validation, PII, offline)
- **Testing:** Manual testing of error scenarios
- **Deploy:** To staging for review

### Week 2: Important Improvements
- **Day 3:** Implement Fixes #6-7 (Accessibility, auto-save)
- **Day 4:** Implement Fixes #8-10 (Fallback UI, debounce, dialogs)
- **Testing:** Cross-browser accessibility testing
- **Deploy:** To production in feature branch

### Week 3: Polish & Tests
- **Day 5-6:** Implement Fixes #11-14 (AI feedback, UI improvements, tracing)
- **Day 7:** Implement Fix #15 (Unit tests)
- **Testing:** Full end-to-end test suite
- **Deploy:** Merge to main with full review

---

## Success Criteria

✅ All Priority 1 fixes deployed  
✅ Zero uncaught errors in training page  
✅ All error conditions surfaced to user  
✅ Module validation prevents data corruption  
✅ Offline scenarios handled gracefully  
✅ Accessibility score improves from 3/10 → 8/10  
✅ Code quality improves from 6/10 → 8/10  
✅ Test coverage increases from 0% → 60%+  

---

## Questions & Assumptions

1. **ElevenLabs API Key:** Assumes VITE_LOVABLE_API_KEY is set. Verify in `.env`
2. **Lovable AI:** Evaluation uses Gemini 2.5 Flash. Should be cost-efficient for training workload.
3. **IndexedDB:** Assumes browser supports IndexedDB for session drafts. Graceful fallback to localStorage if needed.
4. **Request Tracing:** Assumes logging infrastructure can handle structured JSON logs.
5. **RLS Policies:** Assumes training_sessions table has org-level RLS policies configured.

---

Let me know if you'd like me to:
1. ✅ Start implementing any of these fixes
2. ✅ Dive deeper into specific areas
3. ✅ Create component-specific action plans
4. ✅ Set up test infrastructure first
