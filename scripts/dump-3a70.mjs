import fs from 'fs';

const file =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts/3a70af76-a10d-4ff6-86e0-ce2c7ad2f5a4/3a70af76-a10d-4ff6-86e0-ce2c7ad2f5a4.jsonl';

const line = fs.readFileSync(file, 'utf8').split('\n')[31];
const j = JSON.parse(line);
for (const block of j.message.content) {
  if (block.type !== 'tool_use') continue;
  const input = block.input ?? {};
  if (!input.path?.includes('App.tsx')) continue;
  console.log('--- PATCH ---');
  console.log('OLD:', input.old_string?.slice(0, 200));
  console.log('NEW:', input.new_string?.slice(0, 500));
  if (input.new_string?.includes('cashFlowData')) {
    fs.writeFileSync('scripts/cashflow-patch.txt', input.new_string);
  }
}
