# Unified Work + Deployment Continuity v1

SYNC follows two complementary continuity laws. They must not be collapsed into one rule.

## 1. Active work continuity: roll forward

When `main` moves while a feature branch or PR is still active:

1. preserve the branch and its history;
2. roll the work forward onto the new trusted base using the repository's normal conflict-safe mechanism;
3. mint a successor head;
4. treat that successor head as a new proof subject;
5. expire CI, review, runtime, Playwright, provider, artifact, and candidate-specific approvals bound to the predecessor head;
6. reacquire proof on the successor head before merge or release authority.

Active work does not stay pinned to an old base merely because an earlier head was green.

## 2. Deployment proof continuity: candidate lease

An already-proven deployment candidate remains bound to its exact SHA. If `main` advances after that candidate:

- safe, explicitly non-deploying drift may preserve the candidate lease;
- runtime, config, dependency, migration, workflow, authority, packaging, publication, or unknown drift revokes the lease;
- production deploys the exact candidate SHA, never an implicit moving `main`;
- production proof stays bound to the deployed candidate SHA.

Safe drift is repository-specific and fail-closed through `.deployment-authority.json` and `scripts/deploy_candidate_guard.py`.

## Combined state machine

```text
ACTIVE WORK
  main moves
      -> roll forward
      -> successor head
      -> predecessor proof expires
      -> re-prove successor

PROVEN DEPLOYMENT CANDIDATE
  main moves
      -> classify drift
          -> explicit safe non-deploying drift: lease survives
          -> runtime/config/authority/unknown drift: lease revoked
              -> successor becomes new candidate only after fresh proof
```

## Non-equivalence rule

Rolling work forward preserves **work continuity**.

Candidate leases preserve **deployment-proof continuity**.

A deployment lease must never be used to avoid rolling active work forward. A PR rollover must never be used as evidence that an older deployment candidate's runtime artifact changed.

## Fail-closed rules

- Unknown active-work rollover state blocks mutation.
- Merge conflict blocks automatic rollover.
- Any active-work head movement expires predecessor proof and approvals.
- Unknown deployment drift revokes the candidate lease.
- A changed deployment-authority policy revokes any candidate proven under the previous policy.
- Exact SHAs remain the identity anchors for both proof subjects and deployed candidates.

## Proof

`scripts/continuity_model_guard.py` creates a temporary Git history and attacks this contract. It must prove that:

1. active work receives a new successor head after the base moves;
2. predecessor proof identity cannot silently remain current after rollover;
3. documentation-only drift preserves an approved deployment candidate under the repo allowlist; and
4. runtime drift revokes that same candidate.

This model is intended to be inherited by Founder Control Room and other user-owned repositories with repository-specific drift policies.
