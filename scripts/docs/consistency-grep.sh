#!/usr/bin/env bash
# Documentation consistency check for the Field & Ledger design.
#
# Runs the phrase list from
# docs/design_documentation/260914-wottle-new-design/DOCS_CONSISTENCY.md §10 over the living
# documentation and fails if any phrase is still present. Scope:
#   README.md, CLAUDE.md, docs/ and the active spec folders under specs/.
# Excluded:
#   docs/archive/                                  — history, kept verbatim
#   docs/design_documentation/                        — design bundles are inputs, not living docs (the
#                                                       Field & Ledger bundle defines this very list)
#   specs/<n>-*/ carrying SUPERSEDED.md, and shipped specs 001–043 — immutable records of what
#                                                     was built; retired UI specs carry SUPERSEDED.md
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Each entry is a literal phrase. `Inter` is matched as a whole word so that
# "Interaction"/"Internal" do not trip it.
PHRASES=(
  "Warm Editorial" "Fraunces" "JetBrains Mono" "letterpress" "ochre" "--p1" "--p2"
  "5+0" "5-minute" "chess clock" "Icelandic nouns" "eight directions" "diagonal"
  "hidden from opponent" "Move submitted" "wants a rematch!" "HUD card" "pip bar"
  "side panel" "word cloud" "match ring"
)
WORD_PHRASES=("Inter")

targets() {
  printf '%s\n' README.md CLAUDE.md
  find docs -type f \( -name '*.md' -o -name '*.html' -o -name '*.txt' \) \
    -not -path 'docs/archive/*' \
    -not -path 'docs/design_documentation/*'
  for dir in specs/*/; do
    dir="${dir%/}"
    num="${dir#specs/}"; num="${num%%-*}"
    [[ -f "$dir/SUPERSEDED.md" ]] && continue
    [[ "$num" =~ ^0[0-3][0-9]$|^04[0-3]$ ]] && continue
    find "$dir" -type f -name '*.md'
  done
}

# A line carrying this marker names a retired term in order to remove it — a task
# that says "delete --p1" is the opposite of drift — rather than using it to
# describe the product. It exempts its own line only. Added with spec 045, whose
# T029/T033 cannot name the tokens they delete without it.
EXEMPT_MARKER='<!-- retired-name -->'

# Prints every unexempted hit for one phrase in one file; returns 1 if there were any.
report_hits() { # file phrase mode(fixed|word)
  local file="$1" p="$2" mode="$3" hits
  if [[ "$mode" == word ]]; then
    hits="$(grep -nwF -- "$p" "$file" || true)"
  else
    hits="$(grep -nF -- "$p" "$file" || true)"
  fi
  [[ -n "$hits" ]] || return 0
  hits="$(printf '%s\n' "$hits" | grep -vF -- "$EXEMPT_MARKER" || true)"
  [[ -n "$hits" ]] || return 0
  printf '%s\n' "$hits" | sed "s#^#${file}:#; s#\$#    [${p}]#"
  return 1
}

status=0
while IFS= read -r file; do
  for p in "${PHRASES[@]}"; do
    report_hits "$file" "$p" fixed || status=1
  done
  for p in "${WORD_PHRASES[@]}"; do
    report_hits "$file" "$p" word || status=1
  done
done < <(targets)

if [[ $status -eq 0 ]]; then
  echo "docs:check — no retired phrases in the living documentation."
fi
exit $status
