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

status=0
while IFS= read -r file; do
  for p in "${PHRASES[@]}"; do
    if grep -nF -- "$p" "$file" >/dev/null; then
      grep -nF -- "$p" "$file" | sed "s#^#${file}:#; s#\$#    [${p}]#"
      status=1
    fi
  done
  for p in "${WORD_PHRASES[@]}"; do
    if grep -nwF -- "$p" "$file" >/dev/null; then
      grep -nwF -- "$p" "$file" | sed "s#^#${file}:#; s#\$#    [${p}]#"
      status=1
    fi
  done
done < <(targets)

if [[ $status -eq 0 ]]; then
  echo "docs:check — no retired phrases in the living documentation."
fi
exit $status
