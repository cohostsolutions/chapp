import { useState } from 'react';
import { Zap, Settings, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useMessageTemplates } from '@/hooks/useCommunications';
import { TemplateManagerDialog } from './TemplateManagerDialog';

// Substitute variables in template content
function substituteVariables(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
}

interface TemplateSelection {
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

interface QuickReplySelectorProps {
  organizationId?: string;
  channel: string;
  leadData?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  onSelect: (selection: TemplateSelection) => void;
  disabled?: boolean;
}

export function QuickReplySelector({
  organizationId,
  channel,
  leadData,
  onSelect,
  disabled,
}: QuickReplySelectorProps) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const {
    data: templates,
    isLoading: isTemplatesLoading,
    isError: isTemplatesError,
    error: templatesError,
    refetch: refetchTemplates,
  } = useMessageTemplates(organizationId || '', channel);

  const handleSelect = (template: { content: string; attachment_url?: string | null; attachment_name?: string | null }) => {
    const variables = {
      name: leadData?.name || 'there',
      email: leadData?.email || '',
      phone: leadData?.phone || '',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const substituted = substituteVariables(template.content, variables);
    onSelect({
      content: substituted,
      attachmentUrl: template.attachment_url,
      attachmentName: template.attachment_name,
    });
    setDropdownOpen(false);
    setSearchQuery('');
  };

  // Filter templates by channel (including 'all') and by search query
  const channelTemplates = templates?.filter(t => {
    const channelMatch = t.channel.toLowerCase() === channel.toLowerCase() || 
                         t.channel.toLowerCase() === 'all';
    if (!channelMatch) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(query) || 
             t.content.toLowerCase().includes(query);
    }
    return true;
  }) || [];

  const hasTemplates = channelTemplates.length > 0;

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={(open) => {
        setDropdownOpen(open);
        if (!open) setSearchQuery('');
      }}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 shrink-0"
            disabled={disabled}
            title="Quick replies"
          >
            <Zap className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-80 max-h-96 overflow-hidden bg-popover border border-border shadow-lg z-50"
          sideOffset={8}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="max-h-72 overflow-y-auto">
            {hasTemplates ? (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                  Your Templates ({channelTemplates.length})
                </DropdownMenuLabel>
                {channelTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="flex flex-col items-start py-2 px-3 cursor-pointer mx-1 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{template.name}</span>
                      {template.attachment_url && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                          + attachment
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {template.content}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            ) : searchQuery ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No templates match "{searchQuery}"
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No templates yet. Create one below!
              </div>
            )}
          </div>
          
          {organizationId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setManagerOpen(true);
                  setDropdownOpen(false);
                }}
                className="flex items-center gap-2 cursor-pointer mx-1 rounded-md"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm">Manage Templates</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {organizationId && (
        <TemplateManagerDialog
          open={managerOpen}
          onOpenChange={setManagerOpen}
          organizationId={organizationId}
        />
      )}
    </>
  );
}
