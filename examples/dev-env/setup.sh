#!/bin/bash

echo "🚀 Setting up Vocoder SDK Development Environment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the examples/dev-env directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "🔧 Creating .env.local from template..."
    cp env.example .env.local
    echo "✅ Created .env.local - edit it with your test API key"
else
    echo "✅ .env.local already exists"
fi

# Build the packages
echo "🔨 Building packages..."
cd ..
pnpm build
cd examples/dev-env

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Edit .env.local with your test API key"
echo "2. Run: pnpm dev"
echo "3. Open: http://localhost:3000"
echo ""
echo "📖 See README.md for detailed testing instructions" 