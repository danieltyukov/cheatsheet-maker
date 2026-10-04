#!/bin/sh
# Checks that every place that carries the version agrees, and, given a tag,
# that the tag names that version.
#
#   scripts/check-version.sh [v1.0.0]
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
json_version() { sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$1" | head -n 1; }

cargo=$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$root/Cargo.toml" | head -n 1)
status=0
for file in app/package.json site/package.json app/src-tauri/tauri.conf.json; do
  version=$(json_version "$root/$file")
  if [ "$version" != "$cargo" ]; then
    echo "$file says $version but Cargo.toml says $cargo" >&2
    status=1
  fi
done

if [ $# -gt 0 ] && [ "${1#v}" != "$cargo" ]; then
  echo "tag $1 does not match version $cargo" >&2
  status=1
fi

[ $status -eq 0 ] && echo "version $cargo"
exit $status
