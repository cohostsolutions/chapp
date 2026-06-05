import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Chrome, 
  Apple, 
  Monitor,
  Download,
  Share,
  Plus,
  MoreVertical,
  CheckCircle2,
  Zap,
  Wifi,
  Bell,
  Lock
} from 'lucide-react';

/**
 * PWA Installation Guide Component
 * Provides step-by-step instructions for installing the app on different platforms
 */
export function PWAInstallGuide() {
  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Instant loading with offline caching',
      color: 'text-yellow-500 bg-yellow-500/10'
    },
    {
      icon: Wifi,
      title: 'Works Offline',
      description: 'Access your data without internet',
      color: 'text-blue-500 bg-blue-500/10'
    },
    {
      icon: Bell,
      title: 'Push Notifications',
      description: 'Stay updated with real-time alerts',
      color: 'text-green-500 bg-green-500/10'
    },
    {
      icon: Lock,
      title: 'Secure & Private',
      description: 'Your data stays protected',
      color: 'text-purple-500 bg-purple-500/10'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Benefits Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Install AlCor Nexus App
          </CardTitle>
          <CardDescription>
            Get the best experience with our Progressive Web App (PWA)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${feature.color} flex items-center justify-center shrink-0`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Installation Instructions */}
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Installation Instructions</CardTitle>
            <CardDescription>
              Choose your platform below for step-by-step instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="android" className="w-full">
            <TabsList className="grid grid-cols-3 lg:grid-cols-5 w-full">
              <TabsTrigger value="android" className="gap-2">
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Android</span>
              </TabsTrigger>
              <TabsTrigger value="ios" className="gap-2">
                <Apple className="w-4 h-4" />
                <span className="hidden sm:inline">iOS</span>
              </TabsTrigger>
              <TabsTrigger value="chrome" className="gap-2">
                <Chrome className="w-4 h-4" />
                <span className="hidden sm:inline">Chrome</span>
              </TabsTrigger>
              <TabsTrigger value="edge" className="gap-2">
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Edge</span>
              </TabsTrigger>
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Desktop</span>
              </TabsTrigger>
            </TabsList>

            {/* Android Instructions */}
            <TabsContent value="android" className="space-y-4 mt-4">
              <Alert>
                <Smartphone className="w-4 h-4" />
                <AlertDescription>
                  <strong>Android Chrome/Edge</strong> - The easiest way to install
                </AlertDescription>
              </Alert>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">1</span>
                  <span className="flex-1">
                    Look for the <strong>"Add to Home Screen"</strong> banner at the bottom of your screen, or tap the menu icon (⋮) in the top right
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">2</span>
                  <span className="flex-1">
                    Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">3</span>
                  <span className="flex-1">
                    Confirm the installation and the app will be added to your home screen
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  <span className="flex-1 text-muted-foreground">
                    You can now launch AlCor Nexus from your home screen like any native app!
                  </span>
                </li>
              </ol>
            </TabsContent>

            {/* iOS Instructions */}
            <TabsContent value="ios" className="space-y-4 mt-4">
              <Alert>
                <Apple className="w-4 h-4" />
                <AlertDescription>
                  <strong>iPhone/iPad Safari</strong> - Use the Share menu
                </AlertDescription>
              </Alert>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">1</span>
                  <span className="flex-1">
                    Tap the <strong>Share button</strong> <Share className="w-4 h-4 inline mx-1" /> at the bottom of Safari
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">2</span>
                  <span className="flex-1">
                    Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="w-4 h-4 inline mx-1" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">3</span>
                  <span className="flex-1">
                    Name the app (or keep the default) and tap <strong>"Add"</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  <span className="flex-1 text-muted-foreground">
                    The app icon will appear on your home screen!
                  </span>
                </li>
              </ol>
              <Badge variant="outline" className="mt-4">
                Note: iOS requires Safari browser for PWA installation
              </Badge>
            </TabsContent>

            {/* Chrome Desktop Instructions */}
            <TabsContent value="chrome" className="space-y-4 mt-4">
              <Alert>
                <Chrome className="w-4 h-4" />
                <AlertDescription>
                  <strong>Chrome Desktop</strong> - Install from the address bar
                </AlertDescription>
              </Alert>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">1</span>
                  <span className="flex-1">
                    Look for the <strong>install icon</strong> <Download className="w-4 h-4 inline mx-1" /> in the address bar (right side)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">2</span>
                  <span className="flex-1">
                    Click the icon and select <strong>"Install"</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">3</span>
                  <span className="flex-1">
                    The app will open in its own window and appear in your Start menu/Applications
                  </span>
                </li>
              </ol>
            </TabsContent>

            {/* Edge Desktop Instructions */}
            <TabsContent value="edge" className="space-y-4 mt-4">
              <Alert>
                <Monitor className="w-4 h-4" />
                <AlertDescription>
                  <strong>Microsoft Edge</strong> - Install from the menu or address bar
                </AlertDescription>
              </Alert>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">1</span>
                  <span className="flex-1">
                    Click the menu icon <MoreVertical className="w-4 h-4 inline mx-1" /> (⋯) in the top right
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">2</span>
                  <span className="flex-1">
                    Select <strong>"Apps"</strong> → <strong>"Install AlCor Nexus"</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">3</span>
                  <span className="flex-1">
                    Click <strong>"Install"</strong> in the confirmation dialog
                  </span>
                </li>
              </ol>
            </TabsContent>

            {/* General Desktop Instructions */}
            <TabsContent value="desktop" className="space-y-4 mt-4">
              <Alert>
                <Monitor className="w-4 h-4" />
                <AlertDescription>
                  <strong>Desktop Browsers</strong> - Works on Chrome, Edge, and other Chromium-based browsers
                </AlertDescription>
              </Alert>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Method 1: Address Bar</h4>
                  <p className="text-sm text-muted-foreground">
                    Look for an install icon (⊕ or <Download className="w-3 h-3 inline" />) in the browser's address bar
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Method 2: Browser Menu</h4>
                  <p className="text-sm text-muted-foreground">
                    Open the browser menu (⋮ or ⋯) and look for "Install app" or "Add to Desktop"
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">What you get:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Standalone app window (no browser UI)</li>
                    <li>Desktop shortcut or Start menu entry</li>
                    <li>Faster startup and better performance</li>
                    <li>Automatic updates</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="xl:col-span-4 xl:sticky xl:top-6 h-fit">
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>
              Quick fixes for common install issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Don't see the install option?</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Make sure you're using a supported browser (Chrome, Edge, Safari on iOS)</li>
                <li>Try refreshing the page</li>
                <li>Check if the app is already installed</li>
                <li>Clear your browser cache and try again</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Installation failed?</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Ensure you have enough storage space</li>
                <li>Check your internet connection</li>
                <li>Try using a different browser</li>
                <li>Contact support if the issue persists</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PWAInstallGuide;
