#!/usr/bin/env node
// Claude Code PostToolUse hook for Edit|Write.
//
// Fires after the agent edits a file. If the file is inside the user's
// Claude Code skills root, this fires a fire-and-forget safety-net
// snapshot via the Mica CLI, then asks the agent to also record a
// stated intent for the edit.
//
// FAIL SILENT: any problem here (bad stdin, missing env, etc.) must exit 0
// with no output and no spawned process. A broken hook must never disturb
// a Claude Code session.

import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

function toForwardSlashes(path) {
  return path.split("\\").join("/");
}

function isInsideDirectory(filePath, directoryPath) {
  const normalizedFile = toForwardSlashes(filePath);
  const normalizedDirectory = toForwardSlashes(directoryPath).replace(/\/+$/, "");
  return normalizedFile.startsWith(`${normalizedDirectory}/`);
}

async function readStdin(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin(process.stdin);
  if (!raw.trim()) return;

  const payload = JSON.parse(raw);
  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return;

  const configDir = process.env.CLAUDE_CONFIG_DIR;
  const skillsRoot = configDir ? join(configDir, "skills") : join(homedir(), ".claude", "skills");

  if (!isInsideDirectory(filePath, skillsRoot)) return;

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (typeof pluginRoot !== "string" || pluginRoot.length === 0) return;

  const scriptPath = join(pluginRoot, "skills", "mica", "scripts", "mica.cjs");

  const child = spawn(process.execPath, [scriptPath, "snapshot"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  const additionalContext =
    "You just edited a Mica-tracked skill, and a background safety-net snapshot was already taken. " +
    `Now run \`node ${scriptPath} snapshot --intent "<goal>"\` with a one-line statement of the goal behind this edit.`;

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
      },
    })}\n`,
  );
}

main().catch(() => {
  // Fail silent: never let an exception escape with output or a nonzero exit.
});
