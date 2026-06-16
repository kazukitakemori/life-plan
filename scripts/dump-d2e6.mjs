import fs from 'fs';

const file =
  'C:/Users/best03/.cursor/projects/c-Users-best03-Life-plan/agent-transcripts/d2e6f675-2a86-4936-8e65-85e2431b8ef5/d2e6f675-2a86-4936-8e65-85e2431b8ef5.jsonl';

const lines = fs.readFileSync(file, 'utf8').split('\n');
for (let idx = 0; idx < lines.length; idx++) {
  if (!lines[idx].includes('App.tsx')) continue;
  try {
    const j = JSON.parse(lines[idx]);
    for (const block of j.message?.content ?? []) {
      if (block.type !== 'tool_use') continue;
      const input = block.input ?? {};
      if (!input.path?.includes('App.tsx') || !input.new_string) continue;
      if (
        input.new_string.includes('life-event') ||
        input.new_string.includes('lifeEventState') ||
        input.new_string.includes('syncLifeEvents')
      ) {
        console.log(`\n=== line ${idx} ===`);
        console.log('OLD:', (input.old_string ?? '').slice(0, 120));
        console.log('NEW:', input.new_string.slice(0, 1200));
      }
    }
  } catch {
    // ignore
  }
}
