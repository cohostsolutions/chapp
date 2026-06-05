import React, { useState } from 'react';
import { HelpCircle, PlayCircle, Mail, BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOnboardingTour } from '@/components/onboarding/OnboardingTour';
import { CreateHelpdeskTicketDialog } from '@/components/team-chat/CreateHelpdeskTicketDialog';
import { useAuth } from '@/contexts/AuthContext';

export function HelpButton() {
  const { startTour } = useOnboardingTour();
  const { isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  const handleStartTour = () => {
    setOpen(false);
    startTour();
  };

  const handleContactSupport = () => {
    setOpen(false);
    setTicketDialogOpen(true);
  };

  const handleOpenDocs = () => {
    setOpen(false);
    window.open('https://docs.alcornexus.com', '_blank');
  };

  // Don't show the help button to super admins - they manage support tickets
  if (isSuperAdmin) {
    return null;
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full hover:bg-primary/10"
            aria-label="Help & Support"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Help & Support
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleStartTour} className="cursor-pointer gap-2">
            <PlayCircle className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Product Tour</p>
              <p className="text-xs text-muted-foreground">Learn the basics</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOpenDocs} className="cursor-pointer gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <div className="flex-1">
              <p className="font-medium">Documentation</p>
              <p className="text-xs text-muted-foreground">Browse guides & tutorials</p>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleContactSupport} className="cursor-pointer gap-2">
            <Mail className="h-4 w-4 text-green-500" />
            <div>
              <p className="font-medium">Contact Support</p>
              <p className="text-xs text-muted-foreground">Get help from our team</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateHelpdeskTicketDialog 
        open={ticketDialogOpen} 
        onOpenChange={setTicketDialogOpen} 
      />
    </>
  );
}
