import { useMemo, useState, useEffect, useRef } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertCircle, Target, Sparkles } from 'lucide-react';
import { TrainingModule } from '@/lib/training/types';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  module: TrainingModule;
  latestUserMessage?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AIFeedback {
  type: 'tip' | 'warning' | 'success';
  message: string;
  category?: string;
}

/**
 * AI-powered feedback generation using conversation context and rubric
 */
async function generateAIFeedback(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  module: TrainingModule
): Promise<AIFeedback[]> {
  try {
    // Build rubric context for AI
    const rubricContext = module.rubric
      ?.map(cat => `${cat.name}: ${cat.guidelines.join('; ')}`)
      .join('\n') || 'No specific rubric';

    // Get last 6 messages for context (3 exchanges)
    const recentHistory = conversationHistory.slice(-6);
    const conversationText = recentHistory
      .map(msg => `${msg.role === 'user' ? 'Trainee' : 'Customer'}: ${msg.content}`)
      .join('\n');

    // System prompt for coaching
    const systemPrompt = `You are an expert sales coach analyzing a live training conversation. 
Provide 2-3 specific, actionable coaching tips based on the rubric and conversation.

RUBRIC CRITERIA:
${rubricContext}

CONVERSATION:
${conversationText}

Return a JSON array of feedback items. Each item should have:
- type: "tip" | "warning" | "success"
- message: specific, actionable feedback (max 120 chars)
- category: rubric category name (if applicable)

Focus on:
1. What the trainee is doing well (success)
2. Immediate improvements needed (warning)
3. Next best action to take (tip)

Example format:
[
  {"type": "success", "message": "Great use of empathy - you acknowledged their concern effectively", "category": "Rapport Building"},
  {"type": "warning", "message": "Response too long - aim for 2-3 sentences for clarity", "category": "Communication"},
  {"type": "tip", "message": "Ask a discovery question to understand their needs better"}
]`;

    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message: systemPrompt,
        conversationHistory: [],
        platform: 'training-feedback',
      },
    });

    if (error || !data?.response) {
      devError('AI feedback error:', error);
      return [];
    }

    // Parse AI response
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = data.response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        devError('No JSON array found in AI response');
        return [];
      }

      const feedback: AIFeedback[] = JSON.parse(jsonMatch[0]);
      return feedback.slice(0, 3); // Limit to 3 items
    } catch (parseError) {
      devError('Failed to parse AI feedback:', parseError);
      return [];
    }
  } catch (error) {
    devError('AI feedback generation failed:', error);
    return [];
  }
}

/**
 * Legacy keyword-based analysis (fallback)
 */

function analyzeConversation(
  userMsg?: string, 
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  module?: TrainingModule
) {
  const advice: Array<{ type: 'tip' | 'warning' | 'success'; message: string; category?: string }> = [];
  
  if (!conversationHistory || conversationHistory.length === 0) {
    return advice;
  }

  // Get the last few messages for context
  const recentMessages = conversationHistory.slice(-4);
  const lastLeadMessage = recentMessages.filter(m => m.role === 'assistant').pop()?.content || '';
  const lastTraineeMessage = userMsg || recentMessages.filter(m => m.role === 'user').pop()?.content || '';
  
  // Analyze lead's message for sentiment and intent
  const leadLower = lastLeadMessage.toLowerCase();
  const traineeLower = lastTraineeMessage.toLowerCase();
  
  // ===== RUBRIC-BASED COACHING =====
  if (module?.rubric) {
    module.rubric.forEach(category => {
      const categoryLower = category.name.toLowerCase();
      const guidelines = category.guidelines.map(g => g.toLowerCase());
      
      // Check for empathy-related rubric categories
      if (categoryLower.includes('empathy') || categoryLower.includes('rapport') || categoryLower.includes('understanding')) {
        const empathyWords = ['understand', 'appreciate', 'hear you', 'make sense', 'i see', 'that must', 'sounds like', 'i get that'];
        const hasEmpathy = empathyWords.some(word => traineeLower.includes(word));
        
        // Check if lead is expressing emotion
        const emotionalWords = ['frustrated', 'worried', 'concerned', 'excited', 'confused', 'happy', 'upset', 'angry'];
        const leadEmotional = emotionalWords.some(word => leadLower.includes(word));
        
        if (leadEmotional && !hasEmpathy) {
          advice.push({
            type: 'warning',
            message: `The customer is expressing emotion. ${category.guidelines[0] || 'Acknowledge their feelings before moving forward.'}`,
            category: category.name,
          });
        } else if (hasEmpathy && leadEmotional) {
          advice.push({
            type: 'success',
            message: `Great ${category.name.toLowerCase()}! You acknowledged the customer's feelings effectively.`,
            category: category.name,
          });
        }
      }
      
      // Check for clarity-related rubric categories
      if (categoryLower.includes('clarity') || categoryLower.includes('clear') || categoryLower.includes('communication')) {
        if (lastTraineeMessage.length > 200) {
          advice.push({
            type: 'warning',
            message: `Keep responses concise for better ${category.name.toLowerCase()}. ${category.guidelines[0] || 'Aim for 2-3 sentences.'}`,
            category: category.name,
          });
        }
        
        const structureWords = ['first', 'second', 'next', 'then', 'finally', 'here are', 'let me explain'];
        const hasStructure = structureWords.some(word => traineeLower.includes(word));
        
        if (hasStructure && lastTraineeMessage.length > 50) {
          advice.push({
            type: 'success',
            message: `Good use of structured communication for ${category.name.toLowerCase()}.`,
            category: category.name,
          });
        }
      }
      
      // Check for problem-solving rubric categories
      if (categoryLower.includes('solution') || categoryLower.includes('problem') || categoryLower.includes('resolution')) {
        const solutionWords = ['let me', 'i can', 'here\'s what', 'we can', 'option', 'solution', 'recommend'];
        const offersSolution = solutionWords.some(word => traineeLower.includes(word));
        
        if (leadLower.includes('problem') || leadLower.includes('issue') || leadLower.includes('help')) {
          if (!offersSolution) {
            advice.push({
              type: 'tip',
              message: `The customer has a problem. ${category.guidelines[0] || 'Offer a clear solution or next steps.'}`,
              category: category.name,
            });
          } else {
            advice.push({
              type: 'success',
              message: `Good ${category.name.toLowerCase()}! You're offering actionable solutions.`,
              category: category.name,
            });
          }
        }
      }
      
      // Check for closing/conversion rubric categories
      if (categoryLower.includes('closing') || categoryLower.includes('conversion') || categoryLower.includes('action')) {
        const buyingSignals = ['how much', 'pricing', 'cost', 'when can', 'next steps', 'sign up', 'get started'];
        const hasBuyingSignal = buyingSignals.some(signal => leadLower.includes(signal));
        
        const closingPhrases = ['shall we', 'would you like', 'ready to', 'let\'s get', 'can i get', 'sound good'];
        const isClosing = closingPhrases.some(phrase => traineeLower.includes(phrase));
        
        if (hasBuyingSignal && !isClosing && conversationHistory.length > 6) {
          advice.push({
            type: 'tip',
            message: `Buying signal detected! ${category.guidelines[0] || 'Now is a good time to ask for commitment.'}`,
            category: category.name,
          });
        }
      }
    });
  }
  
  // ===== GENERAL COACHING (if no rubric-specific advice) =====
  if (advice.length === 0) {
    // Detect frustration or negative sentiment from lead
    const frustrationWords = ['frustrated', 'annoyed', 'upset', 'disappointed', 'angry', 'confused', 'dont understand', "don't understand", 'not sure', 'why', 'problem'];
    const isFrustrated = frustrationWords.some(word => leadLower.includes(word));
    
    if (isFrustrated && !traineeLower.includes('understand') && !traineeLower.includes('sorry') && !traineeLower.includes('apologize')) {
      advice.push({
        type: 'warning',
        message: 'The lead seems frustrated. Acknowledge their feelings first: "I understand your frustration..." or "I appreciate you bringing this up..."'
      });
    }
    
    // Detect questions from lead
    const leadQuestions = (lastLeadMessage.match(/\?/g) || []).length;
    if (leadQuestions > 0 && lastTraineeMessage && !lastTraineeMessage.includes('?')) {
      const hasDirectAnswer = traineeLower.match(/yes|no|absolutely|definitely|sure|of course/);
      if (!hasDirectAnswer) {
        advice.push({
          type: 'tip',
          message: 'The lead asked a question. Provide a clear, direct answer first, then expand with details if needed.'
        });
      }
    }
    
    // Detect objections
    const objectionPhrases = ['too expensive', 'too much', 'cant afford', "can't afford", 'not in budget', 'already have', 'not interested', 'not sure if'];
    const hasObjection = objectionPhrases.some(phrase => leadLower.includes(phrase));
    
    if (hasObjection && traineeLower.length < 50) {
      advice.push({
        type: 'warning',
        message: 'Objection detected! Don\'t push back immediately. Use the feel-felt-found technique: "I understand how you feel. Others felt the same way. Here\'s what they found..."'
      });
    }
    
    // Check if trainee is asking questions (good!)
    const traineeQuestions = (lastTraineeMessage.match(/\?/g) || []).length;
    if (traineeQuestions === 0 && conversationHistory.length > 2) {
      advice.push({
        type: 'tip',
        message: 'Ask discovery questions to understand their needs better. Try: "What prompted you to look for a solution?" or "What challenges are you currently facing?"'
      });
    }
    
    // Detect buying signals
    const buyingSignals = ['how much', 'pricing', 'cost', 'when can', 'how soon', 'next steps', 'sign up', 'get started', 'trial', 'demo'];
    const hasBuyingSignal = buyingSignals.some(signal => leadLower.includes(signal));
    
    if (hasBuyingSignal) {
      advice.push({
        type: 'success',
        message: '🎯 Buying signal detected! They\'re interested. Provide clear next steps and create urgency: "I can get you started today..." or "Let me show you exactly how this works..."'
      });
    }
    
    // Check empathy usage
    const empathyWords = ['understand', 'appreciate', 'hear you', 'make sense', 'i see', 'that must', 'sounds like'];
    const hasEmpathy = empathyWords.some(word => traineeLower.includes(word));
    
    if (!hasEmpathy && conversationHistory.length > 3) {
      advice.push({
        type: 'tip',
        message: 'Build rapport by showing empathy. Use phrases like "I understand" or "That makes sense" to validate their concerns.'
      });
    }
    
    // Check for clarity and structure
    const structureWords = ['first', 'second', 'next', 'then', 'finally', 'let me break', 'here are', 'three things'];
    const hasStructure = structureWords.some(word => traineeLower.includes(word));
    
    if (lastTraineeMessage.length > 100 && !hasStructure) {
      advice.push({
        type: 'tip',
        message: 'Structure your response for clarity. Use "First... Second... Third..." or "Here are three key points..." to make it easier to follow.'
      });
    }
    
    // Success reinforcement
    const traineeQuestions2 = (lastTraineeMessage.match(/\?/g) || []).length;
    if (traineeQuestions2 > 0 && hasEmpathy && lastTraineeMessage.length < 150) {
      advice.push({
        type: 'success',
        message: '✅ Great job! You\'re asking questions, showing empathy, and keeping it concise. Keep this momentum!'
      });
    }
  }
  
  // Module-specific advice
  if (module?.industry === 'saas') {
    if (!traineeLower.includes('demo') && !traineeLower.includes('show you') && conversationHistory.length > 4) {
      const hasSaasTip = advice.some(a => a.message.includes('demo'));
      if (!hasSaasTip) {
        advice.push({
          type: 'tip',
          message: 'For SaaS: Offer a demo or walkthrough. "Let me show you how this solves your exact problem..."'
        });
      }
    }
  }
  
  if (module?.industry === 'hospitality') {
    if (!traineeLower.includes('experience') && !traineeLower.includes('enjoy') && conversationHistory.length > 3) {
      const hasHospitalityTip = advice.some(a => a.message.includes('experience'));
      if (!hasHospitalityTip) {
        advice.push({
          type: 'tip',
          message: 'Focus on experience: "Imagine arriving to..." or "Picture yourself enjoying..." - paint a vivid picture.'
        });
      }
    }
  }
  
  return advice;
}

export function LiveFeedbackPanel({ module, latestUserMessage, conversationHistory }: Props) {
  const [aiFeedback, setAIFeedback] = useState<AIFeedback[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [useAIPowered, setUseAIPowered] = useState(true); // Toggle for AI vs keyword
  const lastAICallRef = useRef<number>(0);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fallback keyword-based feedback
  const keywordAdvice = useMemo(
    () => analyzeConversation(latestUserMessage, conversationHistory, module),
    [latestUserMessage, conversationHistory, module]
  );

  // AI-powered feedback with debouncing
  useEffect(() => {
    // Only generate AI feedback every 2-3 exchanges (4-6 messages)
    if (!conversationHistory || conversationHistory.length < 4 || !useAIPowered) {
      return;
    }

    // Debounce: wait 2 seconds after last message before generating feedback
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // Only call AI after significant progress (every 2 exchanges = 4 messages)
    const messagesSinceLastCall = conversationHistory.length - lastAICallRef.current;
    if (messagesSinceLastCall < 4) {
      return;
    }

    feedbackTimeoutRef.current = setTimeout(async () => {
      setIsLoadingAI(true);
      try {
        const feedback = await generateAIFeedback(conversationHistory, module);
        if (feedback.length > 0) {
          setAIFeedback(feedback);
          lastAICallRef.current = conversationHistory.length;
        }
      } catch (error) {
        devError('Failed to generate AI feedback:', error);
        // Fall back to keyword-based advice on error
        setUseAIPowered(false);
      } finally {
        setIsLoadingAI(false);
      }
    }, 2000); // 2 second debounce

    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [conversationHistory, module, useAIPowered]);

  // Use AI feedback if available, otherwise fall back to keyword-based
  const advice = useAIPowered && aiFeedback.length > 0 ? aiFeedback : keywordAdvice;

  // Group by category if available
  const groupedAdvice = useMemo(() => {
    const withCategory = advice.filter(a => a.category);
    const withoutCategory = advice.filter(a => !a.category);
    return { withCategory, withoutCategory };
  }, [advice]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {useAIPowered && aiFeedback.length > 0 ? (
            <Sparkles className="w-4 h-4 text-primary" />
          ) : (
            <Lightbulb className="w-4 h-4 text-primary" />
          )}
          Live Coaching
          {useAIPowered && aiFeedback.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              AI-Powered
            </Badge>
          )}
          {isLoadingAI && (
            <Badge variant="outline" className="text-xs ml-auto animate-pulse">
              Analyzing...
            </Badge>
          )}
        </CardTitle>
        {module.rubric && module.rubric.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {module.rubric.slice(0, 4).map(r => (
              <Badge key={r.id} variant="outline" className="text-xs">
                <Target className="w-3 h-3 mr-1" />
                {r.name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {advice.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
              <TrendingUp className="w-4 h-4" />
              <span>Keep going! Coaching tips will appear as you progress...</span>
            </div>
          ) : (
            <>
              {/* Rubric-specific feedback */}
              {groupedAdvice.withCategory.map((item, i) => (
                <div
                  key={`cat-${i}`}
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    item.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/20'
                      : item.type === 'warning'
                      ? 'bg-orange-500/10 border border-orange-500/20'
                      : 'bg-blue-500/10 border border-blue-500/20'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {item.type === 'success' ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : item.type === 'warning' ? (
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                    ) : (
                      <Lightbulb className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {item.category && (
                      <Badge variant="secondary" className="text-xs mb-1">
                        {item.category}
                      </Badge>
                    )}
                    <span className="leading-relaxed block">{item.message}</span>
                  </div>
                </div>
              ))}
              
              {/* General feedback */}
              {groupedAdvice.withoutCategory.map((item, i) => (
                <div
                  key={`gen-${i}`}
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    item.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/20'
                      : item.type === 'warning'
                      ? 'bg-orange-500/10 border border-orange-500/20'
                      : 'bg-blue-500/10 border border-blue-500/20'
                  }`}
                >
                  {item.type === 'success' ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : item.type === 'warning' ? (
                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  )}
                  <span className="leading-relaxed">{item.message}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default LiveFeedbackPanel;
