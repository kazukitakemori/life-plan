import fs from 'fs';
import path from 'path';

const transcriptRoot =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts';

const events = [];

for (const dir of fs.readdirSync(transcriptRoot)) {
  const file = path.join(transcriptRoot, dir, `${dir}.jsonl`);
  if (!fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('App.tsx')) continue;
    try {
      const j = JSON.parse(line);
      const blocks = j.message?.content ?? [];
      for (const block of blocks) {
        if (block.type !== 'tool_use') continue;
        const input = block.input ?? {};
        if (!input.path?.includes('App.tsx')) continue;
        events.push({
          mtime: stat.mtimeMs,
          dir,
          line: i,
          op: input.contents ? 'write' : 'replace',
          input,
        });
      }
    } catch {
      // ignore
    }
  }
}

events.sort((a, b) => a.mtime - b.mtime || a.line - b.line);

let content = null;
let applied = 0;

for (const ev of events) {
  if (ev.op === 'write') {
    content = ev.input.contents;
    applied++;
    continue;
  }
  if (!content) continue;
  const { old_string, new_string } = ev.input;
  if (!old_string || new_string === undefined) continue;
  if (!content.includes(old_string)) {
    console.warn('SKIP (old_string not found):', ev.dir, 'line', ev.line);
    continue;
  }
  content = content.replace(old_string, new_string);
  applied++;
}

console.log('Events:', events.length, 'Applied:', applied);
if (content) {
  fs.writeFileSync('scripts/reconstructed-app.tsx', content);
  console.log('Length:', content.length, 'lines:', content.split('\n').length);
}
