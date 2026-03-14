# Quickstart: Sensory Feedback & Sequential Round Reveal

**Branch**: `015-sensory-feedback` | **Date**: 2026-03-14

## Prerequisites

No new environment variables or infrastructure changes are required. All existing local setup (`pnpm quickstart`) remains sufficient.

## What Changes at the Server Layer

### Round 1 `started_at`

The only server-side change is in `lib/match/stateLoader.ts`: round 1 is now created with `started_at` set. This column already exists in the `rounds` table and is used by all subsequent rounds. **No migration is needed.**

Existing matches in your local database will have round 1 records with `started_at = NULL`. These matches are unaffected — the fix only applies to new matches created after deployment. Integration tests that verify round 1 timer behaviour should create fresh matches.

### `RoundMove.submittedAt` Population

`lib/scoring/roundSummary.ts` is updated to include `move_submissions.created_at` when building `RoundMove` objects. This is a non-breaking addition to the Realtime broadcast payload — existing clients that ignore unknown fields will continue to work.

## Development Workflow

### Running Tests

```bash
# Unit tests only (fast, no Supabase needed)
pnpm test:unit

# Specific new test files
pnpm test:unit -- tests/unit/preferences/useSensoryPreferences.test.ts
pnpm test:unit -- tests/unit/audio/useSoundEffects.test.ts
pnpm test:unit -- tests/unit/haptics/useHapticFeedback.test.ts
pnpm test:unit -- tests/unit/match/stateLoader.round1Timer.test.ts

# Integration tests (requires Supabase running)
pnpm test:integration -- tests/integration/match/roundSummary.submittedAt.test.ts

# Full Playwright E2E (requires both Next.js and Supabase)
pnpm exec playwright test tests/integration/ui/sensoryFeedback.spec.ts
```

### Mocking Browser APIs in Vitest

Both `AudioContext` and `navigator.vibrate` are browser globals not available in the Vitest/jsdom environment. Mock them in test files:

```typescript
// Mock Web Audio API
const mockOscillator = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } };
const mockGain = { connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn() } };
const mockContext = {
  state: "running",
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGain),
  destination: {},
  currentTime: 0,
  close: vi.fn(),
};
vi.stubGlobal("AudioContext", vi.fn(() => mockContext));

// Mock Vibration API
vi.stubGlobal("navigator", { ...navigator, vibrate: vi.fn() });
```

### Inspecting Audio in the Browser

To verify audio synthesis during development:
1. Open DevTools → Console
2. Run a game action (swap a tile, score a word)
3. Check the Sources panel for Web Audio API graphs, or use the "Web Audio" tab in Chrome DevTools

### Settings Persistence

Settings are stored in `localStorage` under `"wottle-sensory-prefs"`. To reset to defaults during testing:

```javascript
// In browser console
localStorage.removeItem("wottle-sensory-prefs");
location.reload();
```

## Deployment Notes

- No infrastructure changes required
- No new environment variables
- No database migrations
- Audio synthesis runs entirely in-browser — no CDN assets to deploy
- `localStorage` is per-device; players will see default settings (both enabled) on first visit to any new device
