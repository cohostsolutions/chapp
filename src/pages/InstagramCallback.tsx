import { useEffect } from 'react';
import { devError } from '@/lib/logger';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

export default function InstagramCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const code = searchParams.get('code');
      const receivedState = searchParams.get('state');
      const storedState = localStorage.getItem('ig_oauth_state');
      const redirectUri = `${window.location.origin}/instagram-callback`;

      // Validate state parameter to prevent CSRF attacks
      if (!receivedState || receivedState !== storedState) {
        toast({ title: 'Security Error', description: 'Invalid OAuth state parameter', variant: 'destructive' });
        localStorage.removeItem('ig_oauth_state');
        navigate('/settings?tab=social-platforms');
        return;
      }

      // Clear state after successful validation
      localStorage.removeItem('ig_oauth_state');

      if (!code) {
        toast({ title: 'Instagram connect failed', description: 'Missing code in callback', variant: 'destructive' });
        navigate('/settings?tab=social-platforms');
        return;
      }

      try {
        const functionHeaders = await getSupabaseFunctionAuthHeaders();

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...functionHeaders,
          },
          body: JSON.stringify({ 
            action: 'exchange', 
            code, 
            redirectUri, 
            state: receivedState,
            platform: 'instagram' 
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          devError('instagram exchange error', json);
          toast({ title: 'Instagram connect failed', description: json?.error || 'Unknown error', variant: 'destructive' });
        } else {
          const accountCount = json?.instagram_accounts_count || 0;
          toast({ 
            title: 'Instagram connected', 
            description: `${accountCount} Instagram account${accountCount !== 1 ? 's' : ''} have been imported` 
          });
        }
      } catch (err) {
        devError('InstagramCallback error:', err);
        toast({ title: 'Instagram connect failed', description: 'Network error', variant: 'destructive' });
      } finally {
        navigate('/settings?tab=social-platforms');
      }
    })();
  }, [searchParams, navigate, toast]);  

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Connecting to Instagram...</h2>
      <p className="text-sm text-muted-foreground mt-2">Please wait while we finalize the connection and import accounts.</p>
    </div>
  );
}
