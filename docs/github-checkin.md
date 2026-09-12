# Manual GitHub Check-In

Use these commands to review, commit, and push the latest intentional source changes to GitHub.

Repository remote:

```text
git@github.com:whope2/VirtualReadingWorld.git
```

Default branch:

```text
main
```

## 1. Review Before Staging

From the project root, check the branch and working tree:

```bash
cd /Users/maxwang/Projects/git/Copilot/Virtual\ Reading\ World
git branch --show-current
git status
git diff
```

Review every changed and untracked file. Do not commit generated `dist/` or `node_modules/` folders, local SQLite databases, `.env` files, or deployment archives. Those paths are covered by `.gitignore`.

## 2. Stage Intentional Changes

Stage specific files when you want maximum control:

```bash
git add README.md CHANGELOG.md VERSION docs/github-checkin.md
git add backend/src backend/test docs world/src world/public world/vite.config.ts
```

Alternatively, stage all non-ignored changes after reviewing them:

```bash
git add -A
```

Check exactly what will be committed:

```bash
git status
git diff --cached
```

## 3. Commit And Push

Replace the message with a short description of the change:

```bash
git commit -m "Describe the change"
git push origin main
```

If GitHub authentication is not configured, follow the terminal prompt to authenticate your SSH key or GitHub CLI session. Do not place a password or access token in a command or source file.

## 4. Confirm The Push

```bash
git status
git log -1 --oneline
git ls-remote --heads origin main
```

`git status` should report a clean working tree and that `main` is up to date with `origin/main`. The commit ID from `git log -1` should match the commit ID shown for `refs/heads/main` by `git ls-remote`.

## Release Version

When publishing a cloud release, update `VERSION` and add a dated entry to `CHANGELOG.md` before staging. The versioned source commit should be pushed to GitHub before following the cloud deployment instructions in `README.md`.