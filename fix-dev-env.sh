#!/bin/bash

echo "🔧 Fixing dev environment..."

# Go to dev-env directory
cd examples/dev-env

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Check if Next.js is installed
if ! pnpm list next > /dev/null 2>&1; then
    echo "⚠️  Next.js not found, installing..."
    pnpm add next@^14.0.0
fi

# Check if React is installed
if ! pnpm list react > /dev/null 2>&1; then
    echo "⚠️  React not found, installing..."
    pnpm add react@^18.0.0 react-dom@^18.0.0
fi

echo "✅ Dev environment fixed!"
echo ""
echo "🎯 Try running:"
echo "pnpm dev" 