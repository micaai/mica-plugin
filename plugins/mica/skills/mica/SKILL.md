---
name: mica
description: Use when editing, personalizing, installing, sharing, updating, reverting, or contributing changes to agent skills in Claude Code or in a Cowork connected folder (`.claude/skills`). Use when the user edits a skill in the connected folder, asks to find, install, update, or revert one, asks about "my skills", Mica, a snapshot, or "what changed", or says "share this" to send an improvement to its owner. Snapshots skill edits and manages updates and contributions through the mica CLI in Claude Code or the Mica connector in Cowork.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs *)
---

# Mica

## Run Mica commands

Skills tracked by Mica live at `.claude/skills/<name>` inside the folder.
That is the only location Cowork loads skills from. `publish` takes a path
under it, for example `.claude/skills/my-skill`.

**Which surface you are on:** if you have a `device_bash` tool, you are in
Cowork; follow the Cowork steps. Otherwise you are in Claude Code: run
`node ${CLAUDE_SKILL_DIR}/scripts/mica.cjs <args>` directly, as before.
Do not decide by whether that file exists; in Cowork it exists where
`device_bash` cannot reach it.

**Cowork.** Mica runs on its server. One connector call per session sets up
a runner in the sandbox; after that, every command is one `device_bash`
call.

1. Once per session, pick the folder. Run `ls -d "$HOME"/mnt/*` in
   `device_bash`; that prints each connected folder's absolute mount path.
   If several are mounted, ask which one. Call `device_list_dir` on the
   chosen mount path and keep its `resolvedPath`.
2. Once per session, call the `mica` connector tool with your first command
   and the fields that command uses (for example `command: "status"`, or
   `command: "snapshot", intent: "Always answer in French"`), plus
   `mount_path` (from step 1) and `connected_folder` (the `resolvedPath`).
   Run the returned `run` line in `device_bash` exactly as returned. Do not
   edit it. It installs `"$HOME/.mica/run"` and runs that first command.
3. For every later command in this session, run
   `"$HOME/.mica/run" <args>` in `device_bash`, for example
   `"$HOME/.mica/run" update --all` or
   `"$HOME/.mica/run" snapshot --intent "Always answer in French"`. Use the
   command vocabulary below. Do not call the connector tool again unless
   step 4 says so.
4. Go back to step 2 when `"$HOME/.mica/run"` is missing or its output
   starts with `mica: session expired`. Go back to step 1 when the user
   wants to work on a different connected folder.
5. Read the output. The first line is `mica_write: ok`, `write_failed`, or
   `verify_failed`; it says whether changed files landed in the folder. The
   rest is the JSON envelope: read `say_to_user`, `questions`, and
   `next_actions` as before. On `write_failed` or `verify_failed`, tell the
   user and run `status`.
6. If `result.deleted` lists paths, delete those files with your file tool;
   Cowork asks the user first, which is correct. Only `update`, `revert`,
   `restore`, and `answer` can list paths there.
7. After `install`, tell the user the new skill becomes usable in their
   next Cowork session. Updates to a skill they already have take effect at once.
8. If the connector tool is unavailable or returns an authentication error,
   ask the user to connect the Mica connector from the plugin's Connectors
   tab. There is no email or code step.

Give each tool call a short, plain description, for example "Check Mica
status". Never print the `run` line, the contents of `"$HOME/.mica/run"`,
environment variables, or tokens in chat.

Mica tracks a skill's installation against its trunk on the server. It
snapshots local edits, merges upstream updates, and offers contributions back
to a skill's owner. This skill covers the same workflow the PostToolUse hook
handles automatically — use it when hooks are disabled, or when a command
other than a plain edit needs to run.

## When to snapshot

After ANY edit to a file under a tracked skill directory
(including `~/.claude/skills/<name>` in Claude Code and
`<folder>/.claude/skills/<name>` in Cowork), run `snapshot --intent "<goal>"`
with `"$HOME/.mica/run" snapshot --intent "<goal>"` in Cowork, or the CLI in
Claude Code. In Cowork, snapshot after each edit because a hook may not run
there.

Every Mica command except `search` snapshots all
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
changes nothing. A residual (`r4.x`) holds the part of a revision that no single
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

A `merge_conflict` question that starts with `Refusing "..."`
means `keep-mine` refuses every upstream change in that file, not only the one
the user chose.

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
  upstream changes and take none; `--all` takes them all, `--refuse <ids>`
  takes all but the listed changes.
- `status [--history]` — show tracked skills, drift, and which skills the user owns
  (`(owner)`); `--history` lists snapshot ids, newest first, to pass to `revert --to`.
- `revert [--to <snapshot>]` — restore an installation to its baseline;
  `--to <snapshot>` reaches a prior snapshot.
