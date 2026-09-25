# Data Model: Fix Lobby Empty State

No data-model change is required.

| Entity | Existing rule used by this feature |
| --- | --- |
| `Overview.lastMatch` | `null` denotes no eligible completed match for the player and selected language. |
| `LastMatch` | A non-null record supplies the existing completed-match preview. |
