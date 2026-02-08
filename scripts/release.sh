#!/bin/bash
set -e

# Usage: ./scripts/release.sh [patch|minor|major]
BUMP_TYPE=${1:-patch}

cd "$(dirname "$0")/.."

# Get current and new version
CURRENT_VERSION=$(node -p "require('./package.json').version")
npm version $BUMP_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")

# Update server.json versions
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" server.json

# Commit, tag, push
git add package.json package-lock.json server.json
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push && git push --tags

# Create GitHub release (triggers publish workflow)
gh release create "v$NEW_VERSION" --generate-notes

echo "Released v$NEW_VERSION"
