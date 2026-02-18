# Xantuus AI Browser Extension - Complete Guide

## Overview

The **Xantuus AI Browser Bridge** extension enables your AI agent to access authenticated sessions and bypass security restrictions by sharing cookies, localStorage, and sessionStorage from your real browser to the automated Puppeteer instance.

### Key Benefits

✅ **Access Logged-In Sites** - Use your existing authenticated sessions
✅ **Bypass Bot Detection** - Real browser cookies defeat anti-bot measures
✅ **Cloudflare & CAPTCHA** - Manual completion in real browser, automation continues
✅ **2FA Support** - Complete 2FA in real browser, sync session to agent
✅ **Session Persistence** - Save and reuse sessions across automations
✅ **Cross-Browser Compatible** - Chrome, Edge, Brave, Arc, Opera

---

## Installation

### 1. Build the Extension

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next/browser-extension

# Create icons directory
mkdir -p icons

# You'll need to add icon files (icon16.png, icon32.png, icon48.png, icon128.png)
# For now, you can use placeholder icons or generate them
```

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `browser-extension` folder
5. Extension should appear in your toolbar

### 3. Get API Key from Xantuus

1. Go to http://localhost:3010/settings/api-keys
2. Click **Create New API Key**
3. Give it a name (e.g., "Browser Extension")
4. Copy the generated key

### 4. Connect Extension

1. Click the **Xantuus AI** extension icon in toolbar
2. Paste your API key
3. Click **Connect to Xantuus**
4. You should see "Connected successfully"

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER'S REAL BROWSER                         │
│  (Chrome/Edge/Brave with Xantuus Extension)                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 1. User logs into site
                       │ 2. Extension captures cookies/localStorage
                       │ 3. Auto-syncs every 60 seconds
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  XANTUUS AI BACKEND                             │
│  /api/browser/session/cookies                                   │
│  - Stores cookies by domain                                     │
│  - Associates with user account                                 │
│  - Provides to Puppeteer on request                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ 4. Agent needs to access site
                       │ 5. Backend retrieves stored cookies
                       │ 6. Injects into Puppeteer session
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              PUPPETEER AUTOMATED BROWSER                        │
│  - Receives real browser cookies                                │
│  - Acts as authenticated user                                   │
│  - Bypasses login/2FA/CAPTCHA                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Cookie Sync Flow

1. **Manual Login** - User logs into site in real browser (e.g., Gmail, LinkedIn)
2. **Automatic Capture** - Extension detects authentication and captures cookies
3. **Backend Storage** - Cookies synced to Xantuus backend every 60 seconds
4. **Agent Usage** - When AI agent needs to access same site, cookies are injected
5. **Seamless Access** - Agent appears as authenticated user, no re-login needed

---

## Tips & Best Practices

### 1. **Pre-Login to Sites Before Automation**

Before running an automation task, manually log into the target site in your real browser:

```typescript
// Example workflow:
// 1. Open LinkedIn in Chrome
// 2. Log in normally
// 3. Wait for extension to sync (60 seconds or click "Sync Now")
// 4. Run automation - AI agent will use your session
```

### 2. **Use "Capture Session" for Complex Logins**

For sites with complex authentication (2FA, OAuth):

1. Complete full login flow in real browser
2. Click extension icon
3. Click **"Capture Session"** button
4. This captures cookies + localStorage + sessionStorage
5. Agent can replicate exact session state

### 3. **Keep Browser Open During Long Automations**

- Extension syncs every 60 seconds
- If session expires, it will auto-refresh from your browser
- Keeps agent sessions alive indefinitely

### 4. **Domain-Specific Sync**

Extension syncs cookies for:
- Currently active tabs
- Recently visited domains (last 10 minutes)

To ensure sync for a specific domain:
```javascript
// Visit the site before automation
window.open('https://example.com', '_blank');
// Wait 60 seconds for sync, or click "Sync Now"
```

### 5. **Test Auth First**

Before complex automation, test authentication:

```bash
curl -X GET "http://localhost:3010/api/browser/session/cookies?domain=example.com" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

Should return cookies for that domain if synced.

---

## Advanced Features

### 1. **Manual Cookie Injection**

You can manually inject cookies for testing:

```typescript
// In Puppeteer context
const response = await fetch('http://localhost:3010/api/browser/session/cookies?domain=example.com', {
  headers: { 'Authorization': 'Bearer API_KEY' }
});

const { cookies } = await response.json();

// Inject into Puppeteer page
for (const cookie of cookies) {
  await page.setCookie(cookie);
}
```

### 2. **Session Persistence**

Sessions are stored in database and persist across:
- Browser restarts
- Computer restarts
- Extension updates

### 3. **Multi-Account Support**

Create multiple API keys for different accounts:

1. Main account → API Key 1 → Extension Profile 1
2. Work account → API Key 2 → Extension Profile 2

Use Chrome profiles to isolate sessions.

### 4. **Monitoring Cookie Health**

Check cookie expiration:

```javascript
// In extension popup console
chrome.cookies.getAll({}, (cookies) => {
  const expiringSoon = cookies.filter(c => {
    return c.expirationDate && c.expirationDate < (Date.now()/1000 + 86400);
  });
  console.log('Expiring in 24h:', expiringSoon);
});
```

---

## Improving Bot Detection Bypass

### Current Limitations

Puppeteer is detectable by:
- **navigator.webdriver** - Flag set to true
- **Chrome DevTools Protocol** - Detectable headers
- **Permissions API** - Unusual values
- **Plugin arrays** - Missing expected plugins
- **WebGL fingerprinting** - Headless signatures

### Improvements to Implement

#### 1. **Stealth Plugin (Already Installed)**

Your project already has `puppeteer-extra-stealth`:

```typescript
// In browser-control.ts
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// This already helps, but can be improved:
const browser = await puppeteer.launch({
  headless: 'new', // Use new headless mode
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
});
```

#### 2. **Use Real User-Agent**

Sync user-agent from extension:

```javascript
// In background.js, add to captureSessionState():
const userAgent = navigator.userAgent;
const platform = navigator.platform;
const languages = navigator.languages;

// Send to backend and inject into Puppeteer:
await page.setUserAgent(userAgent);
await page.evaluateOnNewDocument((platform, languages) => {
  Object.defineProperty(navigator, 'platform', { get: () => platform });
  Object.defineProperty(navigator, 'languages', { get: () => languages });
}, platform, languages);
```

#### 3. **Canvas/WebGL Fingerprint Matching**

Capture real browser fingerprints and replay:

```javascript
// Capture in extension
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const fingerprint = ctx.getImageData(0, 0, 1, 1).data;

// Inject into Puppeteer
await page.evaluateOnNewDocument((fp) => {
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    const imageData = originalGetImageData.apply(this, args);
    // Modify data to match real browser
    return imageData;
  };
}, fingerprint);
```

#### 4. **Viewport & Screen Resolution**

Match real browser dimensions:

```javascript
// Extension captures
const screenWidth = window.screen.width;
const screenHeight = window.screen.height;

// Puppeteer sets
await page.setViewport({
  width: screenWidth,
  height: screenHeight,
  deviceScaleFactor: window.devicePixelRatio,
});
```

#### 5. **Timezone & Locale**

```javascript
await page.emulateTimezone('America/New_York'); // User's timezone
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
});
```

---

## Handling Specific Security Challenges

### Cloudflare Turnstile / hCaptcha

**Strategy**: Complete in real browser, sync session

```
1. User visits site in Chrome → Cloudflare challenge appears
2. User completes challenge manually
3. Cloudflare sets cookies (cf_clearance, etc.)
4. Extension auto-syncs cookies
5. Agent uses synced cookies → Bypass Cloudflare
```

**Cookies to watch for**:
- `cf_clearance` (Cloudflare)
- `h-captcha-response` (hCaptcha)
- `g-recaptcha-response` (reCAPTCHA)

### LinkedIn Bot Detection

LinkedIn aggressively blocks bots. Improvements:

```typescript
// 1. Use real session cookies (already done with extension)
// 2. Add random delays between actions
await page.waitForTimeout(Math.random() * 2000 + 1000);

// 3. Scroll page naturally
await page.evaluate(() => {
  window.scrollBy(0, Math.random() * 300 + 100);
});

// 4. Move mouse randomly (requires chrome-remote-interface)
const client = await page.target().createCDPSession();
await client.send('Input.dispatchMouseEvent', {
  type: 'mouseMoved',
  x: Math.random() * 800,
  y: Math.random() * 600,
});

// 5. Type like human
async function humanType(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }
}
```

### Google/Gmail Security

Google tracks:
- Device fingerprints
- Login locations (IP)
- Session patterns

**Improvements**:
1. **Sync device fingerprints** from extension
2. **Use residential proxy** matching your location
3. **OAuth token sync** instead of cookies (more reliable)

```javascript
// Extension captures OAuth tokens from localStorage
const googleTokens = {
  access_token: localStorage.getItem('google_access_token'),
  refresh_token: localStorage.getItem('google_refresh_token'),
};

// Agent uses OAuth instead of scraping
```

### Banking Sites (High Security)

**DO NOT automate without explicit permission**

If authorized:
1. Use **hardware 2FA keys** (YubiKey) in extension
2. **IP whitelisting** - Run agent from same IP as real browser
3. **Session time limits** - Sync every 5 minutes (not 60)
4. **Behavioral biometrics** - Match typing speed, mouse movements

---

## Security & Privacy

### Data Protection

**What's Transmitted**:
- ✅ Cookies (encrypted in transit via HTTPS)
- ✅ LocalStorage (encrypted)
- ✅ SessionStorage (encrypted)
- ❌ Passwords (NEVER captured)
- ❌ Credit cards (NEVER captured)
- ❌ Private messages (NEVER captured)

**Storage**:
- Cookies stored in PostgreSQL (encrypted at rest recommended)
- Associated with user account (isolated per user)
- Auto-deleted when session expires

### Best Practices

1. **Use API Keys, Not Passwords**
   - Extension authenticates with API key only
   - Rotate keys regularly (every 30 days)
   - Revoke immediately if compromised

2. **Limit Permissions**
   - Extension only requests necessary permissions
   - Review `manifest.json` permissions before installation

3. **Monitor Usage**
   - Check sync logs in Xantuus dashboard
   - Alert on unusual sync patterns

4. **GDPR Compliance**
   - Users must consent to cookie sharing
   - Provide cookie deletion endpoint
   - Data retention policy (30 days max recommended)

---

## Troubleshooting

### Extension Not Syncing

**Check**:
1. API key is valid (test in settings)
2. Extension is connected (icon shows green dot)
3. Active tab has cookies (visit site before sync)
4. Backend is running (http://localhost:3010)
5. CORS is configured (extension URL must be allowed)

**Debug**:
```javascript
// In extension popup, open DevTools (right-click → Inspect popup)
// Check console for errors

// In background service worker
chrome://extensions/ → Xantuus AI → Service Worker → Inspect
// View sync logs
```

### Cookies Not Working in Agent

**Possible Issues**:
1. **Domain mismatch** - Cookie for `www.example.com` won't work on `example.com`
2. **Secure flag** - Secure cookies require HTTPS
3. **HttpOnly flag** - Can't be accessed by JavaScript
4. **SameSite attribute** - Strict cookies may not work in automation
5. **Expiration** - Cookie expired between sync and usage

**Fix**:
```typescript
// Modify cookie attributes before injection
const modifiedCookies = cookies.map(c => ({
  ...c,
  secure: false, // Allow HTTP
  httpOnly: false, // Allow JavaScript access
  sameSite: 'Lax', // More permissive
}));

await page.setCookie(...modifiedCookies);
```

### High Memory Usage

Extension stores cookies for all domains. Optimize:

```javascript
// In background.js, only sync active domains
const MAX_DOMAINS = 50;
const domains = Array.from(domains).slice(0, MAX_DOMAINS);
```

### Sync Too Slow

Default 60 seconds. Speed up:

```javascript
// In background.js
const SYNC_INTERVAL = 30000; // 30 seconds
```

Or trigger manual sync on specific events:
```javascript
// Sync immediately after login
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('login')) {
    setTimeout(syncCookiesWithBackend, 1000);
  }
});
```

---

## Advanced Customizations

### 1. **Selective Domain Sync**

Only sync specific domains to reduce storage:

```javascript
// In background.js
const ALLOWED_DOMAINS = [
  'linkedin.com',
  'gmail.com',
  'salesforce.com',
  // Add your target domains
];

const filteredDomains = domains.filter(d =>
  ALLOWED_DOMAINS.some(allowed => d.includes(allowed))
);
```

### 2. **Encrypted Cookie Storage**

Add end-to-end encryption:

```javascript
// Install crypto library in extension
import { encrypt, decrypt } from './crypto';

// Before sending to backend
const encryptedCookies = encrypt(JSON.stringify(cookies), userKey);

// Backend stores encrypted data
// Agent decrypts when needed
```

### 3. **Session Sharing Across Team**

Allow team members to share authenticated sessions:

1. Create "Shared Sessions" table
2. User captures session → Marks as shared
3. Team members access with permission
4. Audit log tracks usage

### 4. **Auto-Refresh Sessions**

Keep sessions alive automatically:

```javascript
// Extension checks cookie expiration
setInterval(async () => {
  const cookies = await chrome.cookies.getAll({});
  const expiringSoon = cookies.filter(c => {
    return c.expirationDate < (Date.now()/1000 + 3600); // 1 hour
  });

  if (expiringSoon.length > 0) {
    // Trigger refresh by visiting site
    chrome.tabs.create({ url: siteUrl, active: false });
  }
}, 600000); // Check every 10 minutes
```

### 5. **Visual Session Indicator**

Show which sites are synced:

```javascript
// In popup.html, list synced domains
const domains = Object.keys(cookies);
const domainList = document.getElementById('syncedDomains');

domains.forEach(domain => {
  const item = document.createElement('div');
  item.className = 'domain-item';
  item.innerHTML = `
    <span>${domain}</span>
    <span class="cookie-count">${cookies[domain].length} cookies</span>
  `;
  domainList.appendChild(item);
});
```

---

## Performance Optimization

### 1. **Debounce Syncs**

Avoid too frequent syncs:

```javascript
let syncTimeout;

function debouncedSync() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncCookiesWithBackend, 5000);
}

// Trigger on relevant events
chrome.cookies.onChanged.addListener(debouncedSync);
```

### 2. **Compress Cookie Data**

Before sending to backend:

```javascript
import pako from 'pako'; // Add to package

const compressed = pako.gzip(JSON.stringify(cookies));
// Send compressed data (reduce bandwidth)
```

### 3. **Incremental Sync**

Only sync changed cookies:

```javascript
let lastCookieHash = {};

async function incrementalSync() {
  const cookies = await getAllCookies();
  const currentHash = hashCookies(cookies);

  const changedDomains = Object.keys(currentHash).filter(domain => {
    return currentHash[domain] !== lastCookieHash[domain];
  });

  if (changedDomains.length > 0) {
    // Only sync changed domains
    await syncDomainsToBackend(changedDomains);
    lastCookieHash = currentHash;
  }
}
```

---

## Roadmap & Future Enhancements

### Short Term (1-2 weeks)
- [ ] Add icon files (16, 32, 48, 128px)
- [ ] Implement encrypted cookie storage
- [ ] Add sync history in popup
- [ ] Show sync status notifications
- [ ] Add domain whitelist/blacklist

### Medium Term (1-2 months)
- [ ] Firefox extension version
- [ ] Safari extension version
- [ ] Session sharing across team
- [ ] OAuth token management
- [ ] Auto-refresh expired sessions
- [ ] Visual session health dashboard

### Long Term (3-6 months)
- [ ] Browser fingerprint cloning (full)
- [ ] AI-powered bot detection bypass
- [ ] Session recording & replay
- [ ] Multi-device sync (mobile + desktop)
- [ ] Enterprise SSO integration

---

## Success Metrics

Track these to measure effectiveness:

1. **Sync Success Rate** - % of successful syncs
2. **Cookie Coverage** - % of target domains with valid cookies
3. **Bot Detection Bypass Rate** - % of automations that succeed
4. **Session Persistence** - Average session lifetime
5. **User Adoption** - % of users with extension installed

**Target Goals**:
- Sync success rate: >95%
- Cookie coverage: >80% of target domains
- Bot detection bypass: >90%
- Session persistence: >7 days
- User adoption: >60% of active users

---

## Support & Resources

- **Extension Logs**: `chrome://extensions/` → Xantuus AI → Service Worker → Inspect
- **API Logs**: Check Xantuus backend console for sync events
- **Cookie Viewer**: Use Chrome DevTools → Application → Cookies
- **Network Debugging**: DevTools → Network → Filter by "cookies" endpoint

---

## Quick Reference

### Common Commands

```bash
# Install extension
cd browser-extension && open chrome://extensions

# Update schema for cookie storage
npx prisma db push

# View sync logs
tail -f logs/extension-sync.log

# Test cookie endpoint
curl http://localhost:3010/api/browser/session/cookies?domain=example.com \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Keyboard Shortcuts

- **Open Extension**: `Alt+Shift+X` (customize in chrome://extensions/shortcuts)
- **Sync Now**: Click extension icon → Sync Now button
- **Capture Session**: Click extension icon → Capture Session button

### API Endpoints

```
POST /api/browser/session/cookies     - Receive cookies from extension
GET  /api/browser/session/cookies     - Retrieve stored cookies
GET  /api/browser/session/cookies?domain=example.com - Get domain-specific cookies
```

---

**Ready to get started?** Follow the Installation section above and start syncing your authenticated sessions! 🚀
