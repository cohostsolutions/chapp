import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to register global keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Global shortcuts (without modifier keys)
      switch (e.key.toLowerCase()) {
        case 'g': {
          // Wait for second key
          const secondKeyHandler = (e2: KeyboardEvent) => {
            switch (e2.key.toLowerCase()) {
              case 'd':
                e2.preventDefault();
                navigate('/dashboard');
                break;
              case 'l':
                e2.preventDefault();
                navigate('/sales-operations?tab=leads');
                break;
              case 'o':
                e2.preventDefault();
                navigate('/menu-and-orders');
                break;
              case 'c':
                e2.preventDefault();
                navigate('/chats');
                break;
              case 'p':
                e2.preventDefault();
                navigate('/calls');
                break;
            }
            document.removeEventListener('keydown', secondKeyHandler);
          };
          document.addEventListener('keydown', secondKeyHandler);
          // Remove listener after 2 seconds if no second key pressed
          setTimeout(() => {
            document.removeEventListener('keydown', secondKeyHandler);
          }, 2000);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
