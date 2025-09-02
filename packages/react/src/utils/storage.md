# Smart Locale Persistence

The Vocoder SDK includes a sophisticated locale persistence system that works seamlessly across server and client environments.

## How It Works

### **Client-Side Persistence Strategy**

The system tries multiple storage methods in order of preference:

1. **localStorage** (persistent across browser sessions)
2. **sessionStorage** (persistent during browser session)
3. **URL Parameters** (`?locale=en`)
4. **Browser Language** (navigator.language)
5. **Default Locale** (fallback)

### **Server-Side Behavior**

On the server, the system:
- Returns the default locale immediately
- No storage operations are performed
- Ensures SSR compatibility

## Features

### **Smart Locale Matching**

The system intelligently matches user preferences to available translations:

```typescript
// Examples of smart matching:
'en-US' → 'en' (if 'en' is available)
'fr-CA' → 'fr' (if 'fr' is available)
'pt-BR' → 'pt' (if 'pt' is available)
'es-MX' → 'es' (if 'es' is available)
```

### **Graceful Fallbacks**

- **Private Browsing**: Falls back gracefully when storage is blocked
- **Storage Errors**: Continues working even if localStorage fails
- **Unsupported Locales**: Automatically finds the best available match

### **URL Parameter Support**

Users can share links with specific locales:

```
https://yourapp.com?locale=fr
https://yourapp.com?locale=es
```

## Usage Examples

### **Basic Usage**

```tsx
<TranslationProvider defaultLocale="en">
  {/* Locale will be automatically detected and persisted */}
</TranslationProvider>
```

### **Custom Storage Key**

```tsx
// The system uses 'vocoder_locale' as the default key
// You can customize this by modifying the STORAGE_KEY constant
```

### **Programmatic Locale Changes**

```tsx
const { setLocale } = useTranslation();

// This will:
// 1. Find the best matching locale
// 2. Update the UI
// 3. Persist the choice
setLocale('fr-CA'); // Might become 'fr' if 'fr-CA' isn't available
```

## Browser Compatibility

### **Supported Storage Methods**

- ✅ **localStorage**: Modern browsers
- ✅ **sessionStorage**: Modern browsers
- ✅ **URL Parameters**: All browsers
- ✅ **navigator.language**: Modern browsers

### **Fallback Behavior**

- **Private Browsing**: Uses URL params → browser language → default
- **Storage Disabled**: Uses URL params → browser language → default
- **Old Browsers**: Uses URL params → browser language → default

## Server-Side Rendering

### **SSR Compatibility**

```tsx
// Server-side: Always uses defaultLocale
// Client-side: Hydrates with stored preference
<TranslationProvider defaultLocale="en">
  {/* Works seamlessly in both environments */}
</TranslationProvider>
```

### **Hydration Strategy**

1. **Server**: Renders with default locale
2. **Client**: Hydrates with stored preference
3. **No Flash**: Smooth transition from server to client

## Advanced Features

### **Locale Validation**

The system validates locales against available translations:

```typescript
// Only allows switching to locales that have translations
setLocale('unsupported-locale'); // Will fall back to best match
```

### **Automatic Updates**

When translations are fetched, the system:
1. Checks if current locale is still supported
2. Updates to best available match if needed
3. Persists the new choice

### **Error Handling**

- **Storage Errors**: Logs warnings, continues with fallbacks
- **Invalid Locales**: Automatically finds best match
- **Network Issues**: Preserves existing locale preference

## Best Practices

### **✅ Do:**
- Use meaningful default locales
- Test in private browsing mode
- Consider URL parameters for sharing
- Handle storage errors gracefully

### **❌ Don't:**
- Rely solely on localStorage
- Assume all locales are available
- Ignore browser language preferences
- Forget about SSR compatibility

## Migration from Simple Storage

If you're upgrading from a simple localStorage approach:

1. **No Breaking Changes**: Existing code continues to work
2. **Enhanced Features**: Automatic locale matching
3. **Better UX**: Multiple fallback strategies
4. **SSR Ready**: Works in server environments 