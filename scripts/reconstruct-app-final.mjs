import fs from 'fs';
import path from 'path';

const transcriptRoot =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts';

function norm(s) {
  return s.replace(/\r\n/g, '\n');
}

const events = [];

for (const dir of fs.readdirSync(transcriptRoot)) {
  const file = path.join(transcriptRoot, dir, `${dir}.jsonl`);
  if (!fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('App.tsx')) continue;
    try {
      const j = JSON.parse(lines[i]);
      for (const block of j.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        const input = block.input ?? {};
        if (!input.path?.includes('App.tsx')) continue;
        events.push({ mtime: stat.mtimeMs, dir, line: i, input });
      }
    } catch {
      // ignore
    }
  }
}

events.sort((a, b) => a.mtime - b.mtime || a.line - b.line);

let content = null;
let applied = 0;
let skipped = 0;
const skipLog = [];

for (const ev of events) {
  const input = ev.input;
  if (input.contents) {
    content = norm(input.contents);
    applied++;
    continue;
  }
  if (!content) continue;
  const old_string = norm(input.old_string ?? '');
  const new_string = norm(input.new_string ?? '');
  if (!old_string || new_string === undefined) continue;
  if (!content.includes(old_string)) {
    skipped++;
    skipLog.push(`${ev.dir}:${ev.line} ${old_string.slice(0, 60).replace(/\n/g, ' ')}`);
    continue;
  }
  content = content.replace(old_string, new_string);
  applied++;
}

console.log('Applied:', applied, 'Skipped:', skipped, 'Lines:', content?.split('\n').length);
if (content) fs.writeFileSync('scripts/final-reconstructed-app.tsx', content);
if (skipped > 0) {
  fs.writeFileSync('scripts/skip-log.txt', skipLog.join('\n'));
  console.log('First 10 skips:');
  skipLog.slice(0, 10).forEach((s) => console.log(s));
}
