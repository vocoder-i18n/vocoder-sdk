# Troubleshooting Guide

## Common Build Errors

### 1. JSX Not Set Error
```
error TS6142: Module './TranslationProvider' was resolved to '...', but '--jsx' is not set.
```

**Solution:**
```bash
# Run the build script
./build.sh

# Or manually build with JSX flag
cd packages/react
npx tsc --outDir dist src/index.ts --jsx react-jsx
```

### 2. Module Resolution Error
```
error TS2306: File '...@vocoder/types/dist/index.d.ts' is not a module.
```

**Solution:**
```bash
# Build types package first
cd packages/types
npx tsc --outDir dist src/index.ts
npx tsc --declaration --emitDeclarationOnly --outDir dist src/index.ts

# Then build react package
cd ../react
npx tsc --outDir dist src/index.ts --jsx react-jsx
```

### 3. Development Environment Issues

**If you see TypeScript errors in examples/dev-env:**

1. **Build packages first:**
   ```bash
   ./build.sh
   ```

2. **Install dependencies:**
   ```bash
   cd examples/dev-env
   pnpm install
   ```

3. **Start development server:**
   ```bash
   pnpm dev
   ```

## Build Order

Always build packages in this order:

1. **@vocoder/types** (dependencies)
2. **@vocoder/react** (uses types)
3. **@vocoder/cli** (uses types)
4. **@vocoder/kit** (uses types)

## Quick Fix Commands

```bash
# Clean and rebuild everything
find . -name "dist" -type d -exec rm -rf {} +
./build.sh

# Or use the setup script for dev environment
cd examples/dev-env
./setup.sh
```

## TypeScript Configuration

The main issues are usually:

1. **JSX not configured** - Fixed by adding `--jsx react-jsx` to build commands
2. **Module resolution** - Fixed by building types package first
3. **Path mapping** - Fixed by updating tsconfig.json paths

## Development Environment Setup

```bash
# 1. Build all packages
./build.sh

# 2. Set up dev environment
cd examples/dev-env
./setup.sh

# 3. Start testing
pnpm dev
```

## Common Issues

### **"Cannot find module '@vocoder/react'"**
- Make sure packages are built: `./build.sh`
- Check workspace dependencies in package.json
- Verify pnpm workspace configuration

### **"JSX not set"**
- Use the updated build scripts with `--jsx react-jsx`
- Or run `./build.sh` which handles this automatically

### **"Module not found"**
- Build types package first
- Check that dist/index.d.ts exists
- Verify package.json main/types fields

## Verification Steps

After building, verify:

1. **Types package:**
   ```bash
   ls packages/types/dist/
   # Should show: index.d.ts, index.js
   ```

2. **React package:**
   ```bash
   ls packages/react/dist/
   # Should show: index.d.ts, index.js
   ```

3. **Dev environment:**
   ```bash
   cd examples/dev-env
   pnpm dev
   # Should start without errors
   ```

## Still Having Issues?

1. **Clean everything:**
   ```bash
   find . -name "dist" -type d -exec rm -rf {} +
   find . -name "node_modules" -type d -exec rm -rf {} +
   pnpm install
   ./build.sh
   ```

2. **Check TypeScript version:**
   ```bash
   npx tsc --version
   # Should be 5.0.0 or higher
   ```

3. **Verify workspace setup:**
   ```bash
   cat pnpm-workspace.yaml
   # Should include all packages
   ``` 