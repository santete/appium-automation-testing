#!/usr/bin/env bash
# M4 Task 10 — minimal branch protection cho solo dev workflow.
#
# Plan ref: docs/plans/M4-cicd.md Decision 7 (revised v1.1, 2026-04-28).
#
# Apply:
#   - Required status check: `verify` (job name của ci.yml workflow `CI`)
#   - Strict: branch up-to-date trước khi merge
#   - Force-push blocked
#   - Branch deletion blocked
#   - KHÔNG required reviews (solo dev: không có reviewer)
#   - KHÔNG required signed commits (overhead cho solo)
#   - Admin enforcement OFF (Phuc admin có thể override emergency fix)
#
# Idempotent: chạy nhiều lần OK — gh api PUT replace toàn bộ config.
#
# Prereq:
#   - gh CLI installed + authenticated (`gh auth status`)
#   - Repo admin access trên santete/appium-automation-testing
#
# Nếu gh CLI chưa cài → xem `docs/runbook-pr-merge-gate.md` §UI alternative.
#
# Usage:
#   ./scripts/setup-branch-protection.sh
#
# Verify after:
#   gh api repos/santete/appium-automation-testing/branches/main/protection

set -euo pipefail

REPO="${REPO:-santete/appium-automation-testing}"
BRANCH="${BRANCH:-main}"
REQUIRED_CHECK="${REQUIRED_CHECK:-verify}"

if ! command -v gh >/dev/null 2>&1; then
  echo "[FAIL] gh CLI không tìm thấy trên PATH."
  echo "  Install: https://cli.github.com/"
  echo "  Hoặc dùng UI alternative: docs/runbook-pr-merge-gate.md §branch-protection-ui"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "[FAIL] gh CLI chưa authenticated. Chạy: gh auth login"
  exit 1
fi

echo "[INFO] Apply branch protection: $REPO@$BRANCH (required check: $REQUIRED_CHECK)"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$REPO/branches/$BRANCH/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["$REQUIRED_CHECK"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF

echo ""
echo "[OK] Branch protection applied. Verify:"
echo "  gh api repos/$REPO/branches/$BRANCH/protection | jq '.'"
