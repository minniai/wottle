# 003-word-engine-scoring scripts

## Create GitHub issues from tasks

The GitHub MCP server is optional. To create issues from `tasks.md` without it:

1. **Export** (already done): `issues-export.json` contains all 42 tasks as issue title + body + labels.

2. **Create issues** with the GitHub CLI (requires `gh` and `gh auth login` for `minniai/wottle`):

   ```bash
   # From repo root
   node specs/003-word-engine-scoring/scripts/create-github-issues.mjs --dry-run   # preview
   node specs/003-word-engine-scoring/scripts/create-github-issues.mjs               # create all
   ```

3. **Labels**: The script adds labels such as `word-engine`, `phase-1-setup`, `us1`, etc. Create these in the repo first, or edit the script/JSON to use existing labels only.

To use the GitHub MCP server instead, enable it in Cursor and run the speckit.taskstoissues command again; the MCP can create issues directly.
