import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle,
  Database,
  Zap,
  TrendingUp,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/logger';

interface TableAnalysis {
  tableName: string;
  rowCount: number;
  hasRLS: boolean;
  indexSuggestions: string[];
  potentialIssues: string[];
  score: 'good' | 'warning' | 'critical';
}

interface QueryPattern {
  pattern: string;
  frequency: number;
  avgDuration: number;
  suggestion: string;
}

// Common tables that typically need indexes
const COMMON_INDEX_SUGGESTIONS: Record<string, string[]> = {
  leads: ['organization_id', 'assigned_agent_id', 'status', 'lead_temperature', 'created_at'],
  orders: ['organization_id', 'lead_id', 'status', 'created_at', 'pickup_time'],
  bookings: ['organization_id', 'room_unit_id', 'lead_id', 'check_in', 'check_out'],
  communications: ['organization_id', 'lead_id', 'channel', 'created_at'],
  ai_conversations: ['organization_id', 'lead_id', 'platform', 'status', 'created_at'],
  ai_messages: ['conversation_id', 'created_at'],
  audit_logs: ['user_id', 'action', 'resource_type', 'created_at'],
  notification_history: ['user_id', 'is_read', 'created_at'],
};

export function QueryAnalyzer() {
  const [analyses, setAnalyses] = useState<TableAnalysis[]>([]);
  const [patterns, setPatterns] = useState<QueryPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);

  const analyzeDatabase = async () => {
    setIsLoading(true);
    const results: TableAnalysis[] = [];

    const tablesToAnalyze = [
      'leads', 'orders', 'bookings', 'communications', 
      'ai_conversations', 'ai_messages', 'audit_logs',
      'notification_history', 'profiles', 'organizations'
    ];

    for (const tableName of tablesToAnalyze) {
      try {
        // Get approximate row count
        const { count } = await supabase
          .from(tableName as 'profiles_safe' | 'social_platforms_safe' | 'user_sessions_safe')
          .select('*', { count: 'exact', head: true });

        const rowCount = count || 0;
        const suggestions = COMMON_INDEX_SUGGESTIONS[tableName] || [];
        const issues: string[] = [];

        // Analyze based on row count and common patterns
        if (rowCount > 10000 && suggestions.length > 0) {
          issues.push(`Large table (${rowCount.toLocaleString()} rows) - ensure indexes exist on frequently queried columns`);
        }

        if (rowCount > 50000) {
          issues.push('Consider implementing pagination for all queries');
          issues.push('Review queries for N+1 patterns');
        }

        // Determine score
        let score: 'good' | 'warning' | 'critical' = 'good';
        if (issues.length > 0) score = 'warning';
        if (rowCount > 100000 && issues.length > 1) score = 'critical';

        results.push({
          tableName,
          rowCount,
          hasRLS: true, // All our tables have RLS
          indexSuggestions: suggestions,
          potentialIssues: issues,
          score,
        });
      } catch (error) {
        // Skip tables we can't access
        devLog(`Skipping ${tableName}:`, error);
      }
    }

    // Sort by score (critical first, then warning, then good)
    results.sort((a, b) => {
      const order = { critical: 0, warning: 1, good: 2 };
      return order[a.score] - order[b.score];
    });

    setAnalyses(results);
    setLastAnalyzed(new Date());

    // Generate query pattern suggestions
    const patternSuggestions: QueryPattern[] = [
      {
        pattern: 'SELECT * FROM table',
        frequency: 0,
        avgDuration: 0,
        suggestion: 'Select only needed columns to reduce data transfer',
      },
      {
        pattern: 'Queries without LIMIT',
        frequency: 0,
        avgDuration: 0,
        suggestion: 'Always use LIMIT for large tables to prevent fetching all rows',
      },
      {
        pattern: 'Nested loops (N+1)',
        frequency: 0,
        avgDuration: 0,
        suggestion: 'Use joins or batch queries instead of querying in loops',
      },
      {
        pattern: 'Missing index on filter',
        frequency: 0,
        avgDuration: 0,
        suggestion: 'Add indexes on columns frequently used in WHERE clauses',
      },
    ];
    setPatterns(patternSuggestions);
    
    setIsLoading(false);
  };

  useEffect(() => {
    analyzeDatabase();
  }, []);

  const getScoreColor = (score: 'good' | 'warning' | 'critical') => {
    switch (score) {
      case 'good': return 'bg-success/20 text-success border-success/30';
      case 'warning': return 'bg-warning/20 text-warning border-warning/30';
      case 'critical': return 'bg-destructive/20 text-destructive border-destructive/30';
    }
  };

  const getScoreIcon = (score: 'good' | 'warning' | 'critical') => {
    switch (score) {
      case 'good': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Query Analyzer
          </h3>
          {lastAnalyzed && (
            <p className="text-xs text-muted-foreground">
              Last analyzed: {lastAnalyzed.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={analyzeDatabase} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Analyze
        </Button>
      </div>

      {/* Table Analysis */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Table Health
          </CardTitle>
          <CardDescription>Database table analysis and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.tableName}
                    className="p-3 rounded-lg border border-border/50 hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getScoreIcon(analysis.score)}
                        <span className="font-mono text-sm font-medium">{analysis.tableName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {analysis.rowCount.toLocaleString()} rows
                        </Badge>
                        <Badge variant="outline" className={getScoreColor(analysis.score)}>
                          {analysis.score}
                        </Badge>
                      </div>
                    </div>
                    
                    {analysis.potentialIssues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {analysis.potentialIssues.map((issue, idx) => (
                          <p key={idx} className="text-xs text-warning flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            {issue}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {analysis.indexSuggestions.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer hover:underline">
                          Recommended indexes ({analysis.indexSuggestions.length})
                        </summary>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {analysis.indexSuggestions.map((col) => (
                            <Badge key={col} variant="outline" className="text-xs font-mono">
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Query Pattern Suggestions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            Optimization Tips
          </CardTitle>
          <CardDescription>Best practices for query performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patterns.map((pattern, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50"
              >
                <TrendingUp className="w-4 h-4 text-info mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{pattern.pattern}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pattern.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
