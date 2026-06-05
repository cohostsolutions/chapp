import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { devLog } from "@/lib/logger";
import { inject } from "@vercel/analytics";
import { initErrorTracking } from "@/lib/sentry";

if (import.meta.env.PROD) {
  inject();
}

initErrorTracking();

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        devLog('SW registered:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        devLog('SW registration failed:', error);
      });
  });
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Add to home screen prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  
  // Show install button in UI
  const installButton = document.getElementById('install-pwa');
  if (installButton) {
    installButton.style.display = 'block';
    installButton.addEventListener('click', () => {
      deferredPrompt?.prompt();
      deferredPrompt?.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          devLog('User accepted the install prompt');
        }
        deferredPrompt = null;
      });
    });
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
