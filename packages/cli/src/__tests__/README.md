# CLI Test Suite

This directory contains comprehensive tests for the Vocoder CLI, with a focus on **incremental translation workflows**.

## Test Structure

```
__tests__/
├── incremental.test.ts           # Unit tests (mocked API)
├── integration/
│   └── incremental-workflow.test.ts  # Integration tests (real API)
└── README.md                     # This file
```

## Running Tests

### All Tests
```bash
pnpm test
```

### Unit Tests Only (Fast, No API Required)
```bash
pnpm test:unit
```

### Integration Tests Only (Requires API Running)
```bash
pnpm test:integration
```

### Integration Tests Are Opt-In
```bash
pnpm test           # runs unit tests only
pnpm test:integration
```

### Watch Mode (for Development)
```bash
pnpm test:watch
```

## Test Scenarios Covered

### 1. **New String Detection** ✅
Tests that the API correctly identifies which strings are new vs existing:
- All new strings (first run)
- All existing strings (second run)
- Mix of new and existing strings

### 2. **Performance Expectations** ✅
Verifies that incremental updates are **significantly faster** than full translations:
- 100 strings initial: ~30 seconds
- 1 new string added: <1 second
- **Speedup: >30x faster** for incremental updates

### 3. **String Removal** ✅
Tests that removed strings are handled correctly:
- Removed strings don't appear in translation files
- Existing strings remain intact
- No unnecessary translation work

### 4. **String Modification** ✅
Verifies that modified strings are treated as new:
- Old translation is removed
- New translation is created
- Both operations in one batch

### 5. **Branch Isolation** ✅
Tests branch-specific translation behavior:
- Same strings on different branches are independent
- Main branch translations serve as fallback
- Feature branches can override main translations

### 6. **Error Handling** ✅
Tests graceful error handling:
- API errors (404, 500, etc.)
- Network errors
- Timeout handling

## Integration Test Requirements

Integration tests (`incremental-workflow.test.ts`) require:

1. **vocoder-app running locally**:
   ```bash
   cd vocoder-app
   pnpm run dev
   ```

2. **Environment variables**:
   ```bash
   export VOCODER_API_URL="http://localhost:3000"
   ```

3. **Test project** set up in the database with:
   - Valid project ID
   - Target locales configured (es, fr)
   - DeepL API key configured

## Key Test Metrics

### Performance Targets
- **Initial translation (100 strings)**: <30 seconds
- **Incremental (1 new string)**: <1 second
- **No new strings**: <500ms (immediate return)

### Accuracy Targets
- **New string detection**: 100% accurate
- **Branch isolation**: Perfect separation
- **Main branch fallback**: Always works

## Test Data Cleanup

Integration tests create data in the test database. Currently:
- ✅ Tests use unique branch names (`test-incremental-{timestamp}`)
- ⚠️ Manual cleanup required (no DELETE endpoint yet)
- 🔮 Future: Add cleanup endpoint for test data

## Adding New Tests

When adding new test scenarios:

1. **Unit tests** (fast, mocked):
   - Add to `incremental.test.ts`
   - Mock the API responses
   - Focus on logic and edge cases

2. **Integration tests** (slow, real API):
   - Add to `integration/incremental-workflow.test.ts`
   - Test actual API behavior
   - Verify end-to-end workflows

## Debugging Failed Tests

### Unit Test Failures
Check:
- Mock setup is correct
- Expected values match actual API contract
- TypeScript types are up to date

### Integration Test Failures
Check:
- vocoder-app is running (`http://localhost:3000`)
- Database has test project configured
- DeepL API key is valid
- Network connectivity

Enable verbose logging:
```bash
DEBUG=vocoder:* pnpm test:integration
```

## Coverage

Run coverage reports:
```bash
pnpm test --coverage
```

Target coverage:
- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## Related Documentation

- [../../README.md](../../README.md) - CLI package overview
- [../commands/sync.ts](../commands/sync.ts) - Main command implementation
- [../utils/api.ts](../utils/api.ts) - API client
- [/vocoder-app/app/api/translate/route.ts](/vocoder-app/app/api/translate/route.ts) - API endpoint
