#!/bin/bash
set -e

echo "🚀 Starting PinPoint Codespace setup..."

# Install Supabase CLI
echo "📦 Installing Supabase CLI..."
curl -fsSL https://supabase.com/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"

# Install Claude Code CLI
echo "📦 Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Check if .env.local exists, if not create from example
if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Remember to update .env.local with your actual credentials!"
  else
    echo "⚠️  No .env.example found. You'll need to create .env.local manually."
  fi
fi

# Start Supabase local development
echo "🐳 Starting Supabase local development environment..."
if command -v supabase &> /dev/null; then
  supabase start
  echo ""
  echo "✅ Supabase is running!"
  echo "   API URL: http://localhost:54321"
  echo "   Studio URL: http://localhost:54323"
  echo ""
else
  echo "⚠️  Supabase CLI not found in PATH. You may need to restart the terminal."
fi

echo "✅ Codespace setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Authenticate Claude Code: claude auth login"
echo "   2. Update .env.local with your Supabase credentials"
echo "   3. Run 'npm run dev' to start the development server"
echo ""
