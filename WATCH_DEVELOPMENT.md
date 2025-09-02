# Watch Development Mode

This document explains how to use the automatic watch mode for developing your vocoder SDK packages with real-time rebuilding.

## 🚀 Quick Start

### Option 1: Watch All Packages (Recommended)

From the `vocoder-sdk` directory:

```bash
pnpm dev:watch
```

This starts a sophisticated watch process that monitors all packages and provides real-time feedback.

### Option 2: Watch Individual Packages

```bash
# Watch types package
pnpm watch:types

# Watch React package  
pnpm watch:react

# Watch CLI package
pnpm watch:cli

# Watch all packages in parallel
pnpm watch:all
```

### Option 3: Consumer App with Auto-SDK Rebuilding

From the `vocoder-consumer` directory:

```bash
pnpm dev:with-sdk
```

This starts both the Next.js development server AND all SDK watch processes, so you get:
- ✅ Next.js dev server running
- ✅ All SDK packages automatically rebuilding on changes
- ✅ Real-time updates in your consumer app

## 🔄 How It Works

1. **TypeScript Watch Mode**: Each package runs `tsc --watch` to monitor source files
2. **Automatic Rebuilding**: When you save a file, TypeScript automatically rebuilds the package
3. **Immediate Updates**: Your consumer app gets the new code immediately
4. **Real-time Feedback**: Colored console output shows what's happening in each package

## 📱 Development Workflow

### 1. Start Watch Mode
```bash
# In vocoder-sdk directory
pnpm dev:watch
```

### 2. Start Consumer App (in another terminal)
```bash
# In vocoder-consumer directory  
pnpm dev
```

### 3. Make Changes
Edit any file in your SDK packages:
- `packages/types/src/index.ts`
- `packages/react/src/Translation.tsx`
- `packages/cli/src/index.ts`

### 4. See Changes Immediately
- SDK packages rebuild automatically
- Consumer app gets updates instantly
- No manual rebuilding needed!

## 🎯 Use Cases

- **Rapid Iteration**: Test changes immediately without manual rebuilds
- **End-to-End Testing**: See how SDK changes affect your consumer app in real-time
- **Debugging**: Quickly iterate on fixes and see results
- **Development**: Build new features with instant feedback

## 🛠️ Troubleshooting

### Watch Process Crashes
The watch script automatically restarts crashed processes after 2 seconds.

### TypeScript Errors
Check the console output for compilation errors. Fix them and the watch process will continue.

### Port Conflicts
If you get port conflicts, stop all processes with `Ctrl+C` and restart.

### File Permissions
Make sure the watch scripts are executable:
```bash
chmod +x scripts/dev-watch.js
chmod +x scripts/dev-with-sdk.js
```

## 🔧 Configuration

### Adding New Packages
To add a new package to the watch system:

1. Add it to the `packages` array in `scripts/dev-watch.js`
2. Add a `watch` script to the package's `package.json`
3. Update the root `package.json` scripts if needed

### Customizing Watch Behavior
You can modify the watch scripts to:
- Change rebuild delays
- Add custom file filters
- Integrate with other build tools
- Add notifications

## 💡 Tips

- **Keep it running**: Leave the watch process running while developing
- **Monitor output**: Watch the console for build status and errors
- **Use multiple terminals**: Run watch in one terminal, consumer app in another
- **Save frequently**: The more you save, the more you'll see the automatic rebuilding in action

## 🎉 Benefits

- **10x faster development**: No more manual rebuilding
- **Instant feedback**: See changes immediately
- **Better debugging**: Test fixes quickly
- **Improved workflow**: Focus on coding, not building 