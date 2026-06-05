import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgentPerformanceData } from '@/hooks/useReportingData';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Trophy } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface AgentPerformanceTableProps {
  title?: string;
  emptyText?: string;
  assignedLabel?: string;
  completedLabel?: string;
  rateLabel?: string;
}

export function AgentPerformanceTable({
  title = 'Agent Performance',
  emptyText = 'No agent activity yet. Assign leads to agents to track performance.',
  assignedLabel = 'Leads Assigned',
  completedLabel = 'Converted',
  rateLabel = 'Conversion Rate',
}: AgentPerformanceTableProps) {
  const { data, isLoading, error } = useAgentPerformanceData();

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Failed to load agent data.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {data.map((agent, idx) => (
            <div key={agent.agentId} className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {idx === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                    {idx === 1 && <Trophy className="w-4 h-4 text-gray-400" />}
                    {idx === 2 && <Trophy className="w-4 h-4 text-amber-600" />}
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Rank #{idx + 1}</span>
                  </div>
                  <p className="mt-1 text-base font-semibold text-foreground">{agent.agentName}</p>
                </div>
                <Badge variant={agent.leadsConverted > 0 ? 'default' : 'secondary'}>
                  {agent.leadsConverted} {completedLabel}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{assignedLabel}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{agent.leadsAssigned}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{rateLabel}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{agent.conversionRate.toFixed(0)}%</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rateLabel}</span>
                  <span>{agent.conversionRate.toFixed(0)}%</span>
                </div>
                <Progress value={agent.conversionRate} className="h-2" />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-center">{assignedLabel}</TableHead>
                <TableHead className="text-center">{completedLabel}</TableHead>
                <TableHead>{rateLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((agent, idx) => (
                <TableRow key={agent.agentId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                      {idx === 1 && <Trophy className="w-4 h-4 text-gray-400" />}
                      {idx === 2 && <Trophy className="w-4 h-4 text-amber-600" />}
                      <span className="font-medium">#{idx + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{agent.agentName}</TableCell>
                  <TableCell className="text-center">{agent.leadsAssigned}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={agent.leadsConverted > 0 ? 'default' : 'secondary'}>
                      {agent.leadsConverted}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={agent.conversionRate} className="w-20 h-2" />
                      <span className="text-sm font-medium">{agent.conversionRate.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
