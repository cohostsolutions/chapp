import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, TrendingUp, Clock, Award, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
  organizationId: string;
}

export function TrainingProgressCard({ userId, organizationId }: Props) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['training-progress', userId, organizationId],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('training_sessions')
        .select('id, score, started_at, ended_at, module:training_modules(title)')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (!sessions || sessions.length === 0) {
        return {
          totalSessions: 0,
          avgScore: null,
          bestScore: null,
          recentTrend: null,
          totalMinutes: 0,
          streak: 0,
          lastSessionDate: null,
          recentSessions: [],
        };
      }

      const scores = sessions.map(s => s.score).filter((s): s is number => typeof s === 'number');
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const bestScore = scores.length ? Math.max(...scores) : null;

      // Calculate trend (last 5 vs previous 5)
      const recentScores = scores.slice(0, 5);
      const previousScores = scores.slice(5, 10);
      let recentTrend = null;
      if (recentScores.length >= 3 && previousScores.length >= 3) {
        const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        const previousAvg = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
        recentTrend = Math.round(recentAvg - previousAvg);
      }

      // Calculate total training time
      const totalMinutes = sessions.reduce((total, s) => {
        if (s.started_at && s.ended_at) {
          const duration = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
          return total + Math.round(duration / 60000);
        }
        return total;
      }, 0);

      // Calculate streak (consecutive days with training)
      const dates = sessions.map(s => new Date(s.started_at).toDateString());
      const uniqueDates = [...new Set(dates)];
      let streak = 0;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const current = new Date(uniqueDates[i - 1]);
          const prev = new Date(uniqueDates[i]);
          const diff = (current.getTime() - prev.getTime()) / 86400000;
          if (diff <= 1) {
            streak++;
          } else {
            break;
          }
        }
      }

      return {
        totalSessions: sessions.length,
        avgScore,
        bestScore,
        recentTrend,
        totalMinutes,
        streak,
        lastSessionDate: sessions[0]?.started_at,
        recentSessions: sessions.slice(0, 5).map(s => ({
          title: (s.module as unknown as { title?: string })?.title || 'Unknown Module',
          score: s.score,
          date: s.started_at,
        })),
      };
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Your Training Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Target className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Complete your first training session to start tracking your progress!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getBadges = () => {
    const badges = [];
    if (stats.totalSessions >= 10) badges.push({ label: 'Dedicated', icon: Star });
    if (stats.bestScore && stats.bestScore >= 90) badges.push({ label: 'High Achiever', icon: Award });
    if (stats.streak >= 3) badges.push({ label: `${stats.streak} Day Streak`, icon: TrendingUp });
    if (stats.totalMinutes >= 60) badges.push({ label: '1+ Hour Trained', icon: Clock });
    return badges;
  };

  const badges = getBadges();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Your Training Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={`text-2xl font-bold ${getScoreColor(stats.avgScore)}`}>
              {stats.avgScore ?? '-'}
            </div>
            <div className="text-xs text-muted-foreground">Avg Score</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={`text-2xl font-bold ${getScoreColor(stats.bestScore)}`}>
              {stats.bestScore ?? '-'}
            </div>
            <div className="text-xs text-muted-foreground">Best Score</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{stats.totalMinutes}m</div>
            <div className="text-xs text-muted-foreground">Total Time</div>
          </div>
        </div>

        {/* Trend Indicator */}
        {stats.recentTrend !== null && (
          <div className={`flex items-center gap-2 text-sm ${stats.recentTrend >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            <TrendingUp className={`w-4 h-4 ${stats.recentTrend < 0 ? 'rotate-180' : ''}`} />
            <span>
              {stats.recentTrend >= 0 ? '+' : ''}{stats.recentTrend} points compared to earlier sessions
            </span>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                <badge.icon className="w-3 h-3" />
                {badge.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Recent Sessions */}
        {stats.recentSessions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Sessions</div>
            <div className="space-y-1.5">
              {stats.recentSessions.slice(0, 3).map((session, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/30">
                  <span className="truncate">{session.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={getScoreColor(session.score)}>
                      {session.score ?? '-'}/100
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TrainingProgressCard;
