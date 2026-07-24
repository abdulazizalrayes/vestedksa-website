# CLAUDE.md

Project instructions for AI coding agents.

These rules are adapted from the Karpathy-inspired Claude Code guidelines:
think before coding, prefer simple solutions, make surgical changes, and verify against clear goals.

## Core Behavior

- Do not silently guess when the task is ambiguous.
- State assumptions before acting when they matter.
- Ask for clarification when uncertainty could change the implementation.
- Prefer the smallest correct solution over broad rewrites.
- Do not add features, abstractions, configuration, or flexibility that were not requested.
- Preserve existing style, structure, naming, and conventions unless changing them is required.
- Avoid unrelated refactors, formatting churn, comment rewrites, and drive-by cleanup.
- Every changed line should connect directly to the user's request.
- When you create unused imports, variables, functions, files, or dead paths, remove only the things your change created.
- If you notice unrelated dead code or questionable design, mention it instead of changing it.

## Before Coding

For non-trivial tasks, first identify:

1. What the user is asking for.
2. What assumptions you are making.
3. What files or systems are likely involved.
4. What success looks like.
5. How you will verify the result.

If there are multiple valid interpretations, present the options briefly and choose the safest one only if the choice is low risk.

## Simplicity First

Implement the minimum code that solves the problem.

Avoid:

- speculative abstractions
- broad architecture changes
- one-use helper layers
- premature configuration
- unnecessary error handling for impossible states
- large rewrites when a focused patch will do

If the solution starts getting large, pause and look for a smaller design.

## Surgical Changes

When editing existing code:

- Touch only the files needed for the task.
- Match the project's existing patterns.
- Keep diffs narrow and readable.
- Do not rename things unless required.
- Do not reorganize files unless required.
- Do not change public behavior outside the requested scope.

If a broader cleanup would help, mention it as a follow-up instead of doing it immediately.

## Goal-Driven Execution

Turn requests into verifiable outcomes.

Examples:

- "Fix the bug" means reproduce or understand the failure, patch it, then verify it is fixed.
- "Add validation" means define invalid cases, implement validation, then test those cases.
- "Refactor this" means preserve behavior before and after the refactor.

For multi-step work, use a short plan:

1. Inspect the relevant code.
2. Make the smallest safe change.
3. Run the most relevant checks.
4. Report what changed and what was verified.

## Verification

After changes, run the most relevant available check, such as:

- unit tests
- typecheck
- lint
- build
- focused manual verification

If verification cannot be run, explain why and state the remaining risk.

## Communication

- Be concise but explicit.
- Surface tradeoffs when they matter.
- Push back if the requested approach seems risky or overcomplicated.
- Do not hide uncertainty.
- Do not claim success without verification.

## Cloud Paperclip Operations

- This repository and its Paperclip work belong only to Vested KSA. Do not mix agents, tasks, credentials, instructions, workspaces, or account ownership with another company.
- The cloud Paperclip instance is `https://ai.eijarat.com`. Treat it as a changing external system: before Paperclip work, verify the running release through `/api/health` or the signed-in account menu, confirm the Vested KSA dashboard loads, and check the authoritative agent/task status. Do not assume behavior from an older release.
- The verified release on 2026-07-24 was `deployment/v2026.722.0-cloud-models-20260724` at commit `558bdec`. Reverify on future work instead of treating this value as permanent.
- Confirm available OpenCode models from the live agent model selector or `opencode models` before assigning them. Use `opencode/big-pickle` for leadership, orchestration, implementation, audit, and other important or judgment-heavy work. Use `opencode/deepseek-v4-flash-free` for routine, helper, enrichment, triage, formatting, and other cost-sensitive work.
- Kimi is not configured or approved. Do not select or configure it without owner approval.
- Review an existing agent and its latest configuration revision before changing its model, permissions, tools, or runtime behavior. Do not enable experimental features without owner approval.
- Use the v2026.722.0 attention/Decisions queue, Skill Studio, search, run recovery, cost telemetry, secret-access controls, and Office attachment support when they are relevant to the task.
- Audit legacy agents after upgrades. Remove obsolete primary-model assignments and verify the saved model on the complete agent roster; do not rely only on an individual configuration form.
- In Paperclip v2026.707.0 and later, use user-specific runtime secrets and responsible-user attribution for sensitive values. Never place plaintext secrets in agent prompts or ordinary environment-variable fields.
- Use the Work Timeline and the read-only issue-subtree, blocker, and branch-ancestry diagnostics before mutating stuck work. Prefer the one-click isolated re-issue flow for genuinely diverged branches.
- Account for current continuation behavior: checkbox selections and plan-review context persist across wakes, dependency wakes have a reconciliation backstop, superseded user questions expire, and active heartbeat runs should not be treated as stale solely because they are long-running.
- Distinguish current agent status from stale run cards. If dashboard live-run counts disagree with the authoritative agent summary, inspect run/task diagnostics before pausing, retrying, or deleting anything.
- Use the redesigned environment-variable and secret-reference editor consistently across agents, projects, routines, and company environments. Keep company and user secret scopes explicit.
