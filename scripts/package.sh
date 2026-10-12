#!/usr/bin/env bash
# Builds dist/softtab-<version>.zip for the Chrome Web Store or a GitHub release.
# Leaves out personal defaults, docs and tooling.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="$PWD/dist/softtab-$version.zip"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -R manifest.json newtab.html styles.css app.js theme-init.js gtfs.js stations.js brand-icons.js fonts icons "$stage"/
# The packaged page has no personal defaults to load.
grep -v 'defaults.local.js' newtab.html > "$stage/newtab.html"
mkdir -p dist
rm -f "$out"
(cd "$stage" && zip -qr "$out" . -x '*.DS_Store')
echo "dist/softtab-$version.zip"
