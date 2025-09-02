# Isomorphic Environment Variables

This utility provides a way to access environment variables in both server-side and client-side environments without requiring Node.js types.

## How it works

The `getEnvVar` function checks for environment variables in the following order:

1. **Server-side**: `process.env[key]` (Node.js environment)
2. **Client-side**: `window.__KEY__` (Global window variables)
3. **Client-side**: `<meta name="KEY" content="value">` (Meta tags)

## Usage

```typescript
import { getEnvVar } from './utils/env';

// Get API key from any available source
const apiKey = getEnvVar('VOCODER_API_KEY');
```

## Environment Setup Examples

### Server-Side (Node.js)
```bash
# .env file
VOCODER_API_KEY=your-api-key-here
```

### Client-Side (Browser)
```html
<!-- Meta tag approach -->
<meta name="VOCODER_API_KEY" content="your-api-key-here">

<!-- Or global window variable -->
<script>
  window.__VOCODER_API_KEY__ = 'your-api-key-here';
</script>
```

## Benefits

- ✅ **No Node.js types required**: Works without `@types/node`
- ✅ **Isomorphic**: Same code works on server and client
- ✅ **Flexible**: Multiple ways to provide environment variables
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Fallback chain**: Graceful degradation if variables aren't found 