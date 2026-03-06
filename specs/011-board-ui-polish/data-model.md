# Data Model: Board UI Polish

There are no database schema or backend data model changes associated with this feature. All changes are entirely confined to the web client presentation layer.

## Client-Side UI State

The following ephemeral client state additions will be introduced to support UI polish:

- `GameChrome`: Will track and derive exactly `M{n}` (move numbers) from the game loop context instead of a hardcoded round number.
- `BoardGrid`: Requires tracking of local `scale` applied by zoom events and tracking of immediate transient rejections (tapped frozen tile) decoupled from server submissions to trigger CSS animation reflows.
