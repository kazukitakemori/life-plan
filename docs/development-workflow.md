# Development workflow

GitHub is the source of truth for this project.

## Standard flow

1. Sync the latest `master` before starting work.
2. Create a task branch instead of editing `master` directly.
3. Commit and push changes to the task branch.
4. Open a pull request targeting `master`.
5. Use the automatically deployed Cloudflare preview URL to review the result in a browser.
6. Merge the pull request only after the preview is approved.
7. Pull the latest `master` in Cursor before starting the next task.

## Collaboration rule

Both ChatGPT and Cursor should start from the latest GitHub state. If either tool has changed the repository, the other side should sync from GitHub before making further edits.

## Preview safety

Pull-request previews use the separate preview Worker configuration and must not bind the production license D1 database. The preview environment is for UI and behavior review only.
