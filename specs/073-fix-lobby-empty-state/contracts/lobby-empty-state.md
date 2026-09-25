# Lobby Empty-State UI Contract

| Input | Required behavior |
| --- | --- |
| `overview.lastMatch: null` | Render no-prior-game content, with no field or letter grid. |
| `overview.lastMatch: LastMatch` | Render the existing linked band-map preview and details. |

The empty state must retain a visible last-match heading and explanatory sentence.
