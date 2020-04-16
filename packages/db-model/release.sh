#!/bin/bash

### Release management and changelog generation script. ###

set -e

changelog() {
  # NOTE: This requires github_changelog_generator to be installed.
  # https://github.com/skywinder/github-changelog-generator
  TAG_NAME=$1

  if [ -z "$TAG_NAME" ]; then
    TAG_NAME="Unreleased"
  fi

  echo "Generating changelog upto version: $TAG_NAME"
  github_changelog_generator \
    --no-verbose \
    --pr-label "**Changes**" \
    --bugs-label "**Bug Fixes**" \
    --issues-label "**Closed Issues**" \
    --issue-line-labels=ALL \
    --future-release="$TAG_NAME" \
    --release-branch=master \
    --exclude-labels=unnecessary,duplicate,question,invalid,wontfix
}

bump() {
  # Bump package version and generate changelog
  VERSION="${NEXT/v/}"
  PACKAGE_NAME=$(cat package.json | grep name | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
  TAG_NAME="${PACKAGE_NAME}@${VERSION}"

  echo "Bump version ${TAG_NAME}"

  # Update version in the following files
  sed -i "s/\(\"version\":\s*\"\)[^\"]*\(\"\)/\1${VERSION}\2/g" package.json

  # Generate change log
  changelog $TAG_NAME
  echo ""

  # Generate new build.
  yarn && yarn test && yarn build

  # Prepare to commit
  git add CHANGELOG.md package.json yarn.lock && \
    git commit -v --edit -m "Release ${TAG_NAME}" && \
    git tag "${TAG_NAME}" && \
    echo -e "\nRelease tagged $TAG_NAME"
  git push origin HEAD --tags
  yarn publish --new-version "${VERSION}" --no-git-tag-version
}

# Run command received from args.
$1
