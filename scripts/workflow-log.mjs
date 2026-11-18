// Rebuilds the role table in tasks/<latest TASK-NNN>/workflow-log.md from workflow-evidence/prompt-log.jsonl
// (EVIDENCE_PROTOCOL.md §3). Only the block between the markers is generated; everything else is hand-written.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const START = "<!-- workflow-table:start (generated from workflow-evidence/prompt-log.jsonl, do not edit) -->";
const END = "<!-- workflow-table:end -->";

// shortcut: one task per assessment, rows start at the first requirements-analyst call; segment by task if you run several.
const task = existsSync(join(root, "tasks")) && readdirSync(join(root, "tasks")).filter((d) => /^TASK-\d+$/.test(d)).sort().at(-1);
if (!task) process.exit(0);

const lines = readFileSync(join(root, "workflow-evidence", "prompt-log.jsonl"), "utf8").trim().split("\n").map((l, i) => ({ ...JSON.parse(l), line: i + 1 }));
const turns = [];
for (const e of lines) {
  if (e.event === "UserPromptSubmit") turns.push({ prompt: e, events: [] });
  else turns.at(-1)?.events.push(e);
}

const cell = (s, n = 160) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
  return t.length > n ? t.slice(0, n) + "…" : t || "—";
};
const artifacts = (text) => [...new Set(text?.match(/tasks\/TASK-\d+\/[\w./-]+\.\w+/g) ?? [])].map((p) => `\`${p}\``).join(", ");

const rows = [];
let started = false;
turns.forEach((turn, i) => {
  const slash = turn.prompt.prompt.match(/^\/([\w-]+)/)?.[1];
  const roles = turn.events.filter((e) => e.event === "SubagentStop");
  // a /role command that ran inline (no subagent) still counts as one role row, using the main reply
  if (!roles.length && slash) roles.push({ ...turn.events.findLast((e) => e.event === "Stop"), agent: slash });
  started ||= roles.some((r) => r.agent === "requirements-analyst");
  if (!started) return;
  const next = turns[i + 1]?.prompt.prompt;
  for (const r of roles) {
    const pre = turn.events.findLast((e) => e.event === "PreToolUse" && e.agent === r.agent && e.line < (r.line ?? Infinity));
    const out = [artifacts(r.response ?? r.summary), r.line && `log L${r.line}`].filter(Boolean).join("; ");
    rows.push(`| ${r.time ?? turn.prompt.time} | ${r.agent} | ${cell(pre?.task ?? turn.prompt.prompt)} | ${out || "—"} | ${/\bSTOP/.test(r.response ?? r.summary ?? "") ? "yes" : "not detected"} | ${next ? cell(next, 100) : "pending"} |`);
  }
});

const table = [START, "| Time | Role | Input summary | Output/evidence | STOP observed | Developer-selected next action |", "| --- | --- | --- | --- | --- | --- |", ...rows, END].join("\n");
const file = join(root, "tasks", task, "workflow-log.md");
const header = `# Workflow Log: ${task}

<!-- Hand-written by the developer (EVIDENCE_PROTOCOL.md §3); agents transcribe these values, never infer them. -->
- Task identifier: ${task}
- Assessment starting commit:
- Start / finish (developer-recorded):
- Substantial breaks:
- Active time / calendar time:
- Time values transcribed, not inferred: yes / no
- Runtime and accelerator version:
- Install and setup method:
- Doctor result and runtime hook status:
- Planning checkpoint commit (before coder):

## Roles

Full prompts, role tasks and responses: \`workflow-evidence/prompt-log.jsonl\` (log L = line number).

`;
const current = existsSync(file) ? readFileSync(file, "utf8") : header + START + "\n" + END + "\n\n## Skipped or invoked contextual roles\n\n- \n";
const next = current.includes(START) && current.includes(END)
  ? current.slice(0, current.indexOf(START)) + table + current.slice(current.indexOf(END) + END.length)
  : current + "\n" + table + "\n";
if (next !== current) writeFileSync(file, next);
