# Quick Start: Running Tests Locally with Act

This is a quick reference for running CI tests locally. For detailed documentation, see `scripts/ACT_README.md`.

## One-Time Setup

```bash
# 1. Install act (if not already installed)
brew install act  # macOS
# or for Linux: curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# 2. Ensure Docker is running
docker ps

# 3. Choose your authentication method:

# Option A: Skip cloud authentication (recommended for local testing)
export ACT_SKIP_TOKEN_CHECK=1

# Option B: Use full Supabase cloud features (requires token)
# cp .secrets.example .secrets
# Edit .secrets and add your Supabase access token from:
# https://supabase.com/dashboard/account/tokens
```

## Running Tests

```bash
# Always run from project root
cd /path/to/wottle

# List all available jobs (doesn't run anything)
bash scripts/act.sh -l

# Run Playwright tests (most common)
export ACT_SKIP_TOKEN_CHECK=1
bash scripts/act.sh -j playwright --matrix suite:baseline

# Run other jobs
bash scripts/act.sh -j lint
bash scripts/act.sh -j typecheck
bash scripts/act.sh -j test
```

**Note**: Running `bash scripts/act.sh` without parameters will attempt to run ALL jobs sequentially, which takes a long time. Always use `-j` to run specific jobs.

## If Something Goes Wrong

### "Missing SUPABASE_ACCESS_TOKEN"

```bash
# Solution: Set the skip flag
export ACT_SKIP_TOKEN_CHECK=1
bash scripts/act.sh -j playwright --matrix suite:baseline
```

### "Docker socket not found"

```bash
# Ensure Docker is running
docker ps
# If that works, try again
```

### ".env.local not found"

```bash
# This means quickstart failed - check the quickstart output
# Most likely cause: forgot to set ACT_SKIP_TOKEN_CHECK=1
export ACT_SKIP_TOKEN_CHECK=1
bash scripts/act.sh -j playwright --matrix suite:baseline
```

## What Each Flag Does

- `ACT_SKIP_TOKEN_CHECK=1` - Runs Supabase locally without cloud authentication
- `-j playwright` - Run only the Playwright job
- `--matrix suite:baseline` - Run the baseline test suite (not playtest)

## Full Documentation

See `scripts/ACT_README.md` for:

- Detailed troubleshooting
- All available commands
- Environment variables
- Advanced usage
