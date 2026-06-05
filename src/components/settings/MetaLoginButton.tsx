import { Loader2 } from 'lucide-react';
import { devLog } from '@/lib/logger';
import { Button } from '@/components/ui/button';

interface MetaLoginButtonProps {
  configId?: string;
  disabled?: boolean;
  loading?: boolean;
  buttonLabel?: string;
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  onAuthenticated: (userAccessToken: string) => Promise<void> | void;
  onFallback: () => void;
}

export function MetaLoginButton({
  configId,
  disabled = false,
  loading = false,
  buttonLabel = 'Connect Facebook',
  buttonSize = 'default',
  onFallback,
}: MetaLoginButtonProps) {
  const handleClick = () => {
    devLog('[Meta Login Button] Click', {
      hasConfigId: Boolean(configId),
      loading,
      disabled,
    });
    onFallback();
  };

  return (
    <div className="space-y-2">
      <Button type="button" size={buttonSize} onClick={handleClick} disabled={disabled || loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {buttonLabel}
      </Button>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Finalizing Meta connection...
        </div>
      ) : null}
    </div>
  );
}