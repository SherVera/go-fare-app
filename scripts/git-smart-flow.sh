#!/usr/bin/env bash
# Repo-agnostic: analyze local git changes → propose branch + Conventional Commit
# message → confirm → checkout -b → add → commit → (optional) push.
#
# Works in any git repo. Heuristics use changed paths (no project-specific hardcoding).
#
# Usage (from a repo that wires the script):
#   npm run git:smart
#   npm run git:smart -- --no-push
#   npm run git:smart -- --yes
#   npm run git:smart -- --dry-run
#
# Or directly:
#   bash path/to/git-smart-flow.sh [--no-push] [--yes] [--dry-run]
set -euo pipefail

NO_PUSH=0
ASSUME_YES=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --no-push) NO_PUSH=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Usage: git-smart-flow.sh [--no-push] [--yes] [--dry-run]"
      echo ""
      echo "Analyzes the current git working tree, proposes a branch name and"
      echo "Conventional Commits subject, then (after confirm) creates the branch,"
      echo "stages all changes, commits, and pushes."
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository."
  exit 1
fi

CHANGED_FILES="$(git status --porcelain | awk '{print $NF}')"
if [[ -z "${CHANGED_FILES}" ]]; then
  echo "No local changes to analyze."
  exit 0
fi

echo "=== Repo ==="
git rev-parse --show-toplevel
echo ""
echo "=== Changed files ==="
git status --short
echo ""
echo "=== Diff stat ==="
git diff --stat HEAD 2>/dev/null || true
echo ""

DIFF_TEXT="$(git diff HEAD 2>/dev/null || true)"
STATUS_TEXT="$(git status --porcelain)"
COMBINED="${DIFF_TEXT}${STATUS_TEXT}${CHANGED_FILES}"

# --- Type ---
TYPE="chore"
if echo "$COMBINED" | grep -qiE 'fix\(|\bbug\b|error TS|noExplicitAny|type error|\bcrash\b|\bbroken\b|\bhotfix\b'; then
  TYPE="fix"
elif echo "$COMBINED" | grep -qiE '(^|/| )(test|spec|__tests__|e2e)/|\.test\.|\.spec\.|describe\(|it\(|test\('; then
  TYPE="test"
elif echo "$CHANGED_FILES" | grep -qiE '\.md$|(^|/)docs(/|$)|README|CHANGELOG'; then
  TYPE="docs"
elif echo "$COMBINED" | grep -qiE '\brefactor\b|\brename\b|\bextract\b|\bsimplify\b'; then
  TYPE="refactor"
elif echo "$COMBINED" | grep -qiE '\bfeat\b|\bfeature\b|\badd\b|\bnew\b|\bcreate\b|\bimplement\b'; then
  TYPE="feature"
elif echo "$CHANGED_FILES" | grep -qiE 'package\.json|package-lock|pnpm-lock|yarn\.lock|biome|eslint|tsconfig|Dockerfile|docker-compose|\.yml$|\.yaml$|scripts/'; then
  TYPE="chore"
fi

COMMIT_TYPE="$TYPE"
if [[ "$TYPE" == "feature" ]]; then
  COMMIT_TYPE="feat"
fi

# --- Scope: first meaningful path segment (skip src/app/lib/common noise) ---
SCOPE=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  # normalize
  f="${f#./}"
  # take first 1–2 useful segments
  IFS='/' read -r a b c <<<"$f"
  candidate=""
  case "$a" in
    src|app|lib|packages|apps|services|"")
      if [[ -n "${b:-}" ]]; then
        case "$b" in
          components|hooks|utils|common|core|shared|internal)
            candidate="${c:-$b}"
            ;;
          *)
            candidate="$b"
            ;;
        esac
      fi
      ;;
    scripts|.claude|.github|.cursor)
      candidate="tooling"
      ;;
    interfaces|types|typings)
      candidate="types"
      ;;
    *)
      candidate="$a"
      ;;
  esac
  # strip extension / noise
  candidate="$(echo "$candidate" | sed -E 's/\.[^.]+$//' | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g')"
  if [[ -n "$candidate" && "$candidate" != "index" && "$candidate" != "page" && "$candidate" != "main" ]]; then
    SCOPE="$candidate"
    break
  fi
done <<<"$CHANGED_FILES"

# --- Slug ---
SLUG_SOURCE="$SCOPE"
if [[ -z "$SLUG_SOURCE" ]]; then
  FIRST_FILE="$(echo "$CHANGED_FILES" | head -1)"
  SLUG_SOURCE="$(basename "$FIRST_FILE" | sed -E 's/\.[^.]+$//' | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g')"
fi
[[ -z "$SLUG_SOURCE" ]] && SLUG_SOURCE="update"

case "$TYPE" in
  fix)
    if echo "$COMBINED" | grep -qiE '\bany\b|typescript|typecheck|\btsc\b'; then
      SLUG="${SCOPE:-types}-types"
    else
      SLUG="${SLUG_SOURCE}-fix"
    fi
    ;;
  feature) SLUG="${SLUG_SOURCE}" ;;
  docs) SLUG="${SLUG_SOURCE}-docs" ;;
  test) SLUG="${SLUG_SOURCE}-tests" ;;
  refactor) SLUG="${SLUG_SOURCE}-refactor" ;;
  *) SLUG="${SLUG_SOURCE}" ;;
esac

SLUG="$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g; s/-+/-/g' | cut -c1-40)"
[[ -z "$SLUG" ]] && SLUG="update"

BRANCH="${TYPE}/${SLUG}"

# --- Subject ---
DETAIL="$(echo "$SLUG" | tr '-' ' ')"
if [[ "$COMMIT_TYPE" == "fix" ]] && echo "$COMBINED" | grep -qiE '\bany\b'; then
  DETAIL="remove any types"
elif [[ "$COMMIT_TYPE" == "chore" ]] && echo "$CHANGED_FILES" | grep -qiE 'git-smart|git-happy|scripts/'; then
  DETAIL="add git smart flow scripts"
fi

if [[ -n "$SCOPE" ]]; then
  SUBJECT="${COMMIT_TYPE}(${SCOPE}): ${DETAIL}"
else
  SUBJECT="${COMMIT_TYPE}: ${DETAIL}"
fi

# Prefer imperative verbs for feat/docs/test
case "$COMMIT_TYPE" in
  feat)
    SUBJECT="$(echo "$SUBJECT" | sed -E "s/^feat(\\([^)]+\\)): /feat\\1: add /; s/^feat: /feat: add /")"
    SUBJECT="$(echo "$SUBJECT" | sed -E 's/: add add /: add /')"
    ;;
  docs)
    SUBJECT="$(echo "$SUBJECT" | sed -E "s/^docs(\\([^)]+\\)): /docs\\1: document /; s/^docs: /docs: document /")"
    SUBJECT="$(echo "$SUBJECT" | sed -E 's/: document document /: document /')"
    ;;
  test)
    SUBJECT="$(echo "$SUBJECT" | sed -E "s/^test(\\([^)]+\\)): /test\\1: add tests for /; s/^test: /test: add tests for /")"
    ;;
  fix)
    # "fix(scope): foo fix" → "fix(scope): foo"
    SUBJECT="$(echo "$SUBJECT" | sed -E 's/ fix$//')"
    ;;
esac

if [[ ${#SUBJECT} -gt 72 ]]; then
  SUBJECT="${SUBJECT:0:69}..."
fi

echo "=== Proposal ==="
echo "  Branch:  ${BRANCH}"
echo "  Message: ${SUBJECT}"
echo ""

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run — nothing created."
  exit 0
fi

if [[ "$ASSUME_YES" -ne 1 ]]; then
  PUSH_HINT=""
  if [[ "$NO_PUSH" -eq 0 ]]; then
    PUSH_HINT=" + push"
  fi
  read -r -p "Accept and run (branch + commit${PUSH_HINT})? [y/N] " REPLY
  case "$REPLY" in
    y|Y|yes|YES) ;;
    *)
      echo "Aborted. Manual equivalent:"
      echo "  git checkout -b ${BRANCH}"
      echo "  git add -A && git commit -m \"${SUBJECT}\""
      if [[ "$NO_PUSH" -eq 0 ]]; then
        echo "  git push -u origin ${BRANCH}"
      fi
      exit 0
      ;;
  esac
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "Branch ${BRANCH} already exists locally."
  exit 1
fi

if git ls-remote --heads origin "${BRANCH}" 2>/dev/null | grep -q .; then
  echo "Branch ${BRANCH} already exists on origin."
  exit 1
fi

if echo "$CHANGED_FILES" | grep -qiE '(^|/)\.env($|\.)|firebase-adminsdk|GoogleService-Info|google-services\.json|credentials\.json|id_rsa|\.pem$|\.p12$'; then
  echo "Refusing to auto-commit files that look like secrets:"
  echo "$CHANGED_FILES" | grep -iE '(^|/)\.env($|\.)|firebase-adminsdk|GoogleService-Info|google-services\.json|credentials\.json|id_rsa|\.pem$|\.p12$' || true
  echo "Remove them or commit manually after review."
  exit 1
fi

git checkout -b "${BRANCH}"
git add -A

if git diff --cached --quiet; then
  echo "Nothing staged after git add -A. Branch ${BRANCH} created only."
  exit 0
fi

git commit -m "${SUBJECT}"

if [[ "$NO_PUSH" -eq 0 ]]; then
  git push -u origin "${BRANCH}"
  echo "Done: ${BRANCH} pushed to origin."
else
  echo "Done: committed on ${BRANCH} (not pushed)."
fi
