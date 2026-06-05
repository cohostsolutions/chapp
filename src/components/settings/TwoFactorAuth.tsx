import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, ShieldCheck, ShieldOff, Copy, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { use2FA } from '@/hooks/use2FA';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function TwoFactorAuth() {
  const { isSuperAdmin, isClientAdmin } = useAuth();
  const { toast } = useToast();
  const {
    isLoading,
    get2FAStatus,
    setup2FA,
    verifySetup,
    disable2FA,
    regenerateBackupCodes
  } = use2FA();

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpAuthUrl: string; qrCodeDataUrl?: string; backupCodes: string[] } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'backup'>('qr');
  const [regenerateCode, setRegenerateCode] = useState('');

  const canUse2FA = isSuperAdmin || isClientAdmin;

  const fetchStatus = useCallback(async () => {
    if (!canUse2FA) return;
    const status = await get2FAStatus();
    if (status) {
      setIs2FAEnabled(status.enabled);
    }
  }, [canUse2FA, get2FAStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStartSetup = async () => {
    const data = await setup2FA();
    if (data) {
      setSetupData(data);
      setSetupStep('qr');
      setShowSetupDialog(true);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationCode) return;
    const success = await verifySetup(verificationCode);
    if (success) {
      setSetupStep('backup');
      setBackupCodes(setupData?.backupCodes || []);
    }
  };

  const handleCompleteSetup = () => {
    setShowSetupDialog(false);
    setSetupData(null);
    setVerificationCode('');
    setSetupStep('qr');
    setIs2FAEnabled(true);
  };

  const handleDisable = async () => {
    if (!disableCode) return;
    const success = await disable2FA(disableCode);
    if (success) {
      setShowDisableDialog(false);
      setDisableCode('');
      setIs2FAEnabled(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!regenerateCode) return;
    const codes = await regenerateBackupCodes(regenerateCode);
    if (codes) {
      setBackupCodes(codes);
      setRegenerateCode('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  if (!canUse2FA) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            2FA is only available for admin accounts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {is2FAEnabled ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
            Two-Factor Authentication
            {is2FAEnabled && (
              <Badge variant="default" className="ml-2 bg-green-500">Enabled</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {is2FAEnabled ? (
            <>
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Two-factor authentication is enabled. You'll need to enter a code from your authenticator app when signing in.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowBackupCodesDialog(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Backup Codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Disable 2FA
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Two-factor authentication adds an extra layer of security by requiring a code from your phone in addition to your password.
                </AlertDescription>
              </Alert>
              <Button onClick={handleStartSetup} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <ShieldCheck className="h-4 w-4 mr-2" />
                Enable 2FA
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={(open) => !open && setShowSetupDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {setupStep === 'qr' && 'Scan the QR code with your authenticator app.'}
              {setupStep === 'verify' && 'Enter the code from your authenticator app.'}
              {setupStep === 'backup' && 'Save your backup codes in a safe place.'}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'qr' && setupData && (
            <div className="space-y-4">
              {setupData.qrCodeDataUrl ? (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={setupData.qrCodeDataUrl}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              ) : (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    QR preview is temporarily unavailable, but you can still finish setup by entering the secret manually in your authenticator app.
                  </AlertDescription>
                </Alert>
              )}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Or enter this code manually:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {setupData.secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(setupData.secret)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancel</Button>
                <Button onClick={() => setSetupStep('verify')}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupStep('qr')}>Back</Button>
                <Button onClick={handleVerifySetup} disabled={verificationCode.length !== 6 || isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verify
                </Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 'backup' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  2FA has been enabled! Save these backup codes somewhere safe. Each code can only be used once.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <code key={index} className="bg-muted px-3 py-2 rounded text-sm font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(backupCodes.join('\n'))}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy All Codes
              </Button>
              <DialogFooter>
                <Button onClick={handleCompleteSetup}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your current authenticator code to disable 2FA. This will make your account less secure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Authenticator Code</Label>
            <Input
              type="text"
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Backup Codes</DialogTitle>
            <DialogDescription>
              {backupCodes.length > 0
                ? 'Save your new backup codes. Your old codes are now invalid.'
                : 'Enter your authenticator code to generate new backup codes.'}
            </DialogDescription>
          </DialogHeader>
          {backupCodes.length === 0 ? (
            <>
              <div className="space-y-2">
                <Label>Authenticator Code</Label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={regenerateCode}
                  onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBackupCodesDialog(false)}>Cancel</Button>
                <Button
                  onClick={handleRegenerateBackupCodes}
                  disabled={regenerateCode.length !== 6 || isLoading}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Regenerate
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <code key={index} className="bg-muted px-3 py-2 rounded text-sm font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(backupCodes.join('\n'))}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy All Codes
              </Button>
              <DialogFooter>
                <Button onClick={() => {
                  setShowBackupCodesDialog(false);
                  setBackupCodes([]);
                }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
