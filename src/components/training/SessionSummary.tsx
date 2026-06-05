import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, TrendingUp, AlertCircle, Clock, MessageSquare, ChevronDown, ChevronUp, Target, RotateCcw } from 'lucide-react';
import { TrainingSessionRecord } from '@/lib/training/types';

interface Props {
  record: TrainingSessionRecord;
  onNewSession: () => void;
}

export function SessionSummary({ record, onNewSession }: Props) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const evaln = record.evaluation;
  
  // Calculate duration in minutes and seconds
  const durationMs = record.endedAt && record.startedAt 
    ? record.endedAt - record.startedAt
    : 0;
  const durationMins = Math.floor(durationMs / 60000);
  const durationSecs = Math.round((durationMs % 60000) / 1000);
  const durationDisplay = durationMins > 0 
    ? `${durationMins}m ${durationSecs}s` 
    : `${durationSecs}s`;

  // Filter out evaluation prompt from transcript for display
  const displayTranscript = record.transcript.filter(m => 
    !m.content.includes('You are now an evaluator') && 
    !m.content.includes('--- CONVERSATION TRANSCRIPT ---')
  );
  
  const userTurns = displayTranscript.filter(m => m.role === 'user').length;
  const aiTurns = displayTranscript.filter(m => m.role === 'assistant').length;
  
  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };
  
  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
    return 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800';
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Training Complete
          </CardTitle>
          <Button onClick={onNewSession} variant="outline" size="sm" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            New Session
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score and Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${getScoreBg(evaln?.overallScore || 0)}`}>
            <div className="text-sm text-muted-foreground mb-1">Overall Score</div>
            <div className={`text-3xl font-bold ${getScoreColor(evaln?.overallScore || 0)}`}>
              {evaln?.overallScore || 0}
              <span className="text-lg font-normal text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5" />
              Duration
            </div>
            <div className="text-2xl font-bold">{durationDisplay}</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Exchanges
            </div>
            <div className="text-2xl font-bold">{displayTranscript.length}</div>
            <div className="text-xs text-muted-foreground">You: {userTurns} | AI: {aiTurns}</div>
          </div>
        </div>

        {!evaln ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Evaluation not available for this session</p>
          </div>
        ) : (
          <>
            {/* AI Summary */}
            {evaln.aiSummary && (
              <div className="rounded-lg border p-4 bg-gradient-to-br from-muted/30 to-muted/10">
                <div className="flex items-start gap-2 mb-3">
                  <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="font-semibold text-sm">Session Summary</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {evaln.aiSummary}
                </p>
              </div>
            )}

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evaln.strengths && evaln.strengths.length > 0 && (
                <div className="rounded-lg border p-4 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-sm text-green-700 dark:text-green-300">What You Did Well</span>
                  </div>
                  <ul className="space-y-2">
                    {evaln.strengths.map((s, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0">✓</span>
                        <span className="text-foreground/90">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {evaln.improvements && evaln.improvements.length > 0 && (
                <div className="rounded-lg border p-4 bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-semibold text-sm text-orange-700 dark:text-orange-300">Areas to Improve</span>
                  </div>
                  <ul className="space-y-2">
                    {evaln.improvements.map((s, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0">→</span>
                        <span className="text-foreground/90">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Category Scores */}
            {evaln.categoryScores && evaln.categoryScores.length > 0 && (
              <div className="rounded-lg border p-4">
                <div className="font-semibold text-sm mb-4">Performance by Category</div>
                <div className="space-y-3">
                  {evaln.categoryScores.map((c, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{c.categoryId.replace(/_/g, ' ')}</span>
                        <Badge 
                          variant="outline" 
                          className={c.score >= 4 ? 'border-green-300 text-green-700 dark:text-green-400' : c.score >= 3 ? 'border-yellow-300 text-yellow-700 dark:text-yellow-400' : 'border-orange-300 text-orange-700 dark:text-orange-400'}
                        >
                          {c.score}/5
                        </Badge>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${c.score >= 4 ? 'bg-green-500' : c.score >= 3 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                          style={{ width: `${(c.score / 5) * 100}%` }}
                        />
                      </div>
                      {c.notes && (
                        <p className="text-xs text-muted-foreground leading-snug">{c.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Transcript - Collapsible */}
            {displayTranscript.length > 0 && (
              <Collapsible open={showFullTranscript} onOpenChange={setShowFullTranscript}>
                <div className="rounded-lg border">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Full Conversation Transcript</span>
                        <Badge variant="secondary" className="text-xs">{displayTranscript.length} messages</Badge>
                      </div>
                      {showFullTranscript ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      <ScrollArea className="h-[300px] p-4">
                        <div className="space-y-3">
                          {displayTranscript.map((m, i) => (
                            <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                              <div className="text-xs text-muted-foreground mb-1">
                                {m.role === 'user' ? 'You (Trainee)' : 'Customer (AI)'}
                              </div>
                              <div className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] ${
                                m.role === 'user' 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted'
                              }`}>
                                {m.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SessionSummary;