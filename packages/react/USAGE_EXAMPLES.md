# Vocoder React SDK - Usage Examples

## Component vs Function API

Vocoder provides two ways to translate text:

1. **`<T>` component** - For JSX content (reactive, updates on locale change)
2. **`t()` function** - For JavaScript logic, attributes, utilities (uses global state)

## When to Use Each

### Use `<T>` Component
✅ **For rendered text content:**
```tsx
<h1><T>Welcome to our app!</T></h1>
<p><T name={user.name}>Hello, {name}!</T></p>
<button><T>Submit</T></button>
```

### Use `t()` Function
✅ **For non-JSX contexts:**

#### 1. HTML Attributes
```tsx
import { t } from '@vocoder/react';

<img
  src={avatar}
  alt={t('User profile picture')}
  title={t('Click to edit')}
/>

<input
  placeholder={t('Enter your email')}
  aria-label={t('Email address')}
/>
```

#### 2. Toast/Alert Notifications
```tsx
import { t } from '@vocoder/react';
import toast from 'react-hot-toast';

function saveProfile() {
  try {
    // save logic
    toast.success(t('Profile saved successfully'));
  } catch (error) {
    toast.error(t('Failed to save profile'));
  }
}
```

#### 3. Form Validation
```tsx
import { t } from '@vocoder/react';
import { z } from 'zod';

const schema = z.object({
  email: z.string()
    .email(t('Invalid email address'))
    .min(1, t('Email is required')),
  password: z.string()
    .min(8, t('Password must be at least {min} characters', { min: 8 }))
});
```

#### 4. Array/Object Literals
```tsx
import { t } from '@vocoder/react';

const statusOptions = [
  { label: t('Active'), value: 'active' },
  { label: t('Inactive'), value: 'inactive' },
  { label: t('Pending'), value: 'pending' },
];

const tableColumns = [
  { key: 'name', header: t('Name') },
  { key: 'email', header: t('Email') },
  { key: 'status', header: t('Status') },
];
```

#### 5. Utility Functions
```tsx
import { t } from '@vocoder/react';

export function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t('Just now');
  if (diffMins < 60) return t('{minutes} minutes ago', { minutes: diffMins });
  if (diffMins < 1440) return t('{hours} hours ago', { hours: Math.floor(diffMins / 60) });
  return t('{days} days ago', { days: Math.floor(diffMins / 1440) });
}
```

#### 6. Error Messages
```tsx
import { t } from '@vocoder/react';

class ValidationError extends Error {
  constructor(field: string) {
    super(t('Validation failed for {field}', { field }));
  }
}

async function fetchData() {
  throw new Error(t('Failed to load data. Please try again.'));
}
```

#### 7. Dynamic Strings
```tsx
import { t } from '@vocoder/react';

function getWelcomeMessage(time: number): string {
  const hour = new Date(time).getHours();

  if (hour < 12) return t('Good morning');
  if (hour < 18) return t('Good afternoon');
  return t('Good evening');
}

function getItemCountMessage(count: number): string {
  if (count === 0) return t('No items');
  if (count === 1) return t('1 item');
  return t('{count} items', { count });
}
```

#### 8. Metadata/SEO
```tsx
import { t } from '@vocoder/react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: t('About Us'),
  description: t('Learn more about our company and mission'),
};
```

## Complete Example

```tsx
import { VocoderProvider, T, t, LocaleSelector } from '@vocoder/react';
import toast from 'react-hot-toast';
import en from './locales/en.json';
import es from './locales/es.json';

function App() {
  return (
    <VocoderProvider translations={{ en, es }} defaultLocale="en">
      <Header />
      <ContactForm />
    </VocoderProvider>
  );
}

function Header() {
  return (
    <header>
      {/* Component for rendered content */}
      <h1><T>Welcome to Vocoder</T></h1>
      <LocaleSelector />
    </header>
  );
}

function ContactForm() {
  const handleSubmit = async (data: FormData) => {
    try {
      await sendMessage(data);
      // Function for toast notification
      toast.success(t('Message sent successfully'));
    } catch (error) {
      // Function for error message
      toast.error(t('Failed to send message. Please try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Component for labels */}
      <label>
        <T>Your Name</T>
        {/* Function for placeholder */}
        <input
          name="name"
          placeholder={t('Enter your name')}
          aria-label={t('Name field')}
        />
      </label>

      <label>
        <T>Email Address</T>
        <input
          name="email"
          type="email"
          placeholder={t('your@email.com')}
        />
      </label>

      <label>
        <T>Message</T>
        <textarea
          name="message"
          placeholder={t('Write your message here...')}
        />
      </label>

      {/* Component for button text */}
      <button type="submit">
        <T>Send Message</T>
      </button>
    </form>
  );
}
```

## Best Practices

1. **Use `<T>` for visible content** - It re-renders when locale changes
2. **Use `t()` for everything else** - Attributes, logic, utilities
3. **Keep translations consistent** - Use the same source text in both APIs
4. **Variables work the same** - `{varName}` syntax in both
5. **Provider required** - Both APIs need `VocoderProvider` mounted

## Common Patterns

### Conditional Messages
```tsx
const status = isOnline ? t('Online') : t('Offline');
const message = hasError ? t('Error occurred') : t('Success');
```

### Concatenation (❌ Avoid)
```tsx
// ❌ Bad - hard to translate
const message = t('Hello') + ', ' + name + '!';

// ✅ Good - single translatable unit
const message = t('Hello, {name}!', { name });
```

### Pluralization (Future)
```tsx
// Coming soon - ICU MessageFormat support
const message = t('{count, plural, =0 {No items} =1 {One item} other {{count} items}}', { count });
```

## TypeScript Support

Both APIs are fully typed:

```tsx
import { t, T } from '@vocoder/react';

// Function signature
function t(text: string, values?: Record<string, any>): string

// Component props
interface TProps {
  children: React.ReactNode;
  context?: string;
  formality?: 'formal' | 'informal' | 'auto';
  [key: string]: any; // For variable props
}
```

## Performance Notes

- **`<T>` component**: Reactive, re-renders on locale change
- **`t()` function**: Uses global state, no re-renders (call it again if needed)
- Both use the same translation lookup (O(1) hash map lookup)
- No performance difference in translation speed
