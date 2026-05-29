#!/usr/bin/env bash
# Happy path: new branch (convention) + stage all + commit + push.
# Usage: npm run git:flow -- <type> <kebab-slug> "<conventional commit subject>"
set -euo pipefail

usage() {
  echo "Usage: npm run git:flow -- <type> <kebab-slug> \"<conventional commit subject>\""
  echo ""
  echo "  type       one of: feature, fix, chore, docs, refactor, test, perf, build, ci"
  echo "  kebab-slug short description, e.g. fcm-token-handler"
  echo "  subject    full first line of commit, e.g. \"feat(push): add FCM token refresh\""
  echo ""
  echo "Example:"
  echo "  npm run git:flow -- feature fcm-token-handler \"feat(push): add FCM token refresh\""
  echo ""
  echo "Creates branch <type>/<kebab-slug> from your current HEAD, git add -A, commit, push -u."
  exit 1
}

if [[ $# -lt 3 ]]; then
  usage
fi

TYPE="$1"
SLUG="$2"
shift 2
MSG="$*"

ALLOWED='feature fix chore docs refactor test perf build ci'
if ! printf '%s\n' $ALLOWED | grep -qx "$TYPE"; then
  echo "Invalid type: ${TYPE}"
  echo "Use one of: ${ALLOWED}"
  exit 1
fi

if [[ ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Invalid kebab-slug: ${SLUG}"
  echo "Use lowercase letters, digits, and single hyphens between words (e.g. auth-email-link)."
  exit 1
fi

if [[ -z "${MSG// }" ]]; then
  echo "Commit message is empty."
  exit 1
fi

BRANCH="${TYPE}/${SLUG}"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "Branch ${BRANCH} already exists locally."
  exit 1
fi

if git ls-remote --heads origin "${BRANCH}" 2>/dev/null | grep -q .; then
  echo "Branch ${BRANCH} already exists on origin."
  exit 1
fi

git checkout -b "${BRANCH}"
git add -A

if git diff --cached --quiet; then
  echo "Nothing staged (working tree had no changes to add). Created branch ${BRANCH} only."
  echo "Make edits, then: git add -A && git commit -m \"...\" && git push -u origin ${BRANCH}"
  exit 0
fi

git commit -m "${MSG}"
git push -u origin "${BRANCH}"
echo "Done: branch ${BRANCH} pushed to origin."
