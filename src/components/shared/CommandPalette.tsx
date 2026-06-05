import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Users,
  MessageSquare,
  Phone,
  Calendar,
  Settings,
  LayoutDashboard,
  ShoppingBag,
  BookOpen,
  BarChart,
  Shield,
  Building,
  Facebook,
  Search,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Command palette shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
      action: () => navigate('/dashboard'),
      keywords: ['home', 'overview'],
    },
    {
      id: 'nav-leads',
      label: 'Go to Leads',
      icon: <Users className="mr-2 h-4 w-4" />,
      action: () => navigate('/sales-operations?tab=leads'),
      keywords: ['contacts', 'customers'],
    },
    {
      id: 'nav-orders',
      label: 'Go to Menu & Orders',
      icon: <ShoppingBag className="mr-2 h-4 w-4" />,
      action: () => navigate('/menu-and-orders'),
      keywords: ['sales', 'purchases', 'menu', 'food', 'restaurant'],
    },
    {
      id: 'nav-chats',
      label: 'Go to Chat Logs',
      icon: <MessageSquare className="mr-2 h-4 w-4" />,
      action: () => navigate('/chats'),
      keywords: ['conversations', 'messages'],
    },
    {
      id: 'nav-calls',
      label: 'Go to Call Center',
      icon: <Phone className="mr-2 h-4 w-4" />,
      action: () => navigate('/calls'),
      keywords: ['phone', 'dialer'],
    },
    {
      id: 'nav-calendar',
      label: 'Go to Calendar',
      icon: <Calendar className="mr-2 h-4 w-4" />,
      action: () => navigate('/calendar'),
      keywords: ['schedule', 'bookings'],
    },
    {
      id: 'nav-ai-conversations',
      label: 'Go to AI Conversations',
      icon: <MessageSquare className="mr-2 h-4 w-4" />,
      action: () => navigate('/chats'),
      keywords: ['ai', 'chat', 'bot'],
    },
    {
      id: 'nav-knowledge-base',
      label: 'Go to Knowledge Base',
      icon: <BookOpen className="mr-2 h-4 w-4" />,
      action: () => navigate('/knowledge-base'),
      keywords: ['docs', 'help', 'faq'],
    },
    {
      id: 'nav-social',
      label: 'Go to Social Platforms',
      icon: <Facebook className="mr-2 h-4 w-4" />,
      action: () => navigate('/social-platforms'),
      keywords: ['facebook', 'instagram', 'whatsapp'],
    },
    {
      id: 'nav-organizations',
      label: 'Go to Organizations',
      icon: <Building className="mr-2 h-4 w-4" />,
      action: () => navigate('/organizations'),
      keywords: ['companies', 'tenants'],
    },
    {
      id: 'nav-users',
      label: 'Go to Users',
      icon: <Users className="mr-2 h-4 w-4" />,
      action: () => navigate('/users'),
      keywords: ['team', 'staff', 'agents'],
    },
    {
      id: 'nav-security',
      label: 'Go to Security Dashboard',
      icon: <Shield className="mr-2 h-4 w-4" />,
      action: () => navigate('/security'),
      keywords: ['audit', 'logs', 'sessions'],
    },
    {
      id: 'nav-reporting',
      label: 'Go to Reporting',
      icon: <BarChart className="mr-2 h-4 w-4" />,
      action: () => navigate('/reporting'),
      keywords: ['analytics', 'metrics', 'stats'],
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: <Settings className="mr-2 h-4 w-4" />,
      action: () => navigate('/settings'),
      keywords: ['preferences', 'config'],
    },
  ];

  const handleSelect = useCallback((item: CommandItem) => {
    setOpen(false);
    item.action();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {commands.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => handleSelect(item)}
              keywords={item.keywords}
            >
              {item.icon}
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem>
            <Search className="mr-2 h-4 w-4" />
            <span>Press ⌘K (or Ctrl+K) to open this palette</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
