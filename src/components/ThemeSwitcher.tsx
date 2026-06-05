import React from 'react';
import { useTheme } from '@/hooks/themeContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Monitor, Sun, Moon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') return <Monitor className="w-4 h-4" />;
    if (theme === 'dark') return <Moon className="w-4 h-4" />;
    return <Sun className="w-4 h-4" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    if (theme === 'dark') return 'Dark';
    return 'Light';
  };

  return (
    <div className="space-y-2">
      <Label>Theme</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
            {getIcon()}
            <span>{getLabel()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 bg-popover">
          <DropdownMenuItem 
            onClick={() => setTheme('system')}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              System
            </div>
            {theme === 'system' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme('light')}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4" />
              Light
            </div>
            {theme === 'light' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme('dark')}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4" />
              Dark
            </div>
            {theme === 'dark' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Compact version for use in headers/nav
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const getIcon = () => {
    if (theme === 'system') return <Monitor className="w-4 h-4" />;
    if (theme === 'dark') return <Moon className="w-4 h-4" />;
    return <Sun className="w-4 h-4" />;
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className={cn("h-9 w-9", className)}
      title={`Current: ${theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}`}
    >
      {getIcon()}
    </Button>
  );
};
