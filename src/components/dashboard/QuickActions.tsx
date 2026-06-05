import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  UserPlus, 
  MessageSquarePlus,
  ClipboardList,
  Phone,
  FileText,
  Calendar,
  BedDouble,
  ShoppingCart,
  Ticket,
  GraduationCap,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  path: string;
  color: string;
  bgColor: string;
}

interface QuickActionsProps {
  agentType: 'jay' | 'may' | 'cece' | 'admin';
  isClientAdmin?: boolean;
  className?: string;
}

const actionsByAgent: Record<string, QuickAction[]> = {
  jay: [
    { label: 'New Lead', icon: UserPlus, path: '/sales-operations?tab=leads&action=new', color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Send Message', icon: MessageSquarePlus, path: '/chats', color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'View Reports', icon: FileText, path: '/reporting', color: 'text-success', bgColor: 'bg-success/10' },
    { label: 'Team Chat', icon: MessageSquarePlus, path: '/team-chat', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ],
  may: [
    { label: 'New Order', icon: ShoppingCart, path: '/menu-and-orders?tab=orders&action=new', color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'View Menu', icon: ClipboardList, path: '/menu-and-orders?tab=menu', color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Calendar', icon: Calendar, path: '/menu-and-orders?tab=calendar', color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Reports', icon: FileText, path: '/reporting', color: 'text-success', bgColor: 'bg-success/10' },
  ],
  cece: [
    { label: 'New Booking', icon: BedDouble, path: '/accommodation?tab=bookings&action=new', color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Room Status', icon: BedDouble, path: '/accommodation?tab=rooms', color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Calendar', icon: Calendar, path: '/calendar', color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'Guest Inquiries', icon: UserPlus, path: '/sales-operations?tab=leads', color: 'text-success', bgColor: 'bg-success/10' },
  ],
  admin: [
    { label: 'Users', icon: UserPlus, path: '/users', color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Organizations', icon: ClipboardList, path: '/organizations', color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Security', icon: FileText, path: '/security', color: 'text-destructive', bgColor: 'bg-destructive/10' },
    { label: 'Tickets', icon: Ticket, path: '/support-tickets', color: 'text-warning', bgColor: 'bg-warning/10' },
  ],
};

const clientAdminActions: QuickAction[] = [
  { label: 'AI Training', icon: GraduationCap, path: '/ai-training', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { label: 'Support', icon: Ticket, path: '/support-tickets', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
];

export function QuickActions({ agentType, isClientAdmin = false, className }: QuickActionsProps) {
  const navigate = useNavigate();
  
  let actions = actionsByAgent[agentType] || actionsByAgent.jay;
  
  // Add client admin specific actions
  if (isClientAdmin && agentType !== 'admin') {
    actions = [...actions.slice(0, 2), ...clientAdminActions.slice(0, 2)];
  }

  // Hidden on mobile/tablet where MobileBottomNav provides quick actions via FAB
  return (
    <Card className={cn("glass hidden xl:block", className)}>
      <CardContent className="p-2 md:p-3">
        <ScrollArea className="w-full">
          <div className="flex gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                size="sm"
                onClick={() => navigate(action.path)}
                className={cn(
                  "flex-shrink-0 h-auto py-2 px-3 flex-col gap-1.5 hover:bg-muted/80",
                  "min-w-[70px] md:min-w-[80px]"
                )}
              >
                <div className={cn("p-2 rounded-lg", action.bgColor)}>
                  <action.icon className={cn("w-4 h-4", action.color)} />
                </div>
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground">
                  {action.label}
                </span>
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
