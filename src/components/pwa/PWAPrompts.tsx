import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Share, Plus, RefreshCw, Zap, Lock, Wifi, Bell } from 'lucide-react';
import { usePWAInstall, usePWAUpdate, useOfflineStatus } from '@/hooks/usePWA';

/**
 * PWA Install Banner - shows when app is installable
 */
export function PWAInstallBanner() {
  const { isInstallable, isIOS, isInstalled, promptInstall, dismissInstall, shouldShowPrompt } = usePWAInstall();
  const [showFeatures, setShowFeatures] = useState(false);

  if (!shouldShowPrompt()) return null;

  const features = [
    { icon: Zap, text: 'Lightning fast access', color: 'text-yellow-500' },
    { icon: Wifi, text: 'Works offline', color: 'text-blue-500' },
    { icon: Bell, text: 'Push notifications', color: 'text-green-500' },
    { icon: Lock, text: 'Secure & private', color: 'text-purple-500' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md"
      >
        <Card className="border-primary/20 bg-background/95 backdrop-blur-lg shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Install AlCor Nexus</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {isIOS 
                    ? 'Add to your home screen for the best experience'
                    : 'Install our app for quick access and offline support'
                  }
                </p>
                
                {showFeatures && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="grid grid-cols-2 gap-2 mt-3"
                  >
                    {features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <feature.icon className={`w-4 h-4 ${feature.color}`} />
                        <span className="text-muted-foreground">{feature.text}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
                
                {isIOS ? (
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                    <Share className="w-4 h-4" />
                    <span>Tap Share</span>
                    <span>→</span>
                    <Plus className="w-4 h-4" />
                    <span>Add to Home Screen</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={promptInstall} className="gap-2">
                      <Download className="w-4 h-4" />
                      Install Now
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowFeatures(!showFeatures)}
                    >
                      {showFeatures ? 'Hide' : 'Why?'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dismissInstall}>
                      Later
                    </Button>
                  </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0 h-8 w-8" 
                onClick={dismissInstall}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * PWA Update Banner - shows when an update is available
 */
export function PWAUpdateBanner() {
  const { updateAvailable, applyUpdate, dismissUpdate } = usePWAUpdate();

  if (!updateAvailable) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
      >
        <Card className="border-blue-500/20 bg-blue-500/10 backdrop-blur-lg shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Update Available</h3>
                <p className="text-sm text-muted-foreground">
                  A new version is ready to install
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={applyUpdate}>
                  Update
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Offline Status Indicator
 */
export function OfflineIndicator() {
  const { isOnline, pendingSyncs, forceSync, lastSyncTime } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  if (isOnline && pendingSyncs === 0) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await forceSync();
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed bottom-20 right-4 z-50"
      >
        <Card className={`shadow-lg transition-colors ${isOnline ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-yellow-500' : 'bg-red-500'} ${!isOnline || pendingSyncs > 0 ? 'animate-pulse' : ''}`} />
            <div className="flex-1">
              <span className="text-sm font-medium block">
                {!isOnline ? 'Offline Mode' : `${pendingSyncs} pending sync${pendingSyncs !== 1 ? 's' : ''}`}
              </span>
              {!isOnline && (
                <span className="text-xs text-muted-foreground">
                  Changes will sync automatically
                </span>
              )}
              {isOnline && lastSyncTime && pendingSyncs === 0 && (
                <span className="text-xs text-muted-foreground">
                  Last synced: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
            </div>
            {isOnline && pendingSyncs > 0 && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 px-2" 
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
