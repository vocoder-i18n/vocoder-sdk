# Security Guide

## ⚠️ **Client-Side API Key Risks**

**WARNING**: Exposing API keys on the client-side (browser) is inherently insecure and should be avoided in production applications.

### **Security Risks:**

1. **API Key Exposure**
   - Visible in browser DevTools
   - Logged in network requests
   - Accessible via JavaScript console
   - Cached in browser history
   - Visible in page source code

2. **Unauthorized Usage**
   - Cross-Site Scripting (XSS) attacks
   - Third-party script access
   - Browser extension access
   - Man-in-the-middle attacks

3. **Service Abuse**
   - Unlimited API calls by anyone
   - Unexpected costs
   - Service degradation

## ✅ **Secure Implementation Patterns**

### **1. Server-Side Rendering (SSR) - Recommended**

```tsx
// pages/index.tsx (Next.js)
import { TranslationProvider } from '@vocoder/react';

export async function getServerSideProps() {
  // Fetch translations on the server
  const res = await fetch('https://api.pierogi.dev/translations', {
    headers: {
      'Authorization': `Bearer ${process.env.VOCODER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const translations = await res.json();
  
  return {
    props: {
      translations
    }
  };
}

export default function HomePage({ translations }) {
  return (
    <TranslationProvider 
      defaultLocale="en"
      translations={translations} // Pre-fetched, no client-side API calls
    >
      {/* Your app content */}
    </TranslationProvider>
  );
}
```

### **2. API Route Proxy (Next.js/Remix)**

```tsx
// pages/api/translations.ts (Next.js)
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const res = await fetch('https://api.pierogi.dev/translations', {
    headers: {
      'Authorization': `Bearer ${process.env.VOCODER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const translations = await res.json();
  res.json(translations);
}
```

```tsx
// Your React component
const [translations, setTranslations] = useState(null);

useEffect(() => {
  fetch('/api/translations')
    .then(res => res.json())
    .then(setTranslations);
}, []);

if (!translations) return <div>Loading...</div>;

return (
  <TranslationProvider 
    defaultLocale="en"
    translations={translations}
  >
    {/* Your app content */}
  </TranslationProvider>
);
```

### **3. Build-Time Generation (Static Sites)**

```tsx
// next.config.js
module.exports = {
  async generateStaticParams() {
    const res = await fetch('https://api.pierogi.dev/translations', {
      headers: {
        'Authorization': `Bearer ${process.env.VOCODER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const translations = await res.json();
    
    // Generate static pages with translations
    return Object.keys(translations).map(locale => ({
      params: { locale },
      props: { translations: translations[locale] }
    }));
  }
};
```

### **4. Edge Functions (Vercel/Netlify)**

```tsx
// api/translations.js (Vercel Edge Function)
export default async function handler(req) {
  const res = await fetch('https://api.pierogi.dev/translations', {
    headers: {
      'Authorization': `Bearer ${process.env.VOCODER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const translations = await res.json();
  
  return new Response(JSON.stringify(translations), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 🔒 **Best Practices**

### **✅ Do:**
- Use server-side rendering (SSR)
- Implement API route proxies
- Generate translations at build time
- Use environment variables on the server only
- Implement proper CORS policies
- Add rate limiting to your proxy endpoints

### **❌ Don't:**
- Expose API keys in client-side code
- Use API keys in meta tags
- Store keys in localStorage/sessionStorage
- Log API keys in console or network requests
- Share API keys in public repositories

## 🚨 **When Client-Side is Acceptable**

Client-side API keys are only acceptable for:
- **Development/testing environments**
- **Public demo applications**
- **Internal tools with limited access**
- **Applications where security is not a concern**

## 📋 **Security Checklist**

- [ ] API key is only used server-side
- [ ] No API key in client-side code
- [ ] Environment variables are properly configured
- [ ] CORS policies are implemented
- [ ] Rate limiting is in place
- [ ] API key rotation is planned
- [ ] Monitoring for unusual usage
- [ ] Error handling doesn't expose sensitive data

## 🔧 **Migration Guide**

If you're currently using client-side API keys:

1. **Create a server-side proxy endpoint**
2. **Update your TranslationProvider to use the proxy**
3. **Remove client-side API key references**
4. **Test thoroughly**
5. **Monitor for any issues**

Remember: **Security is not optional for production applications!** 