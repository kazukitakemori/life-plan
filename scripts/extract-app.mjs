import fs from 'fs';
import path from 'path';

const transcriptRoot =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts';

let latestWrite = null;

for (const dir of fs.readdirSync(transcriptRoot)) {
  const file = path.join(transcriptRoot, dir, `${dir}.jsonl`);
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.includes('App.tsx')) continue;
    try {
      const j = JSON.parse(line);
      const blocks = j.message?.content ?? [];
      for (const block of blocks) {
        if (block.type !== 'tool_use') continue;
        const input = block.input ?? {};
        if (
          input.path?.includes('App.tsx') &&
          input.contents &&
          input.contents.includes('export default function App')
        ) {
          latestWrite = { dir, contents: input.contents, lineLen: line.length };
        }
      }
    } catch {
      // ignore
    }
  }
}

if (latestWrite) {
  console.log('Found Write in', latestWrite.dir, 'length', latestWrite.contents.length);
  fs.writeFileSync('scripts/extracted-app.tsx', latestWrite.contents);
} else {
  console.log('No Write found');
}
