import fs from 'fs';

const file =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts/fac64700-3f60-42d2-92b4-f65a5e218738/fac64700-3f60-42d2-92b4-f65a5e218738.jsonl';

const lines = fs.readFileSync(file, 'utf8').split('\n');
let n = 0;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].includes('App.tsx')) continue;
  try {
    const j = JSON.parse(lines[i]);
    for (const block of j.message?.content ?? []) {
      if (block.type !== 'tool_use') continue;
      const input = block.input ?? {};
      if (!input.path?.includes('App.tsx') || !input.old_string) continue;
      n++;
      fs.writeFileSync(
        `scripts/fac647-all-${n}.txt`,
        `=== PATCH ${n} line ${i} ===\nOLD:\n${input.old_string}\n\nNEW:\n${input.new_string}`,
      );
    }
  } catch {
    // ignore
  }
}
console.log('Wrote', n, 'patches');
