import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';
import { use2FA } from '@/hooks/use2FA';

interface TwoFactorVerifyDialogProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

export function TwoFactorVerifyDialog({ open, onVerified, onCancel }: TwoFactorVerifyDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { verify2FA, isLoading } = use2FA();

  const handleVerify = async () => {
    setError('');
    const isValid = await verify2FA(code);
    if (isValid) {
      onVerified();
    } else {
      setError('Invalid code. Please try again or use a backup code.');
      setCode('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app or a backup code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Verification Code</Label>
            <Input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9A-Fa-f-]/g, '').slice(0, 9);
                setCode(val);
              }}
              onKeyDown={handleKeyDown}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter your authenticator code or backup code
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={code.length < 6 || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
