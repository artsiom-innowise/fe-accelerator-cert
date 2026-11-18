// Appends prompts (UserPromptSubmit), role hand-offs (PreToolUse on Agent) and turn/role results (Stop/SubagentStop)
// to workflow-evidence/prompt-log.jsonl as runtime-transcript evidence (EVIDENCE_PROTOCOL.md §2/§3).
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
// Claude Code's internal helpers (e.g. next-prompt suggestion) stop with an empty agent_type; not real roles.
if (input.hook_event_name === "SubagentStop" && !input.agent_type) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;

function git(args) {
  try { return execSync(`git ${args}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString(); }
  catch { return null; }
}

function lastAssistantText(path) {
  try {
    for (const line of readFileSync(path, "utf8").trim().split("\n").reverse()) {
      const entry = JSON.parse(line);
      if (entry.type !== "assistant") continue;
      const text = entry.message?.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      if (text) return text;
    }
  } catch {}
  return null;
}

const entry = {
  time: new Date().toISOString(),
  event: input.hook_event_name,
  session: input.session_id,
  gitHead: git("rev-parse --short HEAD")?.trim() ?? null,
  // the log file itself is always dirty; leave it out so the list shows real work
  dirty: git("status --porcelain")?.split("\n").filter((l) => l && !l.endsWith("workflow-evidence/prompt-log.jsonl")) ?? null,
};
if (input.hook_event_name === "UserPromptSubmit") {
  entry.prompt = input.prompt;
} else if (input.hook_event_name === "PreToolUse") {
  entry.agent = input.tool_input?.subagent_type ?? null;
  entry.task = input.tool_input?.prompt ?? null;
} else {
  entry.agent = input.agent_type ?? (input.hook_event_name === "Stop" ? "main" : null);
  entry.stopHookActive = input.stop_hook_active ?? false;
  entry.response = input.last_assistant_message ?? lastAssistantText(input.agent_transcript_path ?? input.transcript_path);
}

mkdirSync(join(root, "workflow-evidence"), { recursive: true });
appendFileSync(join(root, "workflow-evidence", "prompt-log.jsonl"), JSON.stringify(entry) + "\n");
// keep tasks/<TASK>/workflow-log.md in sync; a render failure must never break logging
try { await import("./workflow-log.mjs"); } catch {}
