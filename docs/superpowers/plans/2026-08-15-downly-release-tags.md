# Downly Release Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every successful push to `main` creates a new version tag, and every version tag creates a GitHub Release with the packaged Chrome extension ZIP.

**Architecture:** Extend the existing GitHub Actions workflows instead of adding a separate release service. CI remains the quality gate on `main`; after it passes, a release-tag job computes the next SemVer patch tag, pushes it, and dispatches the package workflow on that tag because tag pushes made with `GITHUB_TOKEN` do not reliably trigger another workflow. The tag-capable package workflow builds the ZIP and creates the GitHub Release from that artifact.

**Tech Stack:** GitHub Actions, bash, `git`, GitHub CLI (`gh`), existing `npm` scripts in `extension/chrome`.

## Global Constraints

- Branch names use no `codex/` prefix.
- Existing untracked local files under `.idea/`, `codex.md`, and `docs/superpowers/` must not be staged unless directly created for this plan.
- Release tags use `vX.Y.Z`.
- If no release tag exists, the first generated tag is `v1.0.0`.
- Rerunning CI for a commit that already has a `vX.Y.Z` tag must not create a duplicate newer tag.

---

### Task 1: Main Push Auto-Tagging

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: successful `chrome-extension` CI job on pushes to `main`.
- Produces: a pushed annotated Git tag named `vX.Y.Z`.

- [ ] **Step 1: Add write permissions**

Set the `release-tag` job permissions to allow tagging and workflow dispatch while keeping the global CI token read-only:

```yaml
permissions:
  contents: read

jobs:
  release-tag:
    permissions:
      actions: write
      contents: write
```

- [ ] **Step 2: Add a release-tag job**

Add a job that:

```yaml
needs: chrome-extension
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

The job checks out full history, fetches tags, skips if `HEAD` already has a `vX.Y.Z` tag, computes the next patch version from the highest existing tag, creates an annotated tag, pushes it to origin, and dispatches `package-extension.yml` with `--ref "$next_tag"`.

- [ ] **Step 3: Validate YAML**

Run a local syntax-oriented inspection:

```bash
sed -n '1,220p' .github/workflows/ci.yml
```

Expected: workflow still has CI steps and the new tag job.

### Task 2: Tag Release Creation

**Files:**
- Modify: `.github/workflows/package-extension.yml`

**Interfaces:**
- Consumes: pushed tags matching `v*` and ZIPs produced by `npm run package`.
- Produces: GitHub Release named after the tag with the ZIP attached.

- [ ] **Step 1: Add write permissions**

Set package workflow permissions to allow release creation:

```yaml
permissions:
  contents: write
```

- [ ] **Step 2: Add a GitHub Release step**

After uploading the package artifact, add a tag-ref step:

```yaml
if: startsWith(github.ref, 'refs/tags/')
```

The step uses `gh release create "$GITHUB_REF_NAME" artifacts/*.zip --title "$GITHUB_REF_NAME" --notes "Downly Chrome extension $GITHUB_REF_NAME"` from `extension/chrome`, with `GH_TOKEN: ${{ github.token }}`.

- [ ] **Step 3: Validate YAML**

Run:

```bash
sed -n '1,220p' .github/workflows/package-extension.yml
```

Expected: workflow still packages and now creates a release on tag pushes.

### Task 3: Verification, Commit, Merge, Push, Backfill Current Release

**Files:**
- Stage: `.github/workflows/ci.yml`
- Stage: `.github/workflows/package-extension.yml`
- Stage: `docs/superpowers/plans/2026-08-15-downly-release-tags.md`

**Interfaces:**
- Consumes: modified workflows.
- Produces: committed workflow changes on `main`, a pushed current tag, and a release workflow run.

- [ ] **Step 1: Run local verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

from `extension/chrome`.

- [ ] **Step 2: Commit workflow changes**

```bash
git add .github/workflows/ci.yml .github/workflows/package-extension.yml docs/superpowers/plans/2026-08-15-downly-release-tags.md
git commit -m "ci: tag and release Downly versions"
```

- [ ] **Step 3: Merge and push**

```bash
git switch main
git merge --ff-only downly-release-tags
git push origin main
```

- [ ] **Step 4: Backfill the current release tag if needed**

If `HEAD` has no `vX.Y.Z` tag after the workflow change is pushed, create and push `v1.0.0` manually:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

- [ ] **Step 5: Watch GitHub Actions**

Run:

```bash
gh run list --branch main --limit 5
gh run list --limit 10
```

Watch the CI run and the package/release run until they complete.
