const fs = require('fs');
const path = require('path');

const transcript = fs.readFileSync(
  'C:/Users/windm/.claude/projects/E--Web-build-SideM-Archived-web-viewer/a7a31ca0-115b-4b07-89ac-0696bec4d7ed.jsonl',
  'utf-8'
);

const lines = transcript.split('\n');
let found = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  try {
    const data = JSON.parse(line);
    if (data.type !== 'tool_use') continue;

    const msg = data.message || {};
    const content = msg.content || [];

    for (const block of content) {
      if (block.name === 'Write' && block.input && block.input.file_path && block.input.file_path.includes('ADV_STATE')) {
        const c = block.input.content || '';
        console.log(`Line ${i}: Write to ${block.input.file_path}, content length = ${c.length}`);
        fs.writeFileSync('/tmp/adv_restored.md', c, 'utf-8');
        console.log('SAVED to /tmp/adv_restored.md');
        found++;
      }
    }
  } catch (e) {
    // skip parse errors
  }
}

if (!found) {
  // Try nested tool_use format
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      const tu = data.tool_use;
      if (tu && tu.name === 'Write' && tu.input && tu.input.file_path && tu.input.file_path.includes('ADV_STATE')) {
        const c = tu.input.content || '';
        console.log(`Line ${i} (nested): Write, content length = ${c.length}`);
        fs.writeFileSync('/tmp/adv_restored.md', c, 'utf-8');
        console.log('SAVED');
        found++;
      }
    } catch (e) {}
  }
}

console.log(`Found ${found} Write tool calls`);
