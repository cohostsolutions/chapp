import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { devLog, devWarn, devError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Mic, Phone, AlertCircle, Globe, Volume2, MicOff, RefreshCw, PhoneOff, Sparkles, TimerReset, UserRound } from 'lucide-react';
import { useUnifiedAI } from '@/hooks/useUnifiedAI';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, TrainingSessionRecord, EvaluationResult, TrainingModule, maskPII } from '@/lib/training/types';
import { metricsTracker } from '@/lib/training/metrics';
import { saveSession } from '@/lib/training/storage';
import { recordSession, fetchPIISettings } from '@/lib/training/api';

// Language configuration
const LANGUAGE_CONFIG: Record<string, { name: string; sttCode: string; voiceId: string; browserVoicePatterns: string[] }> = {
  en: { name: 'English', sttCode: 'en-US', voiceId: 'EXAVITQu4vr4xnSDxMaL', browserVoicePatterns: ['en-US', 'en-GB', 'English'] },
  es: { name: 'Spanish', sttCode: 'es-ES', voiceId: 'VR6AewLTigWG4xSOukaG', browserVoicePatterns: ['es-ES', 'es-MX', 'Spanish'] },
  fr: { name: 'French', sttCode: 'fr-FR', voiceId: 'cgSgspJ2msm6clMCkdW9', browserVoicePatterns: ['fr-FR', 'French'] },
  de: { name: 'German', sttCode: 'de-DE', voiceId: 'nPczCjzI2devNBz1zQrb', browserVoicePatterns: ['de-DE', 'German'] },
  it: { name: 'Italian', sttCode: 'it-IT', voiceId: 'XB0fDUnXU5powFXDhCwa', browserVoicePatterns: ['it-IT', 'Italian'] },
  pt: { name: 'Portuguese', sttCode: 'pt-PT', voiceId: 'z9fAnlkpzviPz146aGWa', browserVoicePatterns: ['pt-PT', 'pt-BR', 'Portuguese'] },
  zh: { name: 'Chinese', sttCode: 'zh-CN', voiceId: 'XrExE9yKIg1WjnnlVkGX', browserVoicePatterns: ['zh-CN', 'zh-TW', 'Chinese'] },
  ja: { name: 'Japanese', sttCode: 'ja-JP', voiceId: 'bIHbv24MWmeRgasZH58o', browserVoicePatterns: ['ja-JP', 'Japanese'] },
  fil: { name: 'Filipino (Tagalog)', sttCode: 'fil-PH', voiceId: 'EXAVITQu4vr4xnSDxMaL', browserVoicePatterns: ['fil-PH', 'tl-PH', 'Filipino'] },
  ceb: { name: 'Cebuano', sttCode: 'ceb-PH', voiceId: 'EXAVITQu4vr4xnSDxMaL', browserVoicePatterns: ['ceb-PH', 'Cebuano'] },
  ilo: { name: 'Ilocano', sttCode: 'ilo-PH', voiceId: 'EXAVITQu4vr4xnSDxMaL', browserVoicePatterns: ['ilo-PH', 'Ilocano'] },
};

// ElevenLabs TTS function
const ELEVENLABS_TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

function estimateTtsTimeoutMs(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // ~150 wpm + some padding; cap so we never block the mic forever.
  const ms = 1500 + (words / 2.5) * 1000;
  return Math.min(20000, Math.max(6000, Math.round(ms)));
}

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
      body: JSON.stringify({
        text,
        voiceId,
      }),
    });

    if (!response.ok) {
      const message = response.status === 429
        ? 'Speech service temporarily busy. Using voice instead.'
        : 'Speech service unavailable. Using voice instead.';
      onError?.(message);
      devWarn('ElevenLabs TTS failed:', response.status, 'falling back to browser TTS');
      return false;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    const timeoutMs = estimateTtsTimeoutMs(text);

    return await new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        try {
          audio.pause();
        } catch {
          // ignore
        }
        URL.revokeObjectURL(audioUrl);
        resolve(ok);
      };

      const timeout = window.setTimeout(() => {
        devWarn('ElevenLabs TTS timed out; continuing.');
        finish(true);
      }, timeoutMs);

      audio.onended = () => {
        window.clearTimeout(timeout);
        finish(true);
      };
      audio.onerror = () => {
        window.clearTimeout(timeout);
        finish(false);
      };

      audio.play().catch(() => {
        window.clearTimeout(timeout);
        finish(false);
      });
    });
  } catch (error) {
    const message = error instanceof Error
      ? `Speech error: ${error.message}`
      : 'Speech service error. Using voice instead.';
    onError?.(message);
    devError('ElevenLabs TTS error:', error);
    return false;
  }
}

// Request microphone permission
async function requestMicrophonePermission(
  onError?: (message: string) => void
): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    devError('Microphone error:', error);
    
    let message = 'Microphone access failed';
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        message = 'Microphone access denied. Check browser permissions.';
      } else if (error.name === 'NotFoundError') {
        message = 'No microphone found. Using text input instead.';
      } else if (error.name === 'NotReadableError') {
        message = 'Microphone is in use by another app.';
      }
    }
    
    onError?.(message);
    return false;
  }
}

interface Props {
  module: TrainingModule;
  organizationId: string;
  userId: string;
  onEnd: (record: TrainingSessionRecord) => void;
  onUserMessage?: (text: string) => void;
  onConversationUpdate?: (history: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
}

interface TrainingDraft {
  sessionId: string;
  moduleId: string;
  organizationId: string;
  userId: string;
  startedAt: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  trainingMode: 'voice' | 'chat' | null;
  selectedLanguage: string;
  timestamp: number;
}

const TRAINING_DRAFT_PREFIX = 'training-draft-';

function buildPersonaPrimer(mod: TrainingModule, voiceMode: boolean, language: string): string {
  const langName = LANGUAGE_CONFIG[language]?.name || 'English';
  const aiLangCode = mod.persona.ai_language || 'en';
  const aiLangName = LANGUAGE_CONFIG[aiLangCode]?.name || 'English';
  
  // Determine call type context
  const callTypeContext = mod.call_type === 'cold_call' 
    ? `This is a COLD CALL (outbound). You were NOT expecting this call. The trainee is calling YOU. You may be busy, skeptical, or resistant. The trainee needs to quickly establish rapport, explain why they're calling, and earn your interest.`
    : `This is a WARM CALL (inbound). YOU are calling the trainee seeking information or help. You have a need or question. You are more receptive and engaged, but still expect professional service.`;
  
  return [
    `You are roleplaying as ${mod.persona.name}, a ${mod.industry || 'customer'} persona.`,
    `Your current mood is ${mod.persona.mood}. Your background: ${mod.persona.background || 'You are a typical customer'}.`,
    `Your goals in this conversation: ${(mod.persona.goals || []).join(', ')}.`,
    `Your constraints/concerns: ${(mod.persona.constraints || []).join(', ') || 'None specific'}.`,
    ``,
    callTypeContext,
    ``,
    `LANGUAGE: Respond ONLY in ${aiLangName}. The trainee will speak in ${langName}.${aiLangCode !== language ? ' If they speak a different language, respond in ${aiLangName} anyway (cross-language practice).' : ''}`,
    voiceMode ? `This is a VOICE conversation. Keep responses natural, conversational, and brief (1-3 sentences max). Speak like a real person would on a phone call.` : `This is a CHAT conversation. Keep responses natural and conversational.`,
    `Stay strictly in character as the customer/prospect. Do NOT provide coaching, break character, or sound like an AI assistant.`,
    `Be empathetic, realistic, and human. Use natural speech patterns with occasional filler words, contractions, and casual language.`,
    `If the trainee provides incomplete information, ask follow-up questions naturally. Fill in context from the conversation.`,
    `Match the difficulty level: ${mod.difficulty || 'medium'}. For 'hard', be more challenging but still realistic.`,
    mod.call_type === 'cold_call' 
      ? `Wait for the trainee to start the conversation since they are calling you. When they do, respond naturally based on your mood and whether you were interrupted.`
      : `Start the conversation naturally with a realistic opening that shows you're calling for help or information. State your need clearly.`
  ].join('\n');
}

export function TrainingSimulator({ module, organizationId, userId, onEnd, onUserMessage, onConversationUpdate }: Props) {
  const { toast } = useToast();
  
  const [input, setInput] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hasDraftToRecover, setHasDraftToRecover] = useState(false);
  const [draftRecoveryDialogOpen, setDraftRecoveryDialogOpen] = useState(false);
  const [endSessionConfirmOpen, setEndSessionConfirmOpen] = useState(false);
  const [sessionId] = useState<string>(() =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sttSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const primerRef = useRef<string>('');
  const [endingSession, setEndingSession] = useState(false);
  const [piiEnabled, setPiiEnabled] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(true);
  const [trainingMode, setTrainingMode] = useState<'voice' | 'chat' | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null);
  const networkRetryCountRef = useRef(0);
  const maxNetworkRetries = 5;
  const isProcessingRef = useRef(false);
  const shouldRestartListeningRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recoveryDraftRef = useRef<{ key: string; draft: TrainingDraft } | null>(null);
  const skipSessionBootstrapRef = useRef(false);
  
  // Language support
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['en']);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  
  // Microphone permission state
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [micError, setMicError] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  // Voice mode states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [lastAIMessage, setLastAIMessage] = useState<string>('');
  const [sessionClock, setSessionClock] = useState(() => Date.now());

  const typingConfig = useMemo(() => ({
    organizationId,
    platform: 'training',
    simulateTyping: trainingMode === 'chat',
    minTypingDelayMs: 700,
    maxTypingDelayMs: 2000,
  }), [organizationId, trainingMode]);

  const { messages, isLoading, sendMessage, clearMessages, setInitialMessages } = useUnifiedAI(typingConfig);

  const getMatchingDrafts = useCallback(() => {
    try {
      return Object.keys(localStorage)
        .filter((key) => key.startsWith(TRAINING_DRAFT_PREFIX))
        .map((key) => {
          try {
            const draft = JSON.parse(localStorage.getItem(key) || 'null') as TrainingDraft | null;
            return draft ? { key, draft } : null;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is { key: string; draft: TrainingDraft } => Boolean(entry))
        .filter(({ draft }) => (
          draft.moduleId === module.id &&
          draft.organizationId === organizationId &&
          draft.userId === userId
        ))
        .sort((a, b) => b.draft.timestamp - a.draft.timestamp);
    } catch (err) {
      devError('[TrainingSimulator] Error reading drafts:', err);
      return [];
    }
  }, [module.id, organizationId, userId]);

  // Fetch PII settings
  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchPIISettings(organizationId);
        setPiiEnabled(settings.training_pii_redaction);
      } catch (err) {
        devError('Failed to fetch PII settings', err);
      }
    })();
  }, [organizationId]);

  // Check for draft session on mount
  useEffect(() => {
    const checkForDraft = () => {
      const matchingDrafts = getMatchingDrafts();
      const mostRecent = matchingDrafts[0];

      if (!mostRecent) return;

      const draftAge = Date.now() - mostRecent.draft.timestamp;
      const isRecent = draftAge < 24 * 60 * 60 * 1000;

      if (!isRecent) {
        localStorage.removeItem(mostRecent.key);
        return;
      }

      recoveryDraftRef.current = mostRecent;
      setHasDraftToRecover(true);
      setDraftRecoveryDialogOpen(true);
    };

    // Only check on initial mount
    checkForDraft();
  }, [getMatchingDrafts]);

  // Cleanup: stop listening when component unmounts or mode changes
  useEffect(() => {
    return () => {
      stopListening();
      window.speechSynthesis.cancel();
    };
  }, [trainingMode]);

  // Prime the conversation with persona context after session starts
  useEffect(() => {
    if (!trainingMode || !sessionStarted) return;

    if (skipSessionBootstrapRef.current) {
      skipSessionBootstrapRef.current = false;
      return;
    }

    clearMessages();
    const primer = buildPersonaPrimer(module, trainingMode === 'voice', selectedLanguage);
    primerRef.current = primer;
    setInitialMessages([{ role: 'user', content: primer }]);
    setStartedAt(Date.now());

    // Determine who starts based on call type and mode
    // Warm call (inbound): AI starts (customer calling in)
    // Cold call (outbound): Trainee starts (agent calling customer)
    // Voice mode: Follow call_type strictly
    // Chat mode: Respect first_message_sender override
    const isWarmCall = module.call_type !== 'cold_call';
    const shouldAIStart = trainingMode === 'voice' 
      ? isWarmCall 
      : (module.first_message_sender !== 'trainee');
    
    if (shouldAIStart) {
      (async () => { await sendMessage(primer); })();
    }
     
  }, [module.id, trainingMode, sessionStarted, selectedLanguage]);

  // Visible conversation (exclude hidden primer/evaluation prompts)
  const conversationMessages = useMemo(() => {
    const primer = primerRef.current;
    return messages.filter((m) => {
      if (primer && m.content === primer) return false;
      if (typeof m.content === 'string' && m.content.startsWith('You are now an evaluator.')) return false;
      return true;
    });
  }, [messages]);

  const transcript: ChatMessage[] = useMemo(() => (
    conversationMessages.map((m, index) => ({
      ...m,
      timestamp: (startedAt || Date.now()) + index,
    }))
  ), [conversationMessages, startedAt]);

  useEffect(() => {
    if (!sessionStarted || !startedAt) return;

    setSessionClock(Date.now());
    const interval = window.setInterval(() => {
      setSessionClock(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionStarted, startedAt]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversationMessages, isLoading]);

  const elapsedMs = startedAt ? Math.max(0, sessionClock - startedAt) : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0');
  const traineeTurns = conversationMessages.filter((message) => message.role === 'user').length;
  const objectiveProgress = module.objectives?.length
    ? Math.min(100, Math.round((traineeTurns / module.objectives.length) * 100))
    : 0;
  const lastAssistantMessage = conversationMessages.filter((message) => message.role === 'assistant').at(-1)?.content || '';

  // Update conversation history for live coaching (exclude primer)
  useEffect(() => {
    if (onConversationUpdate) {
      // Create a new array reference to ensure re-renders
      onConversationUpdate([...conversationMessages]);
    }
     
  }, [conversationMessages]); // Intentionally exclude onConversationUpdate to prevent infinite loops

  // Show toast notifications for TTS errors
  useEffect(() => {
    if (ttsError) {
      toast({
        title: "Speech Output Error",
        description: ttsError,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [ttsError, toast]);

  // Show toast notifications for microphone errors
  useEffect(() => {
    if (micError) {
      toast({
        title: "Microphone Error",
        description: micError,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [micError, toast]);

  // Auto-save session to localStorage every 30 seconds
  useEffect(() => {
    if (!sessionStarted || messages.length === 0) return;

    const autoSaveInterval = setInterval(() => {
      const draftMessages = piiEnabled
        ? messages.map((message) => ({ ...message, content: maskPII(message.content) }))
        : messages;

      const draftSession: TrainingDraft = {
        sessionId,
        moduleId: module.id,
        organizationId,
        userId,
        startedAt: startedAt || Date.now(),
        messages: draftMessages,
        trainingMode,
        selectedLanguage,
        timestamp: Date.now(),
      };
      
      try {
        localStorage.setItem(`${TRAINING_DRAFT_PREFIX}${sessionId}`, JSON.stringify(draftSession));
        devLog('[TrainingSimulator] Auto-saved session draft');
      } catch (err) {
        devError('[TrainingSimulator] Failed to auto-save:', err);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [sessionStarted, messages, piiEnabled, sessionId, module.id, organizationId, userId, startedAt, trainingMode, selectedLanguage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    onUserMessage?.(text);
    await sendMessage(text);
  };

  // Get current language config
  const currentLangConfig = LANGUAGE_CONFIG[selectedLanguage] || LANGUAGE_CONFIG.en;

  // Browser TTS fallback with language support
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!speechSupported) {
        resolve();
        return;
      }

      const timeoutMs = estimateTtsTimeoutMs(text);
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        // avoid leaking a handler across sessions
        window.speechSynthesis.onvoiceschanged = null;
        resolve();
      };

      window.speechSynthesis.cancel();

      const timeout = window.setTimeout(() => {
        devWarn('Browser TTS timed out; continuing.');
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        finish();
      }, timeoutMs);

      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(text);
        let voices = window.speechSynthesis.getVoices();

        const setupAndSpeak = () => {
          voices = window.speechSynthesis.getVoices();

          // Try to find a voice matching the selected language
          let preferredVoice = null;
          const patterns = currentLangConfig.browserVoicePatterns;

          for (const pattern of patterns) {
            preferredVoice = voices.find(v =>
              v.name.includes(pattern) || v.lang.startsWith(pattern)
            );
            if (preferredVoice) break;
          }

          // Fallback to any voice for the language
          if (!preferredVoice) {
            preferredVoice = voices.find(v => v.lang.startsWith(currentLangConfig.sttCode.split('-')[0]));
          }

          // Final fallback to English
          if (!preferredVoice) {
            preferredVoice = voices.find(v => v.lang.startsWith('en'));
          }

          if (preferredVoice) utter.voice = preferredVoice;
          utter.lang = currentLangConfig.sttCode;
          utter.rate = 0.95;
          utter.pitch = 1.0;
          utter.volume = 0.85;
          utter.onend = finish;
          utter.onerror = finish;
          window.speechSynthesis.speak(utter);
        };

        if (voices.length === 0) {
          window.speechSynthesis.onvoiceschanged = setupAndSpeak;
          window.speechSynthesis.getVoices();
        } else {
          setupAndSpeak();
        }
      }, 100);
    });
  }, [speechSupported, currentLangConfig]);

  // Main speak function - tries ElevenLabs first, falls back to browser
  const speak = useCallback(async (text: string): Promise<void> => {
    setIsSpeaking(true);
    setLastAIMessage(text);
    setTtsError(null); // Clear previous errors
    try {
      // Try ElevenLabs first with language-appropriate voice
      const success = await speakWithElevenLabs(text, currentLangConfig.voiceId, (errorMessage) => {
        setTtsError(errorMessage);
      });
      if (!success) {
        // Fallback to browser TTS
        await speakWithBrowser(text);
        setTtsError(null); // Clear error if fallback succeeds
      }
    } finally {
      setIsSpeaking(false);
    }
  }, [speakWithBrowser, currentLangConfig.voiceId]);

  // Auto-play AI responses in voice mode (optional), then start listening
  useEffect(() => {
    if (trainingMode !== 'voice' || !autoSpeak || !sessionStarted || conversationMessages.length === 0) return;

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    if (lastMessage.role !== 'assistant' || isLoading) return;

    isProcessingRef.current = true;
    stopListening();

    speak(lastMessage.content).then(() => {
      isProcessingRef.current = false;
      networkRetryCountRef.current = 0;

      setTimeout(() => {
        if (trainingMode === 'voice' && sessionStarted && !isProcessingRef.current && !recognitionRef.current) {
          startContinuousListening();
        }
      }, 600);
    });
  }, [conversationMessages, autoSpeak, isLoading, trainingMode, sessionStarted, speak]);

  // If auto-speak is off, still make sure we listen after the AI speaks
  useEffect(() => {
    if (trainingMode !== 'voice' || autoSpeak || !sessionStarted || isLoading) return;
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    if (!listening && !recognitionRef.current && !isProcessingRef.current) {
      startContinuousListening();
    }
  }, [conversationMessages, autoSpeak, isLoading, trainingMode, sessionStarted, listening]);

  const handleModeSelect = async (mode: 'voice' | 'chat') => {
    if (mode === 'voice') {
      // Request microphone permission before selecting voice mode
      const hasPermission = await requestMicrophonePermission((errorMessage) => {
        setMicError(errorMessage);
      });
      if (!hasPermission) {
        return; // Don't proceed if permission denied
      }
      setAutoSpeak(true);
    }
    setTrainingMode(mode);
    setModeDialogOpen(false);
  };

  const playRingingSound = (): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const AudioContextClass = window.AudioContext || ((window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext);
        if (!AudioContextClass) {
          devWarn('AudioContext not supported');
          resolve();
          return;
        }
        const audioContext = new AudioContextClass();
        const duration = 3;
        const ringInterval = 1;
        
        const currentTime = audioContext.currentTime;
        
        for (let i = 0; i < 3; i++) {
          const startTime = currentTime + (i * ringInterval);
          
          const osc1 = audioContext.createOscillator();
          const osc2 = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          osc1.frequency.value = 440;
          osc2.frequency.value = 480;
          
          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          gainNode.gain.setValueAtTime(0.3, startTime);
          gainNode.gain.setValueAtTime(0.3, startTime + 0.4);
          gainNode.gain.setValueAtTime(0, startTime + 0.4);
          
          osc1.start(startTime);
          osc1.stop(startTime + 0.4);
          osc2.start(startTime);
          osc2.stop(startTime + 0.4);
        }
        
        setTimeout(() => {
          audioContext.close();
          resolve();
        }, duration * 1000);
      } catch (error) {
        devError('Error playing ringing sound:', error);
        setTimeout(resolve, 3000);
      }
    });
  };

  const handleRecoverDraft = () => {
    try {
      const recoveryTarget = recoveryDraftRef.current;
      if (!recoveryTarget) {
        setDraftRecoveryDialogOpen(false);
        return;
      }

      const { key, draft } = recoveryTarget;
      const restoredMode = draft.trainingMode || 'chat';
      const restoredLanguage = draft.selectedLanguage || 'en';
      const primer = buildPersonaPrimer(module, restoredMode === 'voice', restoredLanguage);
      const restoredMessages = draft.messages?.length
        ? (draft.messages.some((message) => message.content === primer)
            ? draft.messages
            : [{ role: 'user' as const, content: primer }, ...draft.messages])
        : [{ role: 'user' as const, content: primer }];

      skipSessionBootstrapRef.current = true;
      primerRef.current = primer;
      clearMessages();
      setInitialMessages(restoredMessages);
      setTrainingMode(restoredMode);
      setSelectedLanguage(restoredLanguage);
      setStartedAt(draft.startedAt || Date.now());
      setSessionStarted(true);
      setModeDialogOpen(false);
      setHasDraftToRecover(false);
      setDraftRecoveryDialogOpen(false);
      localStorage.removeItem(key);
      recoveryDraftRef.current = null;

      toast({
        title: 'Draft Restored',
        description: `Restored ${Math.max(restoredMessages.length - 1, 0)} messages from your previous session.`,
        duration: 3000,
      });
    } catch (err) {
      devError('[TrainingSimulator] Error recovering draft:', err);
      toast({
        title: "Recovery Failed",
        description: "Could not restore draft session. Starting fresh.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleDiscardDraft = () => {
    try {
      const recoveryTarget = recoveryDraftRef.current;
      if (recoveryTarget) {
        localStorage.removeItem(recoveryTarget.key);
      }
      
      setHasDraftToRecover(false);
      setDraftRecoveryDialogOpen(false);
      recoveryDraftRef.current = null;
      
      toast({
        title: "Draft Discarded",
        description: "Previous session cleared. Starting fresh.",
        duration: 2000,
      });
    } catch (err) {
      devError('[TrainingSimulator] Error discarding draft:', err);
    }
  };

  const handleStartSession = async () => {
    if (trainingMode === 'voice') {
      setIsRinging(true);
      await playRingingSound();
      setIsRinging(false);
    }
    setSessionStarted(true);
  };

  const startContinuousListening = useCallback(() => {
    if (!sttSupported) {
      setMicError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    
    if (micPermission === 'denied') {
      setMicError('Microphone access is denied. Please enable it in browser settings.');
      return;
    }
    
    if (listening || recognitionRef.current) {
      return;
    }
    
    if (networkRetryCountRef.current >= maxNetworkRetries) {
      devWarn('Max network retries reached for speech recognition.');
      setMicError('Speech recognition service unavailable. You can type your responses instead.');
      return;
    }
    
    const windowWithSpeech = window as any;
    const Rec = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!Rec) {
      devWarn('SpeechRecognition not supported');
      setMicError('Speech recognition not supported in this browser');
      return;
    }
    const recognition = new Rec();
    
    // Use selected language for speech recognition
    recognition.lang = currentLangConfig.sttCode;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    let finalTranscript = '';
    let silenceTimer: NodeJS.Timeout;
    
    recognition.onstart = () => {
      setListening(true);
      setMicError(null);
      networkRetryCountRef.current = 0;
      devLog(`Speech recognition started in ${currentLangConfig.name}`);
    };
    
    recognition.onresult = (event: Event & { resultIndex: number; results: SpeechRecognitionResultList }) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += chunk + ' ';
        } else {
          interim += chunk;
        }
      }

      const combined = (finalTranscript + interim).trim();
      if (combined) {
        setInput(combined);
      }

      clearTimeout(silenceTimer);

      if (combined) {
        silenceTimer = setTimeout(async () => {
          const textToSend = combined.trim();
          if (!textToSend || trainingMode !== 'voice' || !sessionStarted) return;

          try {
            recognition.stop();
          } catch {
            // ignore
          }
          setListening(false);

          onUserMessage?.(textToSend);
          await sendMessage(textToSend);

          setInput('');
          finalTranscript = '';
        }, 1400);
      }
    };
    
    recognition.onend = () => {
      setListening(false);
      clearTimeout(silenceTimer);
      recognitionRef.current = null;
      
      if (shouldRestartListeningRef.current && !isProcessingRef.current && 
          trainingMode === 'voice' && sessionStarted && !isLoading) {
        setTimeout(() => {
          if (trainingMode === 'voice' && !listening && !recognitionRef.current && !isProcessingRef.current) {
            startContinuousListening();
          }
        }, 500);
      }
      shouldRestartListeningRef.current = false;
    };
    
    recognition.onerror = (event: Event & { error: string }) => {
      clearTimeout(silenceTimer);
      setListening(false);
      recognitionRef.current = null;
      
      devError('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicPermission('denied');
        setMicError('Microphone access was denied. Please allow access in browser settings and refresh.');
        return;
      }
      
      if (event.error === 'network') {
        networkRetryCountRef.current += 1;
        
        if (networkRetryCountRef.current >= maxNetworkRetries) {
          setMicError('Speech recognition service unavailable. You can type your responses instead.');
          return;
        }
        
        if (!isProcessingRef.current && trainingMode === 'voice' && sessionStarted) {
          const backoffDelay = Math.min(Math.pow(2, networkRetryCountRef.current) * 1000, 8000);
          setTimeout(() => {
            if (trainingMode === 'voice' && !listening && !isProcessingRef.current) {
              startContinuousListening();
            }
          }, backoffDelay);
        }
        return;
      }
      
      if (event.error === 'no-speech') {
        // Silently restart after a pause
        if (trainingMode === 'voice' && sessionStarted && !isProcessingRef.current) {
          setTimeout(() => {
            if (!recognitionRef.current && !isProcessingRef.current) {
              startContinuousListening();
            }
          }, 1000);
        }
        return;
      }
      
      if (event.error === 'audio-capture') {
        setMicError('Could not capture audio. Please check your microphone connection.');
        return;
      }
      
      if (event.error === 'aborted') {
        // Normal abort, don't show error
        return;
      }
      
      setMicError(`Speech recognition error: ${event.error}`);
    };
    
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      devError('Failed to start recognition:', error);
      setListening(false);
      recognitionRef.current = null;
      setMicError('Failed to start speech recognition. Please try again.');
    }
  }, [sttSupported, micPermission, listening, trainingMode, sessionStarted, isLoading, sendMessage, onUserMessage, currentLangConfig]);

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        devError('Error stopping recognition:', e);
      }
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const handleListen = () => {
    if (!sttSupported) return;
    if (listening) {
      stopListening();
    } else {
      startContinuousListening();
    }
  };

  const endSession = async () => {
    if (endingSession) return;
    setEndingSession(true);

    // Stop any ongoing speech recognition
    stopListening();
    window.speechSynthesis.cancel();
    
    const ended = Date.now();
    
    // Apply PII masking before evaluation if enabled
    const messagesForEvaluation = piiEnabled 
      ? conversationMessages.map(msg => ({ ...msg, content: maskPII(msg.content) }))
      : conversationMessages;
    
    const cleanTranscript = messagesForEvaluation.map(m => 
      `${m.role === 'user' ? 'TRAINEE' : 'CUSTOMER'}: ${m.content}`
    ).join('\n');
    const sanitizedTranscript = piiEnabled ? transcript.map(msg => ({ ...msg, content: maskPII(msg.content) })) : transcript;

    // Keep evaluation prompt under backend limits (ai-chat validates message length)
    const MAX_TRANSCRIPT_CHARS = 6000;
    const clippedTranscript = cleanTranscript.length > MAX_TRANSCRIPT_CHARS
      ? `...(transcript truncated; showing last ${MAX_TRANSCRIPT_CHARS} chars)...\n` + cleanTranscript.slice(-MAX_TRANSCRIPT_CHARS)
      : cleanTranscript;

    const rubricText = module.rubric.length > 0 
      ? module.rubric.map(r => `${r.name} (Weight: ${r.weight || 1}): ${r.guidelines.join('; ')}`).join(' | ')
      : 'Empathy (Weight: 1): Shows understanding; Clarity (Weight: 1): Clear communication; Problem Solving (Weight: 1): Offers solutions';

    const totalWeight = module.rubric.length > 0 
      ? module.rubric.reduce((sum, r) => sum + (r.weight || 1), 0)
      : 3;

    let evaluation: EvaluationResult | undefined;
    let persistedByEvaluator = false;
    const evaluationRequestId = metricsTracker.startRequest('trainingEvaluation', {
      moduleId: module.id,
      messageCount: cleanTranscript.length,
    });
    
    try {
      // Show evaluation in progress
      toast({
        title: "Evaluating Performance",
        description: "AI is analyzing your conversation...",
        duration: 2000,
      });

      const { data, error } = await supabase.functions.invoke('evaluate-training-session', {
        body: {
          sessionId,
          moduleId: module.id,
          transcript: sanitizedTranscript,
          organizationId,
          startedAt: startedAt || ended,
        },
      });

      if (error) {
        throw error;
      }

      const resolvedEvaluation = data?.evaluation as EvaluationResult | undefined;
      if (!resolvedEvaluation) {
        throw new Error('No evaluation returned by evaluator');
      }

      evaluation = resolvedEvaluation;
      persistedByEvaluator = true;

      metricsTracker.endRequest(evaluationRequestId, {
        score: evaluation.overallScore,
        success: true,
      });

      toast({
        title: "Evaluation Complete",
        description: `Overall Score: ${evaluation.overallScore}/100`,
        duration: 3000,
      });
    } catch (err) {
      metricsTracker.errorRequest(evaluationRequestId, err instanceof Error ? err.message : 'Unknown error');
      devError('[TrainingSimulator] Evaluation failed:', err);
      
      toast({
        title: "Evaluation Failed",
        description: "Session saved but AI evaluation is unavailable. Your conversation was recorded.",
        variant: "destructive",
        duration: 5000,
      });
      
      // Provide fallback evaluation
      evaluation = {
        overallScore: 0,
        categoryScores: [],
        strengths: ['Session completed'],
        improvements: ['Evaluation temporarily unavailable - please try again later'],
        aiSummary: 'Evaluation service unavailable. Your session has been saved for review.',
      };
    }

    const record: TrainingSessionRecord = {
      id: sessionId,
      moduleId: module.id,
      organizationId,
      userId,
      startedAt: startedAt || ended,
      endedAt: ended,
      transcript: sanitizedTranscript,
      evaluation,
    };

    saveSession(record);
    try {
      if (!persistedByEvaluator) {
        await recordSession(record);
      }
      // Clear auto-save draft on successful completion
      localStorage.removeItem(`${TRAINING_DRAFT_PREFIX}${sessionId}`);
      devLog('[TrainingSimulator] Cleared auto-save draft after successful completion');
    } catch (err) {
      devWarn('Failed to persist training session to Supabase', err);
    } finally {
      setEndingSession(false);
    }

    onEnd(record);
  };

  // Available languages for selection
  const availableLanguages = allowedLanguages.filter(lang => LANGUAGE_CONFIG[lang]);

  return (
    <>
      {/* Draft Recovery Dialog */}
      <Dialog open={draftRecoveryDialogOpen} onOpenChange={setDraftRecoveryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume Previous Session?</DialogTitle>
            <DialogDescription>
              We found an unfinished training session from earlier. Would you like to continue where you left off or start fresh?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Your prior transcript, mode, and language will be restored for this module.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardDraft}>
              Start Fresh
            </Button>
            <Button onClick={() => { handleRecoverDraft(); }}>
              Resume Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Session Confirmation Dialog */}
      <Dialog open={endSessionConfirmOpen} onOpenChange={setEndSessionConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Training Session?</DialogTitle>
            <DialogDescription>
              Are you sure you want to end this training session? This will evaluate your performance and save your results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Your conversation history and evaluation will be saved automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndSessionConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                setEndSessionConfirmOpen(false);
                endSession();
              }}
            >
              End Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Mode Selection Dialog */}
      <Dialog
        open={modeDialogOpen}
        onOpenChange={(open) => {
          if (!open && !trainingMode) return;
          setModeDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Training Mode</DialogTitle>
            <DialogDescription>
              Select how you want to practice this scenario. Voice mode simulates real phone conversations.
            </DialogDescription>
          </DialogHeader>
          
          {/* Language Selection */}
          {availableLanguages.length > 1 && (
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Training Language
              </label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map(lang => (
                    <SelectItem key={lang} value={lang}>
                      {LANGUAGE_CONFIG[lang]?.name || lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {micError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{micError}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 gap-4 py-4">
            <Button
              variant="outline"
              className="h-auto flex flex-col items-center gap-3 p-6 hover:border-primary"
              onClick={() => handleModeSelect('voice')}
              disabled={!speechSupported || !sttSupported || micPermission === 'denied'}
              aria-label="Select voice training mode - practice with voice like a real phone call"
              aria-disabled={!speechSupported || !sttSupported || micPermission === 'denied'}
            >
              <Mic className="w-8 h-8 text-primary" aria-hidden="true" />
              <div className="text-center">
                <div className="font-semibold text-base mb-1">Voice Training</div>
                <div className="text-xs text-muted-foreground">
                  Practice with voice like a real phone call
                </div>
                {micPermission === 'denied' && (
                  <Badge variant="destructive" className="mt-2">Mic Access Denied</Badge>
                )}
                {(!speechSupported || !sttSupported) && micPermission !== 'denied' && (
                  <Badge variant="secondary" className="mt-2">Not Supported</Badge>
                )}
                {micPermission === 'prompt' && speechSupported && sttSupported && (
                  <Badge variant="outline" className="mt-2">Mic Permission Required</Badge>
                )}
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex flex-col items-center gap-3 p-6 hover:border-primary"
              onClick={() => handleModeSelect('chat')}
              aria-label="Select chat training mode - practice with text-based messaging"
            >
              <MessageSquare className="w-8 h-8 text-primary" aria-hidden="true" />
              <div className="text-center">
                <div className="font-semibold text-base mb-1">Chat Training</div>
                <div className="text-xs text-muted-foreground">
                  Practice with text-based messaging
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="w-full">
        <CardHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <CardTitle>{module.title}</CardTitle>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Stay focused on the customer goal, keep your pacing natural, and use the live status bar below to manage your turn-taking.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              {selectedLanguage !== 'en' && (
                <Badge variant="outline" className="gap-1">
                  <Globe className="w-3 h-3" />
                  {LANGUAGE_CONFIG[selectedLanguage]?.name || selectedLanguage}
                </Badge>
              )}
              {trainingMode && (
                <Badge variant="outline" className="gap-1">
                  {trainingMode === 'voice' ? <Mic className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                  {trainingMode === 'voice' ? 'Voice Mode' : 'Chat Mode'}
                </Badge>
              )}
                <Badge variant="outline" className="gap-1">
                  <UserRound className="w-3 h-3" />
                  {module.persona?.name}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <TimerReset className="h-3.5 w-3.5" />
                  Session Time
                </div>
                <p className="text-xl font-semibold">{elapsedMinutes}:{elapsedSeconds}</p>
                <p className="mt-1 text-xs text-muted-foreground">Current live practice duration</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Objective Pulse
                </div>
                <p className="text-xl font-semibold">{traineeTurns} trainee turns</p>
                <Progress value={objectiveProgress} className="mt-2 h-2.5" />
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Last Customer Cue
                </div>
                <p className="line-clamp-2 text-sm text-foreground/90">
                  {lastAssistantMessage || 'No customer reply yet. Once the session starts, the latest cue will appear here.'}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      <CardContent>
        {!sessionStarted ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            {micError && (
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{micError}</AlertDescription>
              </Alert>
            )}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {isRinging ? 'Calling...' : (trainingMode === 'voice' ? 'Ready to Start the Call?' : 'Ready to Start the Chat?')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {isRinging ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">📞 Ringing...</span>
                  </span>
                ) : (
                  trainingMode === 'voice' 
                    ? 'Click the button below when you\'re ready. The conversation will begin automatically and you can speak naturally.'
                    : 'Click the button below when you\'re ready to begin the training conversation.'
                )}
              </p>
            </div>
            <Button 
              onClick={handleStartSession} 
              size="lg"
              className="gap-2"
              disabled={isRinging}
              aria-label={trainingMode === 'voice' ? 'Start voice call training session' : 'Start chat training session'}
              aria-disabled={isRinging}
            >
              {trainingMode === 'voice' ? (
                <>
                  <Phone className="w-5 h-5" aria-hidden="true" />
                  Start Call
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                  Start Chat
                </>
              )}
            </Button>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Error Banners */}
          {ttsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Speech Output: {ttsError}
              </AlertDescription>
            </Alert>
          )}
          {micError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Microphone: {micError}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
            {trainingMode === 'chat' && (
              <ScrollArea className="h-[360px] pr-3" role="log" aria-live="polite" aria-label="Chat conversation">
                <div className="space-y-3">
                  {conversationMessages.length === 0 && module.first_message_sender === 'trainee' && (
                    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                      <p>Start the conversation by sending your first message below</p>
                    </div>
                  )}
                  {conversationMessages.map((m, idx) => (
                    <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                      <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border/60 bg-muted/50'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="text-left">
                      <div className="inline-block px-3 py-2 rounded-md text-sm bg-muted text-muted-foreground animate-pulse">
                        Customer is typing...
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
            )}
            {trainingMode === 'voice' && (
              <div className="h-[360px] rounded-2xl bg-gradient-to-br from-[#F4E7D3] via-background to-[#E7EDF6] p-6">
                <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background shadow-sm ring-8 ring-white/70">
                    <Phone className="h-9 w-9 text-[#A25B2A]" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">Call in Progress</p>
                    <p className="max-w-sm text-sm text-muted-foreground">Listen for the customer cue, respond with one focused step at a time, and avoid over-explaining.</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant={listening ? 'destructive' : 'outline'}>{listening ? 'Listening' : 'Awaiting your turn'}</Badge>
                    <Badge variant={isSpeaking ? 'secondary' : 'outline'}>{isSpeaking ? 'Customer speaking' : 'Customer idle'}</Badge>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {trainingMode === 'voice' && speechSupported && (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id="auto-speak"
                    checked={autoSpeak}
                    onChange={(e) => setAutoSpeak(e.target.checked)}
                    className="rounded"
                    aria-label="Auto-play AI responses"
                  />
                  <label htmlFor="auto-speak" className="text-muted-foreground">
                    Auto-play AI responses
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {trainingMode === 'voice' ? (
                  <>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50">
                      {listening && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                          <span className="text-sm text-muted-foreground">Listening...</span>
                        </div>
                      )}
                      <span className="text-sm flex-1">{input || (isSpeaking ? 'Customer speaking…' : 'Speak naturally…')}</span>
                    </div>
                    <Button
                      variant={listening ? 'destructive' : 'outline'}
                      onClick={handleListen}
                      disabled={!sttSupported || micPermission === 'denied' || isProcessingRef.current || isLoading}
                      className="gap-2"
                      aria-label={listening ? 'Stop listening and end your turn' : 'Start talking - begin your response'}
                      aria-pressed={listening}
                    >
                      {listening ? (
                        <>
                          <MicOff className="w-4 h-4" aria-hidden="true" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" aria-hidden="true" />
                          Talk
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => setEndSessionConfirmOpen(true)} 
                      className="gap-2"
                      disabled={endingSession}
                      aria-label="End call and complete training session"
                    >
                      <PhoneOff className="w-4 h-4" aria-hidden="true" />
                      End Call
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Your reply…"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      aria-label="Type your message to the customer"
                      aria-describedby="chat-input-hint"
                    />
                    <span id="chat-input-hint" className="sr-only">Press Enter to send message</span>
                    {sttSupported && (
                      <Button 
                        variant={listening ? 'destructive' : 'outline'} 
                        onClick={handleListen}
                        aria-label={listening ? 'Stop voice input' : 'Use voice to dictate message'}
                        aria-pressed={listening}
                      >
                        {listening ? 'Stop' : 'Speak'}
                      </Button>
                    )}
                    {speechSupported && (
                      <Button 
                        variant="secondary" 
                        onClick={() => speak(messages.filter(m => m.role === 'assistant').at(-1)?.content || '')}
                        aria-label="Listen to last AI message using text-to-speech"
                      >
                        Listen
                      </Button>
                    )}
                    <Button 
                      onClick={handleSend} 
                      disabled={isLoading || !input.trim()}
                      aria-label="Send message to customer"
                      aria-disabled={isLoading || !input.trim()}
                    >
                      Send
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => setEndSessionConfirmOpen(true)}
                      disabled={endingSession}
                      aria-label="End chat and complete training session"
                    >
                      End Session
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}

export default TrainingSimulator;