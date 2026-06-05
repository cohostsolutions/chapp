import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  AlertTriangle, 
  CheckCircle,
  ArrowRight,
  Database,
  Search,
  Filter,
  Layers,
  Clock,
  Info
} from 'lucide-react';

interface QueryPlanNode {
  operation: string;
  table?: string;
  cost: number;
  rows: number;
  width: number;
  conditions?: string[];
  children?: QueryPlanNode[];
  isBottleneck?: boolean;
  suggestion?: string;
}

interface PlanAnalysis {
  plan: QueryPlanNode;
  totalCost: number;
  bottlenecks: string[];
  suggestions: string[];
  indexRecommendations: string[];
}

// Sample query patterns and their analysis
const QUERY_PATTERNS = {
  'SELECT * FROM': {
    issue: 'Selecting all columns',
    suggestion: 'Select only needed columns to reduce I/O and memory usage',
    severity: 'warning',
  },
  'WHERE.*=': {
    issue: 'Equality filter',
    suggestion: 'Ensure column has an index for fast lookups',
    severity: 'info',
  },
  'ORDER BY': {
    issue: 'Sorting operation',
    suggestion: 'Create index on ORDER BY columns to avoid in-memory sort',
    severity: 'info',
  },
  'JOIN': {
    issue: 'Join operation',
    suggestion: 'Ensure join columns are indexed on both tables',
    severity: 'warning',
  },
  'LIKE.*%': {
    issue: 'Pattern matching with leading wildcard',
    suggestion: 'Leading wildcards prevent index usage - consider full-text search',
    severity: 'warning',
  },
  'NOT IN': {
    issue: 'NOT IN subquery',
    suggestion: 'Consider using NOT EXISTS or LEFT JOIN for better performance',
    severity: 'warning',
  },
  'DISTINCT': {
    issue: 'Distinct values',
    suggestion: 'May cause sorting - ensure underlying query is optimized',
    severity: 'info',
  },
};

export function QueryPlanViewer() {
  const [query, setQuery] = useState('');
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeQuery = () => {
    if (!query.trim()) return;
    
    setIsAnalyzing(true);
    
    // Simulate query analysis (in a real app, this would call the database EXPLAIN)
    setTimeout(() => {
      const upperQuery = query.toUpperCase();
      const suggestions: string[] = [];
      const bottlenecks: string[] = [];
      const indexRecommendations: string[] = [];

      // Analyze query patterns
      Object.entries(QUERY_PATTERNS).forEach(([pattern, info]) => {
        if (new RegExp(pattern, 'i').test(query)) {
          if (info.severity === 'warning') {
            bottlenecks.push(info.issue);
          }
          suggestions.push(info.suggestion);
        }
      });

      // Extract table names for index recommendations
      const tableMatch = query.match(/FROM\s+(\w+)/i);
      const whereMatch = query.match(/WHERE\s+(\w+)\s*=/i);
      
      if (tableMatch && whereMatch) {
        indexRecommendations.push(
          `CREATE INDEX idx_${tableMatch[1]}_${whereMatch[1]} ON ${tableMatch[1]}(${whereMatch[1]});`
        );
      }

      // Generate simulated plan
      const plan: QueryPlanNode = generateSimulatedPlan(query);
      
      setAnalysis({
        plan,
        totalCost: plan.cost,
        bottlenecks,
        suggestions,
        indexRecommendations,
      });
      
      setIsAnalyzing(false);
    }, 500);
  };

  const generateSimulatedPlan = (sql: string): QueryPlanNode => {
    const upperSql = sql.toUpperCase();
    const hasJoin = /JOIN/i.test(sql);
    const hasWhere = /WHERE/i.test(sql);
    const hasOrderBy = /ORDER BY/i.test(sql);
    const hasGroupBy = /GROUP BY/i.test(sql);

    // Base scan operation
    let rootNode: QueryPlanNode = {
      operation: hasWhere ? 'Index Scan' : 'Seq Scan',
      table: sql.match(/FROM\s+(\w+)/i)?.[1] || 'unknown',
      cost: hasWhere ? 12.5 : 150.0,
      rows: hasWhere ? 100 : 10000,
      width: 64,
      conditions: hasWhere ? [sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i)?.[1] || ''] : undefined,
      isBottleneck: !hasWhere,
      suggestion: !hasWhere ? 'Consider adding WHERE clause to limit rows' : undefined,
    };

    // Add join node if present
    if (hasJoin) {
      rootNode = {
        operation: 'Hash Join',
        cost: rootNode.cost + 50,
        rows: rootNode.rows,
        width: 128,
        isBottleneck: true,
        suggestion: 'Ensure join columns are indexed',
        children: [
          rootNode,
          {
            operation: 'Hash',
            cost: 25,
            rows: 500,
            width: 32,
            children: [{
              operation: 'Seq Scan',
              table: sql.match(/JOIN\s+(\w+)/i)?.[1] || 'joined_table',
              cost: 20,
              rows: 500,
              width: 32,
            }],
          },
        ],
      };
    }

    // Add sort node if ORDER BY
    if (hasOrderBy) {
      rootNode = {
        operation: 'Sort',
        cost: rootNode.cost + 25,
        rows: rootNode.rows,
        width: rootNode.width,
        conditions: [sql.match(/ORDER BY\s+(.+?)(?:LIMIT|$)/i)?.[1] || ''],
        isBottleneck: rootNode.rows > 1000,
        suggestion: rootNode.rows > 1000 ? 'Large sort - consider index on ORDER BY columns' : undefined,
        children: [rootNode],
      };
    }

    // Add aggregate node if GROUP BY
    if (hasGroupBy) {
      rootNode = {
        operation: 'HashAggregate',
        cost: rootNode.cost + 35,
        rows: Math.min(rootNode.rows, 100),
        width: 48,
        conditions: [sql.match(/GROUP BY\s+(.+?)(?:HAVING|ORDER|LIMIT|$)/i)?.[1] || ''],
        children: [rootNode],
      };
    }

    return rootNode;
  };

  const renderPlanNode = (node: QueryPlanNode, depth: number = 0): JSX.Element => {
    const getOperationIcon = (op: string) => {
      if (op.includes('Scan')) return <Database className="w-4 h-4" />;
      if (op.includes('Join')) return <Layers className="w-4 h-4" />;
      if (op.includes('Sort')) return <Filter className="w-4 h-4" />;
      if (op.includes('Hash')) return <Search className="w-4 h-4" />;
      return <ArrowRight className="w-4 h-4" />;
    };

    return (
      <div key={`${node.operation}-${depth}`} className="relative">
        <div 
          className={`p-3 rounded-lg border ${
            node.isBottleneck 
              ? 'border-warning/50 bg-warning/5' 
              : 'border-border/50 bg-muted/30'
          }`}
          style={{ marginLeft: depth * 24 }}
        >
          <div className="flex items-center gap-2">
            {getOperationIcon(node.operation)}
            <span className="font-medium text-sm">{node.operation}</span>
            {node.table && (
              <Badge variant="secondary" className="text-xs font-mono">
                {node.table}
              </Badge>
            )}
            {node.isBottleneck && (
              <AlertTriangle className="w-4 h-4 text-warning" />
            )}
          </div>
          
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Cost: {node.cost.toFixed(2)}
            </span>
            <span>Rows: {node.rows.toLocaleString()}</span>
            <span>Width: {node.width}</span>
          </div>
          
          {node.conditions && node.conditions.length > 0 && (
            <div className="mt-2 text-xs font-mono text-muted-foreground bg-muted/50 p-2 rounded">
              {node.conditions.join(', ')}
            </div>
          )}
          
          {node.suggestion && (
            <div className="mt-2 text-xs text-warning flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              {node.suggestion}
            </div>
          )}
        </div>
        
        {node.children && (
          <div className="mt-2 space-y-2">
            {node.children.map((child, idx) => renderPlanNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Query Input */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Query Execution Plan Analyzer
          </CardTitle>
          <CardDescription>
            Paste a SQL query to analyze its execution plan and get optimization suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="SELECT * FROM leads WHERE status = 'new' ORDER BY created_at DESC LIMIT 100"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="font-mono text-sm min-h-[100px]"
          />
          <Button onClick={analyzeQuery} disabled={!query.trim() || isAnalyzing}>
            <Play className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'Analyze Query'}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {analysis.totalCost.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {analysis.bottlenecks.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Bottlenecks</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-info/10">
                    <CheckCircle className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {analysis.suggestions.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Suggestions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visual Plan */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Execution Plan</CardTitle>
              <CardDescription>Visual representation of query execution</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {renderPlanNode(analysis.plan)}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Suggestions & Index Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analysis.suggestions.length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4 text-info" />
                    Optimization Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis.indexRecommendations.length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Recommended Indexes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.indexRecommendations.map((rec, idx) => (
                      <code key={idx} className="block text-xs p-2 bg-muted rounded font-mono">
                        {rec}
                      </code>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
