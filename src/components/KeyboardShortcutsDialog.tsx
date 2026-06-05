import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ isOpen, onOpenChange }: KeyboardShortcutsDialogProps) {
  const shortcuts = [
    { key: '← / →', description: 'Previous / Next day' },
    { key: '↑ / ↓', description: 'Previous / Next week' },
    { key: 'N', description: 'Create new event' },
    { key: 'T', description: 'Jump to today' },
    { key: 'E', description: 'Edit selected event' },
    { key: 'D', description: 'Delete selected event' },
    { key: 'M', description: 'Open calendar manager' },
    { key: 'S', description: 'Sync with Google Calendar' },
    { key: '?', description: 'Show this help dialog' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Use these keyboard shortcuts to navigate and manage your calendar efficiently.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                <kbd className="px-2 py-1 bg-gray-200 text-gray-900 text-sm font-semibold rounded border border-gray-300">
                  {shortcut.key}
                </kbd>
                <span className="text-sm text-gray-700">{shortcut.description}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 mt-4">
            <p className="text-xs text-gray-500">
              💡 Tip: Shortcuts only work when you're not typing in an input field.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
