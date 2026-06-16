import fs from 'fs';
import path from 'path';

const file =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts/fac64700-3f60-42d2-92b4-f65a5e218738/fac64700-3f60-42d2-92b4-f65a5e218738.jsonl';

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
        fs.writeFileSync('scripts/fac647-write-app.tsx', input.contents);
        console.log('Write at line', i, 'len', input.contents.length);
      }
      if (input.new_string && input.new_string.length > 500) {
        fs.writeFileSync(
          `scripts/fac647-patch-${i}.txt`,
          `OLD:\n${input.old_string}\n\nNEW:\n${input.new_string}`,
        );
        console.log('Large patch at line', i, 'new len', input.new_string.length);
      }
    }
  } catch {
    // ignore
  }
}
