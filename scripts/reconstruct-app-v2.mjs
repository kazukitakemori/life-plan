import fs from 'fs';
import path from 'path';

const transcriptRoot =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts';

const events = [];
let bestWrite = null;

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
      for (const block of j.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        const input = block.input ?? {};
        if (!input.path?.includes('App.tsx')) continue;
        const ev = { mtime: stat.mtimeMs, dir, line: i, input };
        events.push(ev);
        if (input.contents?.includes('export default function App')) {
          if (!bestWrite || ev.mtime >= bestWrite.mtime) {
            bestWrite = { ...ev, len: input.contents.length };
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

events.sort((a, b) => a.mtime - b.mtime || a.line - b.line);

console.log('Best write:', bestWrite?.dir, 'len', bestWrite?.len);
let content = bestWrite?.input.contents ?? null;
let applied = bestWrite ? 1 : 0;
const writeTime = bestWrite?.mtime ?? 0;

for (const ev of events) {
  if (ev.mtime < writeTime) continue;
  if (ev.input.contents) {
    if (ev.mtime > writeTime || (ev.mtime === writeTime && ev.line > bestWrite.line)) {
      content = ev.input.contents;
      applied++;
    }
    continue;
  }
  if (!content) continue;
  const { old_string, new_string } = ev.input;
  if (!old_string || new_string === undefined) continue;
  if (!content.includes(old_string)) continue;
  content = content.replace(old_string, new_string);
  applied++;
}

console.log('Applied:', applied, 'Final len:', content?.length, 'lines:', content?.split('\n').length);
if (content) fs.writeFileSync('scripts/reconstructed-app-v2.tsx', content);
