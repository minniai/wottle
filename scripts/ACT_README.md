# Running CI Locally with Act

This guide explains how to run GitHub Actions workflows locally using [act](https://github.com/nektos/act).

## Prerequisites

1. **Install act**:

   ```bash
   # macOS
   brew install act
   
   # Linux
   curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
   
   # Windows
   choco install act-cli
   ```

2. **Docker must be running** - act uses Docker to run workflow jobs

3. **Run from project root** - Always execute act from the repository root directory

4. **Supabase Access Token** (Optional for jobs that need Supabase):
   - **Option A**: Create a `.secrets` file (recommended):

     ```bash
     cp .secrets.example .secrets
     # Edit .secrets and add your Supabase access token
     ```

     Get your token from: <https://supabase.com/dashboard/account/tokens>

   - **Option B**: Skip token check for local development (limited functionality):

     ```bash
     export ACT_SKIP_TOKEN_CHECK=1
     ```

     This allows quickstart to run without cloud authentication

5. **Start Supabase before running act** (Recommended):

   The act container cannot reliably access Docker on your host machine. To work around this:

   ```bash
   # Step 1: Start Supabase on your host machine first
   pnpm quickstart

   # Step 2: Run act (credentials from .env.local are automatically passed)
   pnpm act -j playwright --matrix suite:baseline
   ```

   The helper script automatically detects `.env.local` and passes the Supabase credentials to the act container, allowing quickstart to skip the Supabase start step.

6. **Docker Socket Access** (if Docker check fails in act):
   - If you see "Docker prerequisite failed" errors when running act, this is expected because Docker socket mounting doesn't work reliably in act
   - The recommended solution is step 5 above (start Supabase on host first)
   - As a fallback, you can skip the Docker check explicitly:

     ```bash
     export ACT_SKIP_DOCKER_CHECK=1
     ```

## Usage

### Run specific jobs

```bash
# Run lint job only
bash scripts/act.sh -j lint

# Run typecheck job
bash scripts/act.sh -j typecheck

# Run unit tests
bash scripts/act.sh -j test

# Run quickstart (Supabase setup) - requires .secrets file OR skip token check
bash scripts/act.sh -j quickstart

# Run quickstart without Supabase cloud authentication (local only)
export ACT_SKIP_TOKEN_CHECK=1
bash scripts/act.sh -j quickstart

# Run Playwright tests for baseline suite (requires quickstart first)
bash scripts/act.sh -j playwright --matrix suite:baseline

# Run Playwright tests for playtest suite  
bash scripts/act.sh -j playwright --matrix suite:playtest

# Run performance gate
bash scripts/act.sh -j perf-gate
```

### Quick start for local testing (without Supabase token)

```bash
# Set environment variables to skip checks
export ACT_SKIP_TOKEN_CHECK=1
export ACT_SKIP_DOCKER_CHECK=1  # Only if Docker socket mount fails

# Run the tests
bash scripts/act.sh -j playwright --matrix suite:baseline
```

### Run all jobs (not recommended)

```bash
bash scripts/act.sh
```

**Note**: Running all jobs sequentially can take a very long time. It's better to run specific jobs.

## Common Issues

### Issue: `Missing SUPABASE_ACCESS_TOKEN environment variable`

**Symptom**: Error during "Start Supabase stack via quickstart" step:

```json
{"event":"supabase.preflight.failure","timestamp":"...","message":"Missing SUPABASE_ACCESS_TOKEN environment variable for Supabase login"}
```

**Cause**: The Supabase access token is required for cloud authentication but not provided.

**Solutions**:

1. **Option A - Add Supabase token** (recommended for full functionality):

   ```bash
   # Create secrets file from example
   cp .secrets.example .secrets
   
   # Edit .secrets and add your token
   # Get token from: https://supabase.com/dashboard/account/tokens
   nano .secrets  # or use your preferred editor
   
   # Run act again
   bash scripts/act.sh -j playwright --matrix suite:baseline
   ```

2. **Option B - Skip token check** (for local-only testing):

   ```bash
   # Set environment variable
   export ACT_SKIP_TOKEN_CHECK=1
   
   # Run act
   bash scripts/act.sh -j playwright --matrix suite:baseline
   ```

   **Note**: This runs Supabase in local-only mode without cloud authentication. Some features may be limited.

### Issue: `.env.local not found`

**Symptom**: Error during "Start Next.js server" step:

```txt
ERROR: .env.local not found! Server will fail without Supabase credentials
```

**Cause**: The quickstart step failed before creating `.env.local`, usually because:
- Docker check failed in preflight (Docker socket not accessible in act container)
- Supabase start failed (Docker not accessible)

**Debug steps**:

1. Check the "Start Supabase stack via quickstart" step output
2. Look for "Working directory:" line to see where quickstart ran
3. Check if quickstart completed successfully (look for `supabase.quickstart.success` event)
4. Look for Docker-related errors in the preflight step

**Solutions**:

1. **Skip Docker check and use existing Supabase** (if Supabase is already running):

   ```bash
   # Start Supabase manually first (outside of act)
   pnpm quickstart
   
   # Then run act with Docker check skipped
   export ACT_SKIP_DOCKER_CHECK=1
   pnpm act -j playwright --matrix suite:baseline
   ```

   The quickstart script will detect that Supabase is already running and skip the start step, allowing `.env.local` to be created.

2. **Ensure Docker is running on host**:

   ```bash
   docker ps
   # Should show running containers, not error
   ```

3. **Run quickstart manually first** to verify it works:

   ```bash
   pnpm quickstart
   ls -la .env.local  # Should exist
   ```

4. **Check Docker socket is accessible**:

   ```bash
   # macOS/Linux
   ls -l /var/run/docker.sock
   ```

5. **Run act with verbose output**:

   ```bash
   bash scripts/act.sh -j quickstart --verbose
   ```

### Issue: Docker socket not found

**Symptom**: Error about Docker socket not being accessible

**Solutions**:

1. **macOS**: Ensure Docker Desktop is running

2. **Linux**: Ensure Docker daemon is running

   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

3. **WSL2 (Windows)**: Ensure Docker Desktop is configured for WSL2 integration

4. **Custom Docker socket**: Set `DOCKER_HOST` environment variable

   ```bash
   export DOCKER_HOST=unix:///path/to/docker.sock
   bash scripts/act.sh -j test
   ```

### Issue: Supabase CLI not found

**Symptom**: `supabase: command not found`

**Solution**: The workflow includes `supabase/setup-cli@v1` action, but act might not execute it properly. Install Supabase CLI manually:

```bash
# macOS
brew install supabase/tap/supabase

# Linux
curl -fsSL https://github.com/supabase/supabase/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

### Issue: Steps fail with "No such file or directory"

**Symptom**: Files created in one step aren't available in the next step

**Cause**: act's workspace mounting might not be configured properly

**Solution**: Ensure you're running from the project root:

```bash
cd /path/to/wottle
pwd  # Should show project root
bash scripts/act.sh -j playwright
```

## How It Works

The `scripts/act.sh` helper does the following:

1. **Changes to project root** if not already there
2. **Detects Docker socket** location (supports macOS, Linux, custom)
3. **Creates artifact directory** for file uploads
4. **Mounts Docker socket** so Supabase can run inside the act container
5. **Enables artifact server** for `upload-artifact` actions

## Debugging Tips

### View workflow files

```bash
cat .github/workflows/ci.yml
```

### List available jobs

```bash
act -l
```

### Dry run (don't execute, just show what would run)

```bash
act -n
```

### Run with verbose output

```bash
bash scripts/act.sh -j test --verbose
```

### Run with specific event

```bash
act push  # Trigger on push event
act pull_request  # Trigger on PR event
```

### Check logs from a specific container

```bash
docker ps  # Find container ID
docker logs <container-id>
```

## Environment Variables

You can pass environment variables to act:

```bash
# Set specific env var
act -j test --env MY_VAR=value

# Load from .env file
act -j test --env-file .env.local

# Pass secrets (for jobs that need SUPABASE_ACCESS_TOKEN)
act -j quickstart --secret SUPABASE_ACCESS_TOKEN=your_token
```

## Performance

- **Fast jobs** (< 1 minute): lint, typecheck, test
- **Medium jobs** (2-5 minutes): quickstart
- **Slow jobs** (5-15 minutes): playwright, perf-gate

## Limitations

1. **Matrix jobs**: act runs matrix jobs sequentially, not in parallel
2. **Artifacts**: Stored locally in temp directory, not in GitHub
3. **Secrets**: Must be provided via `--secret` flag or `.secrets` file
4. **Cache**: act's caching is less sophisticated than GitHub Actions

## Troubleshooting Checklist

- [ ] Docker is running (`docker ps` works)
- [ ] Running from project root (`pwd` shows wottle directory)
- [ ] Dependencies installed (`pnpm install` completed)
- [ ] Supabase CLI available (`supabase --version` works)
- [ ] Docker socket is accessible (check error messages)
- [ ] `.env.local` created by quickstart (check manually)

## Further Help

- Act documentation: <https://github.com/nektos/act>
- Act troubleshooting: <https://github.com/nektos/act/issues>
- Wottle project issues: Report in project repository
