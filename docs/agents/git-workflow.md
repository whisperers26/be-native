# Git workflow

How every change reaches this repository, whichever agent makes it. The owner
can override any of this for a single task by saying so.

## Repositories

- Work happens in the fork `whisperers26/be-native`. Upstream
  `pot-app/pot-desktop` is archived: never push to it, open PRs against it, or
  file issues there.
- `origin` is the fork. Do not add an `upstream` remote.
- `gh` is pinned to the fork (`gh repo set-default whisperers26/be-native`),
  but every `gh pr` command still names it with `--repo`.

## Branches

`main` is the only long-lived branch. Never commit to it directly. Each
feature or fix gets its own branch, cut from an up-to-date `main`:

```bash
git switch main && git pull --ff-only
git switch -c <type>/<slug>
```

`<type>` is one of `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`.
`<slug>` is a few lowercase words joined by `-`, for example
`fix/ocr-empty-result`.

If `git switch -c` says the branch already exists, it is left over from a
merged PR: delete it with `git branch -d <type>/<slug>` and create it again
from `main`. Never build on the old one.

## Commits

Small commits, one topic each. A commit should show its own change and nothing
else, so it reads on its own and can be reverted on its own.

- Keep the topic itself small. "Implement X" is not a topic, it is a pile of
  them — break the work into steps that each stand up alone (the data shape,
  then the behaviour, then what is drawn, then the wiring) and commit each as
  it works. A commit whose message needs "and" in it, or whose diff spans a
  feature's whole surface, should have been several.
- Never bundle two topics because they happened in the same session or touch
  the same file. Two fixes are two commits; a fix and a colour tweak are two
  commits.
- Keep mechanical changes out of behavioural ones. A move, rename or
  extraction is its own commit with no behaviour change in it, and a behaviour
  change carries no drive-by refactor. If a fix needs code moved first, that
  is two commits: move, then fix.
- Commit at each working step as the work goes, not in one batch at the end.
- Split a commit that turned out to hold more than one topic, rather than
  leaving it (reset and recommit while it is unpushed).
- Only stage the files the commit is about. Leave files the owner changed, or
  that tooling rewrote, out of it — say so instead of sweeping them in.

Messages: an imperative subject line under 72 characters; after a blank line,
say why when the diff does not make it obvious.

## Pull requests

1. If `main` moved on, rebase the branch onto it before opening the PR.
2. Run the local checks listed in the Commands table of `AGENTS.md`.
3. Push and open the PR against the fork. The description says what changed,
   why, and how it was verified, and lists any bug found but not fixed; add those to [known-issues.md](known-issues.md) too.

   ```bash
   git push -u origin HEAD
   gh pr create --repo whisperers26/be-native --base main --fill
   ```

4. Wait for CI to pass:

   ```bash
   gh pr checks <branch> --repo whisperers26/be-native --watch
   ```

5. Merge with a merge commit. Never squash: squashing collapses the small
   commits above into one. Then delete your local copy of the branch:
   `--delete-branch` removes it on GitHub, but with `--repo` it leaves the
   local one behind.

   ```bash
   gh pr merge <branch> --repo whisperers26/be-native --merge --delete-branch
   git switch main && git pull --ff-only --prune
   git branch -d <branch>
   ```

### When the owner asks to review

If the owner explicitly asks to review a PR themselves, open it, report the
link, and stop. Do not merge it.

## Keeping docs true

Every PR updates the docs its change makes wrong:

- READMEs: when a change affects what a README reader sees — features,
  requirements, install, build or run commands, or the list of changes in this
  fork — update all three: `README.md` (Chinese), `README_EN.md`,
  `README_KR.md`. The fork section sits between `<!-- fork:start -->` and
  `<!-- fork:end -->` and must have the same bullets in all three languages.
- Wiki: update the `docs/agents/` pages that became wrong. A new page gets a
  row in the wiki index in `AGENTS.md`.
- `pnpm check:docs` must pass.
