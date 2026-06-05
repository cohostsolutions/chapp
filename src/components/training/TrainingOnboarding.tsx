import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Phone, 
  Target, 
  Lightbulb, 
  Award,
  ChevronRight,
  BookOpen,
  Sparkles,
  BarChart3,
  Users
} from 'lucide-react';

interface Props {
  onSelectModule: () => void;
  hasModules: boolean;
  canManageModules: boolean;
  onCreateModule?: () => void;
}

export function TrainingOnboarding({ onSelectModule, hasModules, canManageModules, onCreateModule }: Props) {
  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Header with animated gradient */}
          <div className="text-center relative">
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20 blur-3xl opacity-50" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
              <BookOpen className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Welcome to AI Training
            </h3>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Master sales and customer service through AI-powered roleplay. 
              Get real-time coaching and detailed performance insights.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Sparkles className="w-3 h-3" />
              AI-Powered
            </Badge>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <BarChart3 className="w-3 h-3" />
              Performance Tracking
            </Badge>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Users className="w-3 h-3" />
              Team Leaderboard
            </Badge>
          </div>

          {/* Training Modes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="group p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Chat Mode</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Practice text-based conversations with typing simulation
                  </div>
                </div>
              </div>
            </div>
            <div className="group p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 hover:border-green-500/40 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Voice Mode</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Simulate real phone calls with speech recognition
                  </div>
                </div>
              </div>
            </div>
            <div className="group p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Lightbulb className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Live Coaching</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Get real-time tips based on your rubric goals
                  </div>
                </div>
              </div>
            </div>
            <div className="group p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Award className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="font-semibold text-sm">AI Evaluation</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Detailed scoring and personalized feedback
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works - Streamlined */}
          <div className="rounded-xl p-4 bg-muted/30 border">
            <div className="font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Quick Start Guide
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { step: '1', label: 'Select Module' },
                { step: '2', label: 'Choose Mode' },
                { step: '3', label: 'Practice' },
                { step: '4', label: 'Get Score' },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center space-y-3 pt-2">
            {hasModules ? (
              <Button onClick={onSelectModule} size="lg" className="gap-2 shadow-lg shadow-primary/25">
                Select a Module to Start
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : canManageModules ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No training modules yet. Create your first module to start training your team.
                </p>
                <Button onClick={onCreateModule} size="lg" className="gap-2 shadow-lg shadow-primary/25">
                  Create First Module
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No training modules available. Contact your admin to create training modules.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TrainingOnboarding;
