# Vocoder SDK Development Environment

A comprehensive testing environment for the Vocoder React SDK, designed to test both server-side and client-side implementations.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   cd examples/dev-env
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env.local
   # Edit .env.local with your test API key
   ```

3. **Start the development server:**
   ```bash
   pnpm dev
   ```

4. **Open your browser:**
   ```
   http://localhost:3000
   ```

## 🧪 What You Can Test

### **1. Locale Persistence**
- Change locale using the selector
- Refresh the page
- Verify the locale is remembered
- Test URL parameters (`?locale=fr`)

### **2. API Key Sources**
- **Environment Variables**: Set `VOCODER_API_KEY` in `.env.local`
- **Meta Tags**: Already configured in `layout.tsx`
- **Window Globals**: Use the test interface to set `window.__VOCODER_API_KEY__`
- **Direct Props**: Toggle the checkbox and enter an API key

### **3. Server-Side Rendering**
- Check page source for server-rendered content
- Test API route at `/api/translations`
- Verify SSR compatibility

### **4. Storage Fallbacks**
- Test in private browsing mode
- Disable localStorage in DevTools
- Verify graceful fallbacks

### **5. Error Handling**
- Test with invalid API keys
- Test with network errors
- Verify error states are handled properly

## 📁 Project Structure

```
examples/dev-env/
├── app/
│   ├── api/
│   │   └── translations/
│   │       └── route.ts          # Mock API endpoint
│   ├── globals.css               # Styles
│   ├── layout.tsx                # Root layout with meta tags
│   └── page.tsx                  # Main test page
├── .env.local                    # Environment variables (create from env.example)
├── env.example                   # Example environment file
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

## 🔧 Configuration Options

### **Environment Variables**
```bash
# .env.local
VOCODER_API_KEY=your-test-api-key
```

### **Meta Tags**
```html
<!-- Already configured in layout.tsx -->
<meta name="VOCODER_API_KEY" content="test-meta-key" />
```

### **Window Globals**
```javascript
// Set via the test interface
window.__VOCODER_API_KEY__ = 'your-test-key';
```

## 🧪 Testing Scenarios

### **Basic Translation**
- Tests basic message formatting
- Tests dynamic values (`{name}`)
- Tests fallback text

### **Locale Information**
- Shows current locale
- Shows available locales
- Tests locale switching

### **Storage Test**
- Displays localStorage value
- Shows storage fallbacks
- Tests private browsing

### **API Key Source**
- Identifies which API key source is being used
- Tests priority order
- Shows configuration status

### **Locale Selector**
- Tests the built-in LocaleSelector component
- Tests programmatic locale changes
- Tests URL parameter detection

## 🔍 Debugging

### **Browser DevTools**
1. **Console**: Check for warnings and errors
2. **Network**: Monitor API requests
3. **Application**: Inspect localStorage/sessionStorage
4. **Elements**: Check meta tags and DOM

### **Server-Side Debugging**
1. **Terminal**: Check Next.js logs
2. **API Route**: Test `/api/translations` directly
3. **Environment**: Verify `.env.local` is loaded

### **Common Issues**

#### **TypeScript Errors**
```bash
# If you see module resolution errors
pnpm install
# or
npm install
```

#### **API Key Not Found**
```bash
# Check if .env.local exists and has the right format
cp env.example .env.local
# Edit .env.local with your test key
```

#### **Storage Not Working**
- Check if you're in private browsing mode
- Verify localStorage is enabled in browser settings
- Check for browser extensions blocking storage

## 🎯 Testing Checklist

- [ ] **Locale persistence** works across page refreshes
- [ ] **URL parameters** override stored preferences
- [ ] **Browser language** is detected correctly
- [ ] **API key sources** work in priority order
- [ ] **Error states** are handled gracefully
- [ ] **SSR compatibility** works without hydration mismatch
- [ ] **Storage fallbacks** work in private browsing
- [ ] **Message formatting** works with dynamic values
- [ ] **Locale switching** updates all components
- [ ] **Security warnings** appear for client-side API keys

## 🚀 Next Steps

After testing the development environment:

1. **Build the packages:**
   ```bash
   cd ..
   pnpm build
   ```

2. **Test the built packages:**
   ```bash
   cd dev-env
   pnpm dev
   ```

3. **Publish to npm:**
   ```bash
   cd ../packages/types && npm publish
   cd ../packages/react && npm publish
   cd ../packages/cli && npm publish
   cd ../packages/kit && npm publish
   ```

## 📝 Notes

- This environment uses **mock data** for testing
- **No real API calls** are made to your production API
- **All features** of the SDK are tested
- **SSR and CSR** scenarios are covered
- **Error handling** is thoroughly tested

Happy testing! 🎉 