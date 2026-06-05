import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  organizationId: string;
  currentUserId: string;
  moduleId?: string; // Optional filter by specific module
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  totalSessions: number;
  avgScore: number | null;
  bestScore: number | null;
  rank: number;
}

export function TeamLeaderboard({ organizationId, currentUserId, moduleId }: Props) {
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'all'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Calculate date range based on time period
  const getDateFilter = () => {
    const now = new Date();
    if (timePeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return weekAgo.toISOString();
    } else if (timePeriod === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return monthAgo.toISOString();
    }
    return null;
  };

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['training-leaderboard', organizationId, timePeriod, moduleId],
    queryFn: async () => {
      // Build query with filters
      let query = supabase
        .from('training_sessions')
        .select('user_id, score, module_id, created_at')
        .eq('organization_id', organizationId);

      // Apply time period filter
      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      // Apply module filter
      if (moduleId) {
        query = query.eq('module_id', moduleId);
      }

      const { data: sessions } = await query;

      if (!sessions || sessions.length === 0) return { entries: [], total: 0 };

      // Get user profiles
      const userIds = [...new Set(sessions.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Aggregate by user
      const userStats: Record<string, { scores: number[]; count: number }> = {};
      sessions.forEach(s => {
        if (!userStats[s.user_id]) {
          userStats[s.user_id] = { scores: [], count: 0 };
        }
        userStats[s.user_id].count++;
        if (typeof s.score === 'number') {
          userStats[s.user_id].scores.push(s.score);
        }
      });

      // Build leaderboard
      const entries: LeaderboardEntry[] = Object.entries(userStats).map(([userId, stats]) => {
        const profile = profileMap.get(userId);
        const avgScore = stats.scores.length
          ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
          : null;
        const bestScore = stats.scores.length ? Math.max(...stats.scores) : null;

        return {
          userId,
          name: profile?.full_name || profile?.email?.split('@')[0] || 'Unknown',
          totalSessions: stats.count,
          avgScore,
          bestScore,
          rank: 0,
        };
      });

      // Sort by avg score (null scores at bottom)
      entries.sort((a, b) => {
        if (a.avgScore === null && b.avgScore === null) return b.totalSessions - a.totalSessions;
        if (a.avgScore === null) return 1;
        if (b.avgScore === null) return -1;
        if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
        return b.totalSessions - a.totalSessions;
      });

      // Assign ranks
      entries.forEach((e, i) => {
        e.rank = i + 1;
      });

      return { entries, total: entries.length };
    },
    staleTime: 60000,
  });

  const leaderboard = leaderboardData?.entries || [];
  const totalEntries = leaderboardData?.total || 0;
  const totalPages = Math.ceil(totalEntries / PAGE_SIZE);
  const paginatedLeaderboard = leaderboard.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-gray-400" />;
    if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
    return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-muted-foreground">{rank}</span>;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-sm text-muted-foreground">
            No team training data yet. Be the first to complete a session!
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentUserEntry = leaderboard.find(e => e.userId === currentUserId);
  const currentUserRank = currentUserEntry?.rank;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Leaderboard
          </CardTitle>
          <Select value={timePeriod} onValueChange={(v: 'week' | 'month' | 'all') => {
            setTimePeriod(v);
            setPage(1); // Reset to page 1 when filter changes
          }}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {currentUserEntry && (
          <p className="text-sm text-muted-foreground">
            Your rank: <span className="font-semibold text-foreground">#{currentUserEntry.rank}</span> of {totalEntries}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {paginatedLeaderboard.map((entry) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              entry.userId === currentUserId
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="w-6 flex justify-center">
              {getRankIcon(entry.rank)}
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-muted">
                {getInitials(entry.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {entry.name}
                {entry.userId === currentUserId && (
                  <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.totalSessions} sessions
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold text-sm ${
                entry.avgScore && entry.avgScore >= 80
                  ? 'text-green-600 dark:text-green-400'
                  : entry.avgScore && entry.avgScore >= 60
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-muted-foreground'
              }`}>
                {entry.avgScore ?? '-'}
              </div>
              <div className="text-xs text-muted-foreground">avg</div>
            </div>
          </div>
        ))}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TeamLeaderboard;
