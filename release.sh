#!/usr/bin/env bash
#
# Builds the storefront, checks the result, and publishes it to GitHub.
#
# Why this exists
# ---------------
# Adding a product writes to the database. The API serves that row immediately,
# so the product is live for shoppers — but the files Google and WhatsApp read
# (`dist/sitemap.xml` and `dist/_pages/.../*.html`) are a snapshot taken at
# build time. Nothing regenerates them when the admin panel saves, because the
# host runs no Node and publishes `dist/` as static files. The bridge from
# "in the database" to "in the sitemap and in a crawler-readable page" is this
# script: build here, commit the result, and let the server pull it.
#
# The server deploy is deliberately a separate hop. This script cannot reach
# the document root; `deploy_chamma.sh` does that over SSH. Pass --deploy with
# DEPLOY_HOST set to run both in one command.
#
# Run:
#   ./release.sh "Add Khamrah 100ml"                  build, verify, commit, push
#   ./release.sh --verify                             check the dist/ already built
#   ./release.sh --dry-run "Add Khamrah 100ml"        print the plan, change nothing
#   DEPLOY_HOST=chamma ./release.sh --deploy "Add ..."  also run the server deploy
#
# The message is what the release was for; it lands in the history beside the
# dist/ it produced, so a bad bundle can be traced back to the change that
# shipped it.

set -euo pipefail

cd "$(dirname "$0")"

MSG="Rebuild storefront bundle"
DRY_RUN=0
VERIFY_ONLY=0
DEPLOY=0

usage() {
  cat <<'EOF'
Usage: ./release.sh [options] ["commit message"]

  (no options)   npm run build, verify dist/, commit, push to origin/main
  --verify       only check the dist/ that is already on disk
  --dry-run      print what would run; build nothing, commit nothing
  --deploy       after pushing, run deploy_chamma.sh on $DEPLOY_HOST over SSH
  -h, --help     this text

The commit message defaults to "Rebuild storefront bundle".
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --verify) VERIFY_ONLY=1; shift ;;
    --deploy) DEPLOY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) MSG="$1"; shift ;;
  esac
done

# Stops the run at the first failed step. Unlike deploy_chamma.sh this is
# always local, so the trap can promise that a failed build never reaches a
# commit: the commit is the last thing that runs before the push.
trap 'echo ""; echo "FAILED at line $LINENO. The release stopped there." >&2' ERR

fail() {
  echo "release: $*" >&2
  exit 1
}

# Echoes a command, then runs it unless this is a dry run.
run() {
  printf '  %s\n' "$*"
  [[ $DRY_RUN -eq 1 ]] || "$@"
}

# A page without a canonical, a title or JSON-LD is the exact regression this
# whole build step exists to prevent, and it is invisible from a file count
# alone. The checks are cheap: 333 files, a few greps.
verify() {
  local pages urls empty_no_title empty_no_canonical empty_no_jsonld empty_root

  [[ -f dist/index.html ]] || fail "dist/index.html is missing; run npm run build first"
  [[ -f dist/sitemap.xml ]] || fail "dist/sitemap.xml is missing; run npm run build first"
  [[ -f dist/.htaccess ]] || fail "dist/.htaccess is missing; the SPA would 404 on refresh"
  [[ -d dist/_pages ]] || fail "dist/_pages is missing; nothing was prerendered"

  pages=$(find dist/_pages -name '*.html' | wc -l | tr -d ' ')
  urls=$(grep -o '<loc>' dist/sitemap.xml | wc -l | tr -d ' ' || true)

  [[ "$pages" -gt 0 ]] || fail "no page was prerendered"
  [[ "$pages" -eq "$urls" ]] ||
    fail "sitemap lists $urls URLs but $pages pages were rendered; a build step is out of sync"

  # `grep -rL` exits 1 when every file matches (nothing to list), which under
  # `set -o pipefail` would look like a failed check. `|| true` keeps the count
  # — which is the actual answer — without tripping the trap.
  empty_root=$(grep -rl '<div id="root"></div>' dist/_pages | wc -l | tr -d ' ' || true)
  [[ "$empty_root" -eq 0 ]] || fail "$empty_root prerendered pages still have an empty #root"

  empty_no_title=$(grep -rL '<title>' dist/_pages | wc -l | tr -d ' ' || true)
  [[ "$empty_no_title" -eq 0 ]] || fail "$empty_no_title prerendered pages have no <title>"

  empty_no_canonical=$(grep -rL 'rel="canonical"' dist/_pages | wc -l | tr -d ' ' || true)
  [[ "$empty_no_canonical" -eq 0 ]] ||
    fail "$empty_no_canonical prerendered pages have no canonical"

  empty_no_jsonld=$(grep -rL 'application/ld+json' dist/_pages | wc -l | tr -d ' ' || true)
  [[ "$empty_no_jsonld" -eq 0 ]] || fail "$empty_no_jsonld prerendered pages have no JSON-LD"

  echo "  $pages pages match $urls sitemap URLs; every page has content, a title, a canonical and JSON-LD"
}

for cmd in node npm git; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is not installed"
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not inside a git repository"

branch=$(git branch --show-current)
[[ "$branch" == "main" ]] || fail "on branch '$branch'; releases are cut from main"
git remote get-url origin >/dev/null 2>&1 || fail "the repository has no origin remote"

echo "==> Release"
echo "    branch:  $branch"
echo "    message: $MSG"

if [[ $VERIFY_ONLY -eq 1 ]]; then
  echo "==> Verify dist/"
  verify
  echo "OK"
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo ""
  echo "Would run:"
  echo "  npm run build"
  echo "  (verify dist/_pages against dist/sitemap.xml)"
  echo "  git add -A"
  echo "  git commit -m \"$MSG\"   (only if the build changed something)"
  echo "  git push origin $branch"
  if [[ $DEPLOY -eq 1 ]]; then
    echo "  ssh \${DEPLOY_HOST} 'cd ~/chama-perfumes && ./deploy_chamma.sh'"
  fi
  echo ""
  echo "Nothing was changed."
  exit 0
fi

echo "==> Build"
run npm run build

echo "==> Verify"
verify

# A release that produced no file change is not a failure — rebuilding twice
# on the same day can be byte-identical. It still pushes the previous commit
# if an earlier push failed, so this cannot leave the server one release behind
# with no way to tell.
echo "==> Publish"
run git fetch --quiet origin
run git add -A

if git diff --cached --quiet; then
  if [[ "$(git rev-list --count "origin/$branch..HEAD")" -eq 0 ]]; then
    echo "  Nothing to release: the build changed nothing and there is nothing unpushed."
    exit 0
  fi
  echo "  No new changes; pushing the commit(s) already waiting on $branch."
else
  run git commit -m "$MSG"
fi

run git push origin "$branch"

echo ""
echo "Released $(git rev-parse --short HEAD):"
git show --stat --oneline HEAD | tail -n 6

if [[ $DEPLOY -eq 1 ]]; then
  [[ -n "${DEPLOY_HOST:-}" ]] ||
    fail "--deploy needs DEPLOY_HOST, e.g. DEPLOY_HOST=chamma ./release.sh --deploy \"$MSG\""
  echo ""
  echo "==> Deploy"
  run ssh "$DEPLOY_HOST" 'cd ~/chama-perfumes && ./deploy_chamma.sh'
else
  echo ""
  echo "Publish it: ssh <server> 'cd ~/chama-perfumes && ./deploy_chamma.sh'"
fi
