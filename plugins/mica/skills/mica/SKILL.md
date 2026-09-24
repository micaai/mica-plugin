---
name: mica
description: Use when editing, personalizing, installing, sharing, updating, or contributing changes to agent skills in Claude Code or a Cowork connected folder. Use when the user edits a skill, asks to install or update one, or wants to share an improvement with its owner. Snapshots skill edits and manages updates and contributions through the mica CLI.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs *)
---

# Mica

## Run Mica commands

The command examples below are **arguments to the runner**, not commands on
`PATH`. Replace `<args>` with the shown arguments; do not type the brackets.

- **Claude Code:** run `node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs <args>` directly.
- **Cowork:** use the cloud-to-device runner below. The rendered
  `${CLAUDE_SKILL_DIR}/scripts/mica.cjs` is readable by cloud `Bash`, **not**
  by `device_bash`. Do not try the Claude Code command in `device_bash` or
  search for a plugin cache in the connected folder.

For **each Cowork invocation**:

1. In cloud `Bash`, run `sha256sum` on the rendered absolute cloud source
   `${CLAUDE_SKILL_DIR}/scripts/mica.cjs`. Record its current SHA-256 digest.
   If cloud `Bash` cannot read it, stop; never use an old cached digest.
2. In `device_bash`, list directories under `$HOME/mnt` to find connected
   folders. If there are none, ask the user to connect one. If there are
   several, ask which one to use. Do not select one from a prior session's
   path. Use `<selected mounted folder>/.mica/cli/<current-source-sha256>/mica.cjs`
   as the device CLI path.
3. On a cache miss, call `device_list_dir` on the selected mounted folder;
   use its absolute host `resolvedPath` **only** for the transfer destination.
   In `device_bash`, run `umask 077; mkdir -p -- "$FOLDER/.mica/cli/$SHA"`
   with `FOLDER` and `SHA` set as in step 5. In cloud `Bash`, run `umask 077`,
   copy the **file bytes** from the rendered source to
   `/mnt/user-data/outputs/mica-<current-source-sha256>.cjs`, and check
   that the staged file's SHA-256 matches the current source digest. Call
   `device_commit_files` with
   `{stagedPath: "/mnt/user-data/outputs/mica-<current-source-sha256>.cjs", devicePath: "<resolvedPath>/.mica/cli/<current-source-sha256>/mica.cjs"}`.
   Confirm the transfer succeeded; do not use a download link or a text
   copy.
4. In `device_bash`, set the device CLI file's mode to `0600`. If a cache
   file is corrupt or unreadable, do not run it or assume the transfer can
   overwrite it. With normal permission approval, remove **only** that exact
   file via `rm -f -- "$CLI"` in `device_bash`. If removal fails or permission
   is denied, stop. Then repeat the cache-miss transfer in step 3, including
   `device_list_dir`, and check the new file. Never remove credentials or
   use an older cache.
5. In **the same `device_bash` shell command**, check the current cloud
   digest against the device file before running the CLI. Run it with cwd
   and `CLAUDE_CONFIG_DIR` set to the selected mounted folder:

   ```sh
   FOLDER="$HOME/mnt/<selected-folder-name>"
   SHA="<current-source-sha256>"
   CLI="$FOLDER/.mica/cli/$SHA/mica.cjs"
   ACTUAL=$(sha256sum -- "$CLI" 2>/dev/null) && [ "${ACTUAL%% *}" = "$SHA" ] || {
     printf '%s\n' 'Mica CLI missing or hash mismatch; do not run.' >&2
     exit 1
   }
   cd "$FOLDER" || exit 1
   CLAUDE_CONFIG_DIR="$FOLDER" node "$CLI" <args>
   ```

   Replace the folder name, 64-character digest, and arguments with the
   values selected **for this invocation**. If the guard fails, use step 4;
   never run `node` without it. For example, replace `<args>` with `status`
   to run `status`. For every Cowork `login`, include `--local` (for example,
   `login --local --json`) so credentials persist under the connected folder;
   the CLI writes them with mode `0600`. Never print credentials, tokens,
   proxy values, or bundle bytes.

Mica tracks a skill's installation against its trunk on the server. It
snapshots local edits, merges upstream updates, and offers contributions back
to a skill's owner. This skill covers the same workflow the PostToolUse hook
handles automatically — use it when hooks are disabled, or when a command
other than a plain edit needs to run.

## When to snapshot

After ANY edit to a file under a tracked skill directory
(including `~/.claude/skills/<name>` and
`$CLAUDE_CONFIG_DIR/skills/<name>`), run `snapshot --intent "<goal>"`
through the runner. In Cowork, `$CLAUDE_CONFIG_DIR` is the selected connected
folder; snapshot after each edit because a hook may not run there.

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

- `publish <path>` is owner-only: it creates a skill's trunk or advances its
  head directly for everyone who uses it.
- `contribute` offers selected intent records from your personalization to
  the skill's owner for review.

Decide by fact, not by guess. `status` marks every installation the
user owns with `(owner)`. Owned → `publish`. Not owned → `contribute`.

Do NOT ask the user whether they own the skill, and do NOT infer ownership
from drift or from "tracked installation": an owner's own copy is also a
tracked installation, and it drifts whenever the owner edits it. If you did
not run `status` this session, run it before choosing.

If `publish` returns `not_owner`, run `contribute` instead.

## Contributing all or some intents

`contribute <skill>` with no flags is list mode: it returns the
contributable `intents` (each with an `id` and its intent text) and the
`unattributed` delta (edits not covered by any intent). It submits nothing.

Choose the flags from what the user asked for:

- "Share all my improvements" →
  `contribute <skill> --all`
  (every listed intent plus the unattributed delta).
- "Share only my X change" → first run list mode, match the intent text to
  the user's request, then
  `contribute <skill> --intents <id>[,<id>...]`
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
  `login --json --email <email>`.
- `code_required` — present `result.verification_uri` as a clickable
  **Connect Mica** link, and ask the user to open it and send back the code
  the page shows. Then run
  `login --json --code <code>`.
- `logged_in` — tell the user which email `result.email` names, then continue
  with the command the user originally asked for.

Rules:

- Ask in plain words. Do not show the user a shell command, and do not ask
  the user to run one.
- Pass `--email` or `--code`, never both in the same command.
- Pass `--code` only after a `code_required` status. `--code` alone fails
  when no login is waiting for a code.
- Run `login --json` with no email or code to see where a login stands: it
  repeats the saved link, or reports the logged-in email. Add `--local` in
  Cowork, as for every other login call.
- A `code_required` status with `result.retry_reason` means the code was
  rejected or is not confirmed yet. The login is still good: ask the user for
  the code again, against the same link, and run `--code` again. Do not
  restart with `--email`.
- Restart with `--email <email>` only when the link itself is dead or
  expired. That starts a new login and returns a new link.
- `say_to_user` is already worded for the user in every case — a first
  prompt, a resume, an unconfirmed code, and a rejected code each get their
  own sentence. Relay it as it stands.
- In Cowork, always add `--local` to every `login` invocation to keep
  credentials in the connected folder's `.mica` directory. In Claude Code,
  use it only when a wrapper or session brief tells you to.
- Never print or reveal credentials, tokens, assertions, or the contents of
  `.mica/credentials.json`. Hashing and running `.mica/cli/` files is allowed.
  Relay only the link, the status, and the email.

## Handling pending questions

Commands may return `questions` — server-held pending questions, each with a
`question_id` and options. For each one:

1. Relay the question and its options to the user (maps 1:1 onto
   AskUserQuestion). If the question text is long — a diff or a
   suggested merge — print it in full in the chat first, then ask with
   only the question line and the options. In an adoption diff, `+`
   lines are the user's local copy and `-` lines are the tracked
   revision.
2. Run `answer <question_id> --choice <option_id>` with the user's choice.

Pending questions survive interruption: an unanswered question reappears on
the next command until it is answered.

## Other commands

- `install <skill>` — create an installation of a skill from its trunk.
- `update [<skill>]` — merge the trunk's latest revision into an
  installation, preserving personalization.
- `status` — show tracked skills, drift, and which skills the user owns
  (`(owner)`).
- `revert [--to <snapshot>]` — restore an installation to its baseline;
  `--to <snapshot>` reaches a prior snapshot.
- `login [--local] [--email <email>] [--code <code>]` — authenticate with
  the Mica server; see [Connecting to Mica](#connecting-to-mica).
