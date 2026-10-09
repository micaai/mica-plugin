---
name: mica
description: Use when editing, personalizing, installing, sharing, updating, or contributing changes to agent skills in Claude Code or a Cowork connected folder. Use when the user edits a skill, asks to find, install, or update one, or wants to share an improvement with its owner. Snapshots skill edits and manages updates and contributions through the mica CLI.
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

Give each runner tool call a short, plain description for a non-technical
user, for example "Check the Mica version", "Copy Mica to your folder (one
time)", or "Run Mica status". Do not mention hashes, digests, or caches in
these descriptions.

1. In cloud `Bash`, run `sha256sum` on the rendered absolute cloud source
   `${CLAUDE_SKILL_DIR}/scripts/mica.cjs`. Record its current SHA-256 digest.
   If cloud `Bash` cannot read it, stop; never use an old cached digest.
2. In `device_bash`, list directories under `$HOME/mnt` to find connected
   folders. If there are none, ask the user to connect one. If there are
   several, ask which one to use. Do not select one from a prior session's
   path. Use `<selected mounted folder>/.mica/cli/<current-source-sha256>/mica.cjs`
   as the device CLI path. Then call `device_list_dir` on the selected
   mounted folder, **also on a cache hit**, and record its absolute host
   `resolvedPath` for this invocation. Never take it from a prior session,
   from `ls`, or from a `/sessions/...` path.
3. On a cache miss, use the `resolvedPath` from step 2 for the transfer
   destination, never as a device CLI path. The delete policy below also
   uses `resolvedPath`. In `device_bash`, run
   `umask 077; mkdir -p -- "$FOLDER/.mica/cli/$SHA"` with `FOLDER` and `SHA`
   set as in step 5. In cloud `Bash`, copy the **file bytes** with `cp` from
   the rendered source to
   `/mnt/user-data/outputs/mica-<current-source-sha256>.cjs`. If `cp` fails,
   stop. Do not hash the staged copy: the step 5 guard checks the bytes on
   the device. Call
   `device_commit_files` with
   `{stagedPath: "/mnt/user-data/outputs/mica-<current-source-sha256>.cjs", devicePath: "<resolvedPath>/.mica/cli/<current-source-sha256>/mica.cjs"}`.
   Confirm the transfer succeeded; do not use a download link or a text
   copy.
4. In `device_bash`, set the device CLI file's mode to `0600`. If a cache
   file is corrupt or unreadable, do not run it or assume the transfer can
   overwrite it. After user approval under the Cowork delete policy below,
   remove **only** that exact file via `rm -f -- "$CLI"` in `device_bash`.
   If removal fails or permission is denied, stop. Then repeat the cache-miss
   transfer in step 3, including `device_list_dir`, and check the new file.
   Never remove credentials or use an older cache.
5. In **the same `device_bash` shell command**, check the current cloud
   digest against the device file before running the CLI. Run it with cwd
   and `CLAUDE_CONFIG_DIR` set to the selected mounted folder:

   ```sh
   FOLDER="$HOME/mnt/<selected-folder-name>"; SHA="<current-source-sha256>"; CLI="$FOLDER/.mica/cli/$SHA/mica.cjs"
   cd "$FOLDER" && echo "$SHA  $CLI" | sha256sum -c - >/dev/null &&
     CLAUDE_CONFIG_DIR="$FOLDER" node "$CLI" <args> --connected-folder "<resolvedPath>"
   ```

   Keep the two spaces between `$SHA` and `$CLI`. If the file is missing or
   its digest does not match, `sha256sum` prints an error, the command exits
   with a non-zero status, and `node` does not run.

   Replace the folder name, 64-character digest, `resolvedPath`, and
   arguments with the values selected **for this invocation**. Always add
   `--connected-folder` in Cowork: Mica then records installation paths
   against the persistent host folder, not against this session's mount.
   If the guard fails, use step 4; never run `node` without it. For example, replace `<args>` with `status`
   to run `status`. For every Cowork `login`, include `--local` (for example,
   `login --local --json`) so credentials persist under the connected folder;
   the CLI writes them with mode `0600`. Never print credentials, tokens,
   proxy values, or bundle bytes.

If `status` reports that a skill is recorded outside the selected connected
folder (`install_path` is `null`; `recorded_path` names an old session path
or another folder), tell the user. If its directory is in this folder,
usually `skills/<skill>`, and the user agrees, run `relink <skill> skills/<skill>`
once. Never relink to a directory in another connected folder.

### Cowork delete permission

Run ordinary commands without asking for delete permission, and never ask for
a grant before a command. In particular, run `status` with a valid access
token without a permission request. A Mica command that writes or removes
files can need the grant.

If a CLI command other than `answer` fails with `EPERM`, the command changed nothing.
Explain that the grant covers **the entire selected connected folder, including `.mica`,
for the rest of this session**, not only the path in the error. Ask the user to approve
that scope. On approval, call `device_list_dir` on the **currently selected mounted
folder**, even on a CLI cache hit, and take its exact host `resolvedPath`. Check that
it names that folder's root, not its parent, a subfolder, or another connected folder.
Call `device_request_delete_permission({paths:[resolvedPath],reason:"Allow Mica to replace or remove skill files during update and revert; permission covers the entire selected connected folder, including .mica, for the rest of this session."})`.
Check that the tool response grants deletion for **exactly that root** in this session.
Then retry the **same complete step 5 command**, including its same-shell hash guard,
cwd, environment and arguments, **once**. On decline, an unavailable tool, a wider
grant, an `EPERM` on a path outside the selected folder, or a failed retry, stop. Do
not save a permission marker for later sessions. A verified grant in this session
remains valid until the session ends.

If `answer` fails with `EPERM`, do not retry it: the server can have recorded
the answer while the file on disk was not written. Stop and tell the user.

Never inspect credentials. During permission handling, do not read or print
credential file contents, access or refresh tokens, assertions, or proxy
credentials. Ordinary skill content and diffs can be read and shown.

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

Every Mica command except `login` and `search` snapshots all
installations first. When in doubt, snapshot.

## How to phrase `--intent`

One sentence, stating the user's goal behind the edit — the WHY, not a
description of the diff.

- Good: `"Always answer in French for this user"`
- Bad: `"changed line 12 of SKILL.md"`

Record one intent per distinct goal. If an edit serves two goals, make two
snapshots rather than bundling them into one intent.

## Publish vs contribute

- `publish <path>` creates a new skill and its first revision. Use it only for
  a skill the server does not know: run `search` first. If `publish` returns
  `skill_exists`, run `contribute` instead.
- `contribute` is the only way to change a skill that has a trunk, including
  one you own. It offers selected intent records from your personalization
  to the skill's owner for review.

Decide by fact, not by guess. If `search` finds no skill of that name,
`publish`. Otherwise `contribute`. Do NOT ask the user whether they own the
skill.

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

If the list says `role: owner`, select every intent unless the user names
some. The candidate lands on the trunk when you submit.

A successful call returns a confirm question (submit / cancel); relay it as
usual. After `answer <question_id> --choice submit`, read the result line:

- `Revision <n> is live.` — report that revision to the user.
- `Your copy is behind revision <n>; run update --all.` — offer to run `update --all`.
- `The trunk moved while you confirmed. Run contribute again.` — run
  `contribute` again with the same intents.

A subset can return one or more blocking `merge_conflict` questions. Each
question names the intent that the server adds and the file. The options are:

- "Use the trunk head's lines at each conflict; keep other changes": the
  trunk head wins only on the lines that conflict. Other changes from both
  sides stay.
- "Use my lines at each conflict; keep other changes": your lines win only on
  the lines that conflict. Other changes from both sides stay.
- "Take suggested": the trunk head plus only that intent. This option is
  present only when the server returns a suggestion.

Relay the question text, including the suggested merge. Let the user choose.
Do not answer for the user.

## Updating all or some changes

`update <skill>` with no flags is list mode: it returns the upstream changes
grouped by revision, each with an `id` (for example `r4.1`) and its text. It
applies nothing. A residual (`r4.x`) holds the part of a revision that no single
intent accounts for.

Choose the flags from what the user asked for:

- "Update", "get the latest" → `update <skill> --all` (or `update --all` for
  every skill). Do not list first.
- "What's new", "show me first", "update but skip X" → run list mode. Relay the
  list as **one** `AskUserQuestion` with `multiSelect: true`, every change
  pre-selected, and the revision summary as the header. A `risky` mark goes in
  the option description with "security floor will ask again". A `touches yours`
  mark says "edits lines you personalized". Then run
  `update <skill> --refuse <unselected ids>` (comma- or space-separated), or
  `update <skill> --all` when nothing was unselected.
- Never ask one question per change. Never answer for the user.

If the result says `The trunk moved while you chose. Run update <skill> again.`,
run list mode again and ask only if the list changed.

A `merge_conflict` question that says `Refusing "..." does not apply cleanly`
means `keep-mine` refuses every upstream change in that file, not only the one
the user chose.

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

- A `merge_conflict` question from `update` means the file is still at the
  user's version; answer it to finish the update. A `semantic_flag` or
  `inferred_intent` question is about a change already on disk.
- For `edited`: edit the file, run `snapshot --intent "<goal>"`, then answer.
  The server rejects `edited` when the file did not change.
- Never answer for the user. Relay the options as written; a plain "yes" to a
  `merge_conflict` means `take-upstream`.

## Find a skill to install

If the user names a skill but you do not know its exact name, search first:
`search <words> [--owner <name>]`.

`search` matches each word against skill names and descriptions in the
user's organization. `--owner` matches the owner's name or email; pass the
name without "'s". For "install Bob's code review skill", run
`search code review --owner Bob`. Each result line starts with the skill
name to pass to `install <skill>`.

If one skill matches, install it. If more than one matches, show the list and
ask the user which one to install. If none match, search with fewer words, or
run `search` with no arguments to list every skill.

## Other commands

- `search [<words>...] [--owner <name>]` — find a skill's exact name
  by words in its name or description, or by its owner.
- `install <skill>` — create an installation of a skill from its trunk.
- `update [<skill>] [--all | --refuse <ids>]` — with no flags, list the
  upstream changes and apply none; `--all` applies them all, `--refuse <ids>`
  applies all but the listed changes.
- `status [--history]` — show tracked skills, drift, and which skills the user owns
  (`(owner)`); `--history` lists snapshot ids, newest first, to pass to `revert --to`.
- `revert [--to <snapshot>]` — restore an installation to its baseline;
  `--to <snapshot>` reaches a prior snapshot.
- `login [--local] [--email <email>] [--code <code>]` — authenticate with
  the Mica server; see [Connecting to Mica](#connecting-to-mica).
