# Quickstart: Word Engine & Scoring

**Feature Branch**: `003-word-engine-scoring`

## Prerequisites

- Node.js 20.x, pnpm
- Docker (for Supabase local stack)
- Existing Wottle dev environment from `pnpm quickstart`

## Setup

```bash
# 1. Switch to the feature branch
git checkout 003-word-engine-scoring

# 2. Ensure dependencies are up to date
pnpm install

# 3. Start Supabase (if not running)
pnpm quickstart

# 4. Apply new migrations (frozen tiles + is_duplicate columns)
pnpm supabase:migrate

# 5. Verify schema
pnpm supabase:verify

# 6. Start dev server
pnpm dev
```

## Key Files to Understand

Before implementing, read these files in order:

1. **Spec**: `specs/003-word-engine-scoring/spec.md` — Requirements and acceptance scenarios
2. **Plan**: `specs/003-word-engine-scoring/plan.md` — Architecture overview and data flow
3. **Research**: `specs/003-word-engine-scoring/research.md` — Algorithm decisions and rationale
4. **Contracts**: `specs/003-word-engine-scoring/contracts/word-engine.ts` — Module interfaces
5. **Data Model**: `specs/003-word-engine-scoring/data-model.md` — Entity schemas and migrations

## Integration Context

The word engine plugs into the existing round resolution flow. Key integration points:

| File | Role | Change Type |
|------|------|-------------|
| `lib/game-engine/wordEngine.ts` | New facade module | CREATE |
| `lib/game-engine/dictionary.ts` | Dictionary loader | CREATE |
| `lib/game-engine/boardScanner.ts` | 8-direction scanner | CREATE |
| `lib/game-engine/deltaDetector.ts` | New word detection | CREATE |
| `lib/game-engine/scorer.ts` | PRD scoring formula | CREATE |
| `lib/game-engine/frozenTiles.ts` | Freeze logic | CREATE |
| `app/actions/match/publishRoundSummary.ts` | Wire engine into `computeWordScoresForRound()` | MODIFY |
| `lib/match/roundEngine.ts` | Pass frozen tiles to scoring pipeline | MODIFY |
| `lib/scoring/roundSummary.ts` | Fix scoring formula to PRD | MODIFY |
| `app/actions/match/submitMove.ts` | Validate frozen tiles before swap | MODIFY |
| `components/game/BoardGrid.tsx` | Frozen tile overlay | MODIFY |

## Test Workflow

Follow TDD for each module. Example cycle for the dictionary:

```bash
# 1. Write failing test
# tests/unit/dictionary.test.ts
# test('should load dictionary with >2M entries')

# 2. Run test (should fail - RED)
pnpm test:unit -- tests/unit/dictionary.test.ts

# 3. Implement minimum code to pass (GREEN)
# lib/game-engine/dictionary.ts

# 4. Run test (should pass)
pnpm test:unit -- tests/unit/dictionary.test.ts

# 5. Commit
git commit -m "test(word-engine): verify dictionary loads >2M entries"

# 6. Refactor if needed, re-run tests
```

## Performance Benchmarks

After implementing, validate SLAs:

```bash
# Dictionary load benchmark (<200ms)
pnpm test:unit -- tests/perf/dictionaryLoad.bench.ts

# Board scan benchmark (<50ms)
pnpm test:unit -- tests/perf/boardScan.bench.ts

# Full round resolution RTT (<200ms)
pnpm perf:round-resolution
```

## Dictionary File

The wordlist is at `docs/wordlist/word_list_is.txt`:
- ~2.76M entries (all inflected forms)
- One word per line, UTF-8 encoded
- Must be NFC-normalized and lowercased at load time

Letter scoring values at `docs/wordlist/letter_scoring_values_is.ts`:
- 32 Icelandic letters with point values (1-10)
- Imported directly in scorer module

## Common Tasks

### Run all word engine tests

```bash
pnpm test:unit -- --grep "word-engine|dictionary|scanner|scorer|frozen"
```

### Reset database (if schema gets out of sync)

```bash
pnpm supabase:reset
```

### Check frozen tile state for a match

```sql
SELECT id, frozen_tiles FROM matches WHERE id = '<match-id>';
```

### Debug word scanning

Add `performance.mark()` calls around scanner operations. View timings in structured logs during dev server output.
