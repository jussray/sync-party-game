# SYNC merge-review gate and release authority

## Verified gap

At `main` SHA `36cf79f801ef1c84f79361bb2cfaee2ca0f21788`, GitHub reports `protected: false`, with no repository rulesets. `CODEOWNERS`, successful Actions jobs, and this merge-review workflow alone **do not technically prevent a user with direct push/merge rights from bypassing the gate**.

## Proposed advisory gate

The `Merge Review` workflow evaluates live pull-request metadata from GitHub using trusted `main` policy code. It never checks out or executes PR-head code. The workflow needs only `checks: write` to publish a check-run named `merge-review` **on the exact PR head SHA**; `contents`, PR reads, and commit statuses remain read-only. It cannot merge, push source, modify rulesets, or deploy. A green result requires:

- Open, non-draft, mergeable PR targeting current `main` (exact base SHA plus verified **main-to-head ancestry**).
- `core-proof` and `verify-agent-contract` from GitHub Actions both completed successfully on the **same exact current PR head SHA**.
- No other red, cancelled, incomplete, or missing current-head checks, or failing legacy statuses.
- An independent `APPROVED` review explicitly bound to that same SHA; predecessor approvals cannot be reused.

The head check is set to `in_progress` before evaluation, then `success` or `failure` when the current-head GitHub evidence is inspected; it refreshes on review and CI completion. Workflow and check events do not run PR-head code. A historical failed intermediate commit remains red in GitHub history, but may be followed by a freshly verified green successor. Never rewrite history or represent the old red check as green.

## Hard enforcement still required in GitHub Settings

An admin must install an active **branch ruleset** for `main` that:
1. Restricts force pushes and branch deletion; limits direct updates and requires pull requests.
2. Requires both exact-head checks `core-proof` and `verify-agent-contract`, plus `merge-review` after the workflow is merged.
3. Requires independent approving reviews, dismisses stale approvals on new commits, requires conversations resolved, and applies code-owner approval where supported.
4. Does not allow an undocumented founder, bot, or automation bypass. Configure review authorities carefully if all PRs are authored by `jussray`: GitHub does not allow self-approval.
5. Re-read `branches/main` protection, active rulesets, and test a rejected red head before claiming hard enforcement.

Do **not** merge to enable this workflow without a separate release authorization: merging `main` triggers the live production promotion pipeline.

## Limitations

The workflow is an evidence signal until required by branch rulesets. A push to a successor SHA and completion of `core-proof` or `Agent Contract v1` schedules re-evaluation. Third-party completed checks can trigger another evaluation. New unrecognized checks or service interruptions outside those triggers may require another run; GitHub branch protection is the hard enforcement authority. Repository administrators may still change rulesets. Its approval check excludes self-reviews but GitHub's native branch protection must enforce reviewer permissions and required approvals.

## Existing draft reverts

PR #21 and #22 are mutually exclusive rollback alternatives with successful source tests. Neither is approved for merge solely because its CI passed. They must remain drafts until a specific rollback choice is authorized.
