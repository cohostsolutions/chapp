import { useTheme } from '@/hooks/themeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          aria-label={`Current theme: ${theme}. Click to change theme`}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" role="menu" aria-label="Theme options">
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          role="menuitemradio"
          aria-checked={theme === 'light'}
        >
          <Sun className="h-4 w-4 mr-2" aria-hidden="true" />
          Light
          {theme === 'light' && <span className="ml-auto" aria-hidden="true">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          role="menuitemradio"
          aria-checked={theme === 'dark'}
        >
          <Moon className="h-4 w-4 mr-2" aria-hidden="true" />
          Dark
          {theme === 'dark' && <span className="ml-auto" aria-hidden="true">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          role="menuitemradio"
          aria-checked={theme === 'system'}
        >
          <Monitor className="h-4 w-4 mr-2" aria-hidden="true" />
          System
          {theme === 'system' && <span className="ml-auto" aria-hidden="true">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
