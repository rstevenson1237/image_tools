#!/usr/bin/env bash
# Publish a built artgen distribution (packages/artgen-dist/out) to the `artgen-dist` branch, and optionally tag the
# published commit, so game repos can install a fixed release:
#   npx -y github:rstevenson1237/image_tools#artgen-dist            latest build from main
#   npx -y github:rstevenson1237/image_tools#artgen-dist-v0.9.0     a release
#
# Usage: scripts/artgen-publish-dist.sh <out dir> [<tag>]
# Env:   REMOTE (default origin), BRANCH (default artgen-dist), GIT_AUTHOR (default github-actions[bot])
# The branch holds exactly the build: each publish clears it and copies the new build in, as one commit on top of
# the previous head (no history rewrite). When the build equals the branch head, nothing is committed and the tag
# goes on the existing head. An existing tag is never moved.
set -euo pipefail
out=${1:?usage: artgen-publish-dist.sh <out dir> [<tag>]}
tag=${2:-}
remote=${REMOTE:-origin}
branch=${BRANCH:-artgen-dist}
out=$(cd "$out" && pwd)
version=$(cat "$out/dist/tools/artgen/VERSION")
sha=$(git rev-parse --short=7 HEAD)

if [ -n "$tag" ] && git ls-remote --exit-code --tags "$remote" "refs/tags/$tag" >/dev/null; then
  echo "tag $tag already exists on $remote — releases are immutable; bump the version" >&2
  exit 1
fi

dir=$(mktemp -d)
trap 'git worktree remove --force "$dir" 2>/dev/null || true' EXIT
git config user.name >/dev/null || git config user.name "github-actions[bot]"
git config user.email >/dev/null || git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
if git ls-remote --exit-code --heads "$remote" "$branch" >/dev/null; then
  git fetch -q --depth=1 "$remote" "$branch"
  git worktree add -q -B "$branch" "$dir" FETCH_HEAD
else
  git worktree add -q --detach "$dir"
  git -C "$dir" checkout -q --orphan "$branch"
fi
git -C "$dir" rm -rq --ignore-unmatch .
cp -a "$out/." "$dir/"
git -C "$dir" add -A
if git -C "$dir" diff --cached --quiet; then
  echo "artgen-dist $version: no changes"
else
  git -C "$dir" commit -qm "artgen-dist $version from $sha"
  git -C "$dir" push -q "$remote" "$branch"
  echo "published artgen-dist $version"
fi
if [ -n "$tag" ]; then
  if [ "$tag" != "artgen-dist-v$version" ]; then echo "tag $tag does not match the build's version $version" >&2; exit 1; fi
  git -C "$dir" tag -a "$tag" -m "artgen-dist $version (from $sha)"
  git -C "$dir" push -q "$remote" "refs/tags/$tag"
  echo "tagged $tag"
fi
