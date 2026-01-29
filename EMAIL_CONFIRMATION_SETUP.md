# Email Confirmation Deep Link Setup

This guide explains how to configure email confirmation links to open the LingoLeaf app.

## 1. Supabase Configuration

### A. Set Redirect URL in Supabase Dashboard

1. Go to **Authentication → URL Configuration** in your Supabase dashboard
2. Add these redirect URLs:
   - **Production**: `https://lingoleafapp.com/auth-redirect.html`
   - **Development**: `http://localhost:19006/auth-redirect.html` (for Expo web)
   - **Deep Link**: `lingoleaf://auth` (for mobile app)

### B. Configure Email Templates

1. Go to **Authentication → Email Templates**
2. For **Confirm signup** template, update the confirmation link:

```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

The `{{ .ConfirmationURL }}` will automatically use your configured redirect URL.

## 2. Domain Setup (lingoleafapp.com)

### A. Create the Redirect Page

Upload `public/auth-redirect.html` to your web host at:
```
https://lingoleafapp.com/auth-redirect.html
```

### B. iOS Universal Links (Apple App Site Association)

Create a file at `https://lingoleafapp.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.lingoleaf.app",
        "paths": ["/auth*"]
      }
    ]
  }
}
```

Replace `TEAM_ID` with your Apple Developer Team ID.

### C. Android App Links (Digital Asset Links)

Create a file at `https://lingoleafapp.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.lingoleaf.app",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

Get your SHA256 fingerprint with:
```bash
keytool -list -v -keystore your-keystore.jks
```

## 3. Build & Deploy

### Rebuild the App

After updating `app.json`, rebuild your app:

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### Test Deep Links

**iOS Simulator:**
```bash
xcrun simctl openurl booted "lingoleaf://auth#access_token=test"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "lingoleaf://auth#access_token=test" com.lingoleaf.app
```

## 4. Flow Overview

### Same Device (App Installed)
1. User signs up → receives email
2. User taps confirmation link → opens `lingoleafapp.com/auth-redirect.html`
3. Page automatically redirects to `lingoleaf://auth#access_token=...`
4. App opens and handles the deep link
5. User is signed in automatically

### Different Device / App Not Installed
1. User signs up → receives email
2. User taps confirmation link → opens `lingoleafapp.com/auth-redirect.html`
3. Page shows "Email Confirmed!" with button to open app
4. User can download app and sign in normally

## 5. Testing

1. **Sign up with a real email** (use a test email you control)
2. **Check spam folder** for confirmation email
3. **Tap the link** in the email
4. **Verify** the app opens (if installed) or shows confirmation page

## 6. Troubleshooting

**Link goes to localhost:**
- Update Supabase redirect URL to production URL

**App doesn't open:**
- Verify `app.json` has correct `scheme` and `associatedDomains`
- Rebuild the app after changes
- Check that `.well-known` files are accessible

**"Invalid session" error:**
- Verify tokens are being passed correctly in the URL
- Check Supabase logs for auth errors

**Universal Links not working (iOS):**
- Ensure HTTPS is used (not HTTP)
- Verify Apple App Site Association file is valid
- Clear iOS cache: Settings → Safari → Clear History and Website Data

