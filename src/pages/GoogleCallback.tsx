import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

const GOOGLE_OAUTH_STATE_KEY = 'google_oauth_state';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { exchangeCode, reportIssue } = useGoogleCalendar();

  useEffect(() => {
    (async () => {
      const code = searchParams.get('code');
      const callbackError = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const receivedState = searchParams.get('state');
      const storedState = localStorage.getItem(GOOGLE_OAUTH_STATE_KEY);

      const finish = () => {
        navigate('/settings?tab=integrations', { replace: true });
      };

      if (callbackError) {
        const message = errorDescription || callbackError;
        await reportIssue({
          issueType: 'callback_error',
          stage: 'google_callback',
          message,
          severity: 'error',
          context: {
            callbackError,
            pathname: window.location.pathname,
          },
        });

        toast({
          title: 'Google connect failed',
          description: message,
          variant: 'destructive',
        });
        finish();
        return;
      }

      if (!receivedState || receivedState !== storedState) {
        localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
        await reportIssue({
          issueType: 'state_validation_failed',
          stage: 'google_callback',
          message: 'The Google callback returned with an invalid OAuth state.',
          severity: 'warning',
          context: {
            hasReceivedState: Boolean(receivedState),
            hasStoredState: Boolean(storedState),
          },
        });

        toast({
          title: 'Security Error',
          description: 'Invalid Google OAuth state parameter',
          variant: 'destructive',
        });
        finish();
        return;
      }

      localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);

      if (!code) {
        await reportIssue({
          issueType: 'missing_callback_code',
          stage: 'google_callback',
          message: 'Google redirected back without an authorization code.',
          severity: 'warning',
        });

        toast({
          title: 'Google connect failed',
          description: 'Missing code in callback',
          variant: 'destructive',
        });
        finish();
        return;
      }

      const success = await exchangeCode(code, '/google-callback');
      if (success) {
        toast({
          title: 'Google Connected',
          description: 'Your Google account has been connected successfully.',
        });
      } else {
        toast({
          title: 'Google connect failed',
          description: 'Google authorization returned, but the token exchange did not complete.',
          variant: 'destructive',
        });
      }

      finish();
    })();
  }, [exchangeCode, navigate, reportIssue, searchParams, toast]);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Connecting to Google...</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Please wait while we finalize the Google connection and verify your account access.
      </p>
    </div>
  );
}