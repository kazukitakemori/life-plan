import fs from 'fs';
import path from 'path';

const transcriptRoot =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts';

const patches = [];

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
        if (input.contents) {
          patches.push({
            mtime: stat.mtimeMs,
            dir,
            line: i,
            type: 'WRITE',
            preview: input.contents.slice(0, 80).replace(/\n/g, ' '),
            len: input.contents.length,
          });
        } else if (input.old_string) {
          patches.push({
            mtime: stat.mtimeMs,
            dir,
            line: i,
            type: 'PATCH',
            preview: input.old_string.slice(0, 100).replace(/\n/g, ' '),
            newPreview: input.new_string.slice(0, 100).replace(/\n/g, ' '),
          });
        }
      }
    } catch {
      // ignore
    }
  }
}

patches.sort((a, b) => a.mtime - b.mtime || a.line - b.line);
for (const p of patches) {
  console.log(
    new Date(p.mtime).toISOString().slice(0, 10),
    p.dir.slice(0, 8),
    p.type,
    p.len ?? '',
    p.preview,
  );
  if (p.newPreview) console.log('  ->', p.newPreview);
}
