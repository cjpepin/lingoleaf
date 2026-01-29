#!/bin/bash

# LingoLeaf Development Script
# Runs the custom development client

set -e

echo "🍃 LingoLeaf Development Client"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found"
  echo "Please create a .env file with your Supabase credentials"
  exit 1
fi

# Run TypeScript type checking
echo "🔍 Running type checks..."
if ! npm run type-check; then
  echo ""
  echo "❌ TypeScript errors found!"
  echo "Fix the errors above before starting the app."
  exit 1
fi
echo "✅ Type checks passed"
echo ""

# Parse command line arguments
PLATFORM=${1:-ios}
CLEAN=${2:-false}

case $PLATFORM in
  ios)
    echo "📱 Building iOS..."
    if [ "$CLEAN" = "clean" ]; then
      echo "🧹 Cleaning build artifacts..."
      rm -rf ios/build
      rm -rf ~/Library/Developer/Xcode/DerivedData/lingoleaf-*
      cd ios && xcodebuild clean -workspace lingoleaf.xcworkspace -scheme lingoleaf && cd ..
    fi
    export LANG=en_US.UTF-8
    npx expo run:ios
    ;;
  android)
    echo "🤖 Building Android..."
    if [ "$CLEAN" = "clean" ]; then
      echo "🧹 Cleaning build artifacts..."
      cd android && ./gradlew clean && cd ..
    fi
    npx expo run:android
    ;;
  start)
    echo "🚀 Starting Metro bundler (dev client mode)..."
    npx expo start --dev-client
    ;;
  prebuild)
    echo "🔧 Regenerating native projects..."
    npx expo prebuild --clean
    ;;
  pods)
    echo "📦 Installing iOS dependencies..."
    cd ios && export LANG=en_US.UTF-8 && pod install && cd ..
    ;;
  *)
    echo "Usage: ./dev.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  ios          Build and run iOS app (default)"
    echo "  android      Build and run Android app"
    echo "  start        Start Metro bundler only (after initial build)"
    echo "  prebuild     Regenerate native projects"
    echo "  pods         Install iOS CocoaPods dependencies"
    echo ""
    echo "Options:"
    echo "  clean        Clean build artifacts before building"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh ios           # Build and run iOS"
    echo "  ./dev.sh ios clean     # Clean build and run iOS"
    echo "  ./dev.sh android       # Build and run Android"
    echo "  ./dev.sh start         # Start Metro only (fast)"
    exit 1
    ;;
esac

