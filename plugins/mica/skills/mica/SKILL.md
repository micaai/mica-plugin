---
name: mica
description: Use when editing, personalizing, installing, sharing, updating, or contributing changes to Claude Code agent skills — for example when the user edits a skill under ~/.claude/skills, asks to install or update a skill, or wants to share a skill improvement with its owner. Snapshots skill edits and manages updates and contributions through the mica CLI.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs *)
---

# Mica

Run every command as `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs <command>`.

Mica tracks a skill's installation against its trunk on the server. It
snapshots local edits, merges upstream updates, and offers contributions back
to a skill's owner. This skill covers the same workflow the PostToolUse hook
handles automatically — use it when hooks are disabled, or when a command
other than a plain edit needs to run.

## When to snapshot

After ANY edit to a file under a tracked skill directory
(`~/.claude/skills/<name>` or `$CLAUDE_CONFIG_DIR/skills/<name>`), run:

```
node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs snapshot --intent "<goal>"
```

Every mica command snapshots all installations first, so running any
command is always safe. When in doubt, snapshot.

## How to phrase `--intent`

One sentence, stating the user's goal behind the edit — the WHY, not a
description of the diff.

- Good: `"Always answer in French for this user"`
- Bad: `"changed line 12 of SKILL.md"`

Record one intent per distinct goal. If an edit serves two goals, make two
snapshots rather than bundling them into one intent.

## Publish vs contribute

- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs publish <path>` is owner-only: it creates a skill's trunk or
  advances its head directly for everyone who uses it.
- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs contribute` offers selected intent records from your
  personalization to the skill's owner for review.

Decide by fact, not by guess. `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs status` marks every installation the
user owns with `(owner)`. Owned → `publish`. Not owned → `contribute`.

Do NOT ask the user whether they own the skill, and do NOT infer ownership
from drift or from "tracked installation": an owner's own copy is also a
tracked installation, and it drifts whenever the owner edits it. If you did
not run `status` this session, run it before choosing.

If `publish` returns `not_owner`, run `contribute` instead.

## Contributing all or some intents

`node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs contribute <skill>` with no flags is list mode: it returns the
contributable `intents` (each with an `id` and its intent text) and the
`unattributed` delta (edits not covered by any intent). It submits nothing.

Choose the flags from what the user asked for:

- "Share all my improvements" →
  `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs contribute <skill> --all`
  (every listed intent plus the unattributed delta).
- "Share only my X change" → first run list mode, match the intent text to
  the user's request, then
  `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs contribute <skill> --intents <id>[,<id>...]`
  (comma- or space-separated). Add `--unattributed` to also include the
  edits that have no intent. If the match is unclear, relay the list to
  the user and ask which intents to submit.

A successful call returns a confirm question (submit / cancel); relay it as
usual. If a subset returns `hunks_do_not_apply`, an unselected intent
changed the same lines: select the related intents together, or use
`--all`.

## Connecting to Mica

When the user asks to connect Mica, or a command reports that the user is not
logged in, run `login`. Login spans more than one command: one command starts
it, and a later command finishes it with the code the browser shows. The CLI
never polls and never learns the code by itself.

Run login with `--json` and read `result.status`:

- `email_required` — ask the user which email address to connect, then run
  `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs login --json --email <email>`.
- `code_required` — present `result.verification_uri` as a clickable
  **Connect Mica** link, and ask the user to open it and send back the code
  the page shows. Then run
  `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs login --json --code <code>`.
- `logged_in` — tell the user which email `result.email` names, then continue
  with the command the user originally asked for.

Rules:

- Ask in plain words. Do not show the user a shell command, and do not ask
  the user to run one.
- Pass `--email` or `--code`, never both in the same command.
- Pass `--code` only after a `code_required` status. `--code` alone fails
  when no login is waiting for a code.
- Run `login --json` with no other flag to see where a login stands: it
  repeats the saved link, or reports the logged-in email.
- A `code_required` status with `result.retry_reason` means the code was
  rejected or is not confirmed yet. The login is still good: ask the user for
  the code again, against the same link, and run `--code` again. Do not
  restart with `--email`.
- Restart with `--email <email>` only when the link itself is dead or
  expired. That starts a new login and returns a new link.
- `say_to_user` is already worded for the user in every case — a first
  prompt, a resume, an unconfirmed code, and a rejected code each get their
  own sentence. Relay it as it stands.
- Add `--local` to keep credentials in `./.mica` instead of `~/.mica`. Use it
  when a wrapper or a session brief tells you to.
- Never print, repeat, or read out a token, an assertion, or the contents of
  a file under `.mica/`. Relay only the link, the status, and the email.

## Handling pending questions

Commands may return `questions` — server-held pending questions, each with a
`question_id` and options. For each one:

1. Relay the question and its options to the user (maps 1:1 onto
   AskUserQuestion). If the question text is long — a diff or a
   suggested merge — print it in full in the chat first, then ask with
   only the question line and the options. In an adoption diff, `+`
   lines are the user's local copy and `-` lines are the tracked
   revision.
2. Run `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs answer <question_id> --choice <option_id>` with the user's
   choice.

Pending questions survive interruption: an unanswered question reappears on
the next command until it is answered.

## Other commands

- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs install <skill>` — create an installation of a skill from its
  trunk.
- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs update [<skill>]` — merge the trunk's latest revision into an
  installation, preserving personalization.
- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs status` — show tracked skills, drift, and which skills the user
  owns (`(owner)`).
- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs revert [--to <snapshot>]` — restore an installation to its
  baseline; `--to <snapshot>` reaches a prior snapshot.
- `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs login [--local] [--email <email>] [--code <code>]` —
  authenticate with the Mica server; see [Connecting to Mica](#connecting-to-mica).
