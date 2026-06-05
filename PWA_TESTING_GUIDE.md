# PWA Testing & Validation Guide

## 🧪 Quick Test Commands

```bash
# Build and test PWA locally
npm run pwa:test

# Generate PWA assets (icons, splash screens)
npm run pwa:generate-assets

# Type check before deployment
npm run type-check

# Build for production
npm run build
```

---

## ✅ Testing Checklist

### 1. **Manifest Validation**

#### Chrome DevTools:
1. Open DevTools (F12)
2. Go to **Application** → **Manifest**
3. Verify all fields:
   - ✅ Name: "AlCor Nexus CRM"
   - ✅ Short Name: "AlCor CRM"
   - ✅ Start URL: "/"
   - ✅ Display: "standalone"
   - ✅ Theme Color: "#0891b2"
   - ✅ Icons loaded (check for errors)

#### Common Issues:
- ❌ "Manifest URL not found" → Check manifest.json link in index.html
- ❌ "Icon could not be downloaded" → Verify icon paths exist
- ❌ "Start URL not in scope" → Ensure scope includes start_url

---

### 2. **Service Worker Validation**

#### Chrome DevTools:
1. **Application** → **Service Workers**
2. Check status: "activated and is running"
3. Click "Update" to test update flow
4. Check "Offline" checkbox and reload page

#### Test Offline Functionality:
```bash
# In DevTools Console:
navigator.serviceWorker.ready.then(reg => console.log('SW Ready:', reg));
```

Expected:
- ✅ Service worker registers without errors
- ✅ Offline page displays when network is disabled
- ✅ Cached resources load offline
- ✅ Update banner appears when new version available

---

### 3. **Installation Testing**

#### Desktop Chrome:
1. Look for **install icon** in address bar (⊕ or ⬇️)
2. Click to install
3. App opens in standalone window
4. Check window has no browser chrome
5. Verify app icon in taskbar/dock

#### Mobile Android:
1. Open in Chrome
2. Look for "Add to Home Screen" banner
3. Or Menu → Install App
4. Accept installation
5. Launch from home screen
6. Verify standalone mode (no browser UI)

#### Mobile iOS (Safari):
1. Open in Safari (not Chrome!)
2. Tap Share button (□↑)
3. Scroll down → "Add to Home Screen"
4. Tap "Add"
5. Launch from home screen
6. Verify splash screen appears
7. Check status bar style

---

### 4. **Lighthouse PWA Audit**

#### Run Audit:
1. Open Chrome DevTools
2. Go to **Lighthouse** tab
3. Select **Progressive Web App** category
4. Check **Desktop** or **Mobile**
5. Click **Analyze page load**

#### Target Scores:
- 🎯 **Overall PWA Score**: 90+ / 100
- ✅ Fast and reliable (service worker)
- ✅ Installable (manifest)
- ✅ PWA optimized (icons, theme, splash)

#### Common Failures & Fixes:

| Issue | Fix |
|-------|-----|
| "Does not register a service worker" | Check service worker registration in main.tsx |
| "Web app manifest does not meet requirements" | Verify all required manifest fields |
| "Does not provide a valid apple-touch-icon" | Add apple-touch-icon-180x180.png |
| "Does not set a theme color" | Check theme-color meta tag in index.html |
| "Does not provide an offline page" | Verify offline.html in CRITICAL_ASSETS |

---

### 5. **Offline Experience Testing**

#### Steps:
1. Load app while online
2. Navigate through key pages (dashboard, leads, etc.)
3. Open DevTools → Network tab
4. Check **Offline** checkbox
5. Try to navigate:
   - ✅ Dashboard should load from cache
   - ✅ Offline page appears for unvisited routes
   - ✅ Cached images/assets load
   - ❌ API calls fail gracefully

6. Make changes offline (if applicable):
   - Fill out form
   - Submit (should queue)
   - Go back online
   - Verify sync happens automatically

#### Test Offline Page:
```bash
# In DevTools Console (while offline):
fetch('/nonexistent-page').then(r => console.log('Response:', r));
```

Expected: offline.html should be served

---

### 6. **Haptic Feedback Testing** (Mobile Only)

#### Test Interactions:
1. Tap buttons → Should feel light vibration
2. Toggle switches → Medium feedback
3. Complete actions → Success pattern
4. Trigger errors → Error pattern

#### Enable Haptics in Your Code:
```typescript
import { useHaptic } from '@/lib/haptics';

function MyComponent() {
  const haptic = useHaptic();
  
  return (
    <Button onClick={() => {
      haptic.tap(); // Light tap
      // your action
    }}>
      Click Me
    </Button>
  );
}
```

---

### 7. **Update Flow Testing**

#### Simulate Update:
1. Deploy app (version 1)
2. User installs and uses app
3. Make code changes
4. Increment `CACHE_NAME` in service-worker.js:
   ```javascript
   const CACHE_NAME = 'alcor-nexus-v4'; // was v3
   ```
5. Deploy changes (version 2)
6. User visits app again
7. Verify **update banner** appears
8. Click "Update" button
9. App reloads with new version

---

### 8. **Screenshots & Branding**

#### Required Screenshots:
Create these in `public/screenshots/`:

**Desktop (1280x720):**
- dashboard-wide.png - Main dashboard view

**Mobile (750x1334):**
- leads-mobile.png - Lead management interface  
- ai-chat-mobile.png - AI chat interface

#### How to Create:
1. **Desktop**: Open app in full-screen, zoom to 100%
2. **Mobile**: Use DevTools device emulation (iPhone 8)
3. Take screenshot of key features
4. Crop to exact dimensions
5. Save as PNG

#### Or Use Browser Extension:
- [Full Page Screen Capture](https://chrome.google.com/webstore/detail/full-page-screen-capture/)

---

### 9. **Cross-Browser Testing**

#### Test Matrix:
| Browser | Platform | Expected |
|---------|----------|----------|
| Chrome 120+ | Desktop | ✅ Full support |
| Edge 120+ | Desktop | ✅ Full support |
| Firefox 120+ | Desktop | ⚠️ Limited PWA |
| Safari 17+ | Desktop | ⚠️ No install prompt |
| Chrome | Android 10+ | ✅ Full support |
| Safari | iOS 16+ | ✅ Add to home screen |

#### Known Limitations:
- **iOS**: No install prompt, user must manually add
- **Firefox**: Limited PWA features, works but no install
- **Safari Desktop**: Can't install as app

---

### 10. **Performance Testing**

#### Key Metrics:
```bash
# Run production build
npm run build

# Start preview server
npm run preview

# Test with Lighthouse
# Target metrics:
# - FCP (First Contentful Paint): < 1.5s
# - LCP (Largest Contentful Paint): < 2.5s
# - TTI (Time to Interactive): < 3.5s
# - CLS (Cumulative Layout Shift): < 0.1
```

#### Optimize if needed:
- Image optimization (WebP, lazy loading)
- Code splitting (already configured)
- CDN for static assets
- Compression (gzip/brotli)

---

## 🐛 Common Issues & Solutions

### Issue: "Service Worker won't register"
**Solution:**
```typescript
// Check in main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered:', reg))
      .catch(err => console.error('SW registration failed:', err));
  });
}
```

### Issue: "Install prompt never shows"
**Solutions:**
- Wait 30 seconds after initial page load
- Ensure HTTPS is enabled (localhost is OK)
- Check manifest has no errors
- Verify service worker is active
- User hasn't already installed or dismissed

### Issue: "App not loading offline"
**Solutions:**
- Check service worker cached the pages
- Verify `CRITICAL_ASSETS` includes necessary files
- Clear cache and retry:
  ```javascript
  caches.keys().then(names => names.forEach(name => caches.delete(name)));
  ```

### Issue: "Icons not showing"
**Solutions:**
- Run `npm run pwa:generate-assets`
- Verify icon files exist in public/
- Check browser console for 404 errors
- Clear browser cache

### Issue: "iOS splash screen not working"
**Solutions:**
- Verify apple-touch-startup-image links in index.html
- Check image dimensions match device specs exactly
- Test on actual device (simulator may not show)
- Ensure images are in public/ directory

---

## 📊 Monitoring Checklist

After deployment, monitor:

### Analytics:
- [ ] Track install events
- [ ] Track standalone launches
- [ ] Track offline usage
- [ ] Track update acceptance rate

### Errors:
- [ ] Service worker registration errors
- [ ] Cache errors in console
- [ ] Failed fetch requests
- [ ] Update failures

### Performance:
- [ ] PWA Lighthouse score weekly
- [ ] Service worker load time
- [ ] Offline page load time
- [ ] Asset cache hit rate

---

## 🎓 Advanced Testing

### Test Background Sync:
```javascript
// In DevTools Console
navigator.serviceWorker.ready.then(reg => {
  reg.sync.register('test-sync').then(() => {
    console.log('Sync registered');
  });
});
```

### Test Push Notifications:
```javascript
// Request permission
Notification.requestPermission().then(permission => {
  if (permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Test', {
        body: 'Push notification test'
      });
    });
  }
});
```

### Test Share Target:
```javascript
// Test Web Share API
if (navigator.share) {
  navigator.share({
    title: 'Test Share',
    text: 'Testing share target',
    url: 'https://example.com'
  });
}
```

---

## ✅ Pre-Deployment Checklist

Before going live:

- [ ] All PWA assets generated
- [ ] Screenshots created and placed
- [ ] Lighthouse PWA score > 90
- [ ] Tested on real iOS device
- [ ] Tested on real Android device
- [ ] Offline functionality works
- [ ] Update flow tested
- [ ] Service worker registers correctly
- [ ] Install prompt appears
- [ ] Haptic feedback works (mobile)
- [ ] Safe area insets work (notched devices)
- [ ] HTTPS enabled (production)
- [ ] Analytics integrated
- [ ] Error monitoring setup

---

## 🚀 You're Ready!

Once all tests pass, your PWA is production-ready and will provide an excellent mobile app experience without needing separate iOS/Android apps!

**Questions?** Check [PWA_DEPLOYMENT_GUIDE.md](PWA_DEPLOYMENT_GUIDE.md) for detailed documentation.
