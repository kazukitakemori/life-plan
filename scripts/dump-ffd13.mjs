import fs from 'fs';

const file =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts/ffd13f16-7a6b-461a-85c9-b193f138379d/ffd13f16-7a6b-461a-85c9-b193f138379d.jsonl';

const lines = fs.readFileSync(file, 'utf8').split('\n');
for (const idx of [15, 16, 28, 29]) {
  const j = JSON.parse(lines[idx]);
  for (const block of j.message?.content ?? []) {
    if (block.type !== 'tool_use') continue;
    const input = block.input ?? {};
    if (!input.path?.includes('App.tsx')) continue;
    console.log(`\n=== line ${idx} ===`);
    console.log('OLD:', (input.old_string ?? '').slice(0, 150));
    console.log('NEW:', (input.new_string ?? '').slice(0, 800));
  }
}
