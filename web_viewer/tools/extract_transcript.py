import json

with open('C:/Users/windm/.claude/projects/E--Web-build-SideM-Archived-web-viewer/a7a31ca0-115b-4b07-89ac-0696bec4d7ed.jsonl', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    try:
        data = json.loads(line)
    except:
        continue
    if not isinstance(data, dict):
        continue

    if data.get('type') != 'tool_use':
        continue

    msg = data.get('message', {})
    if not isinstance(msg, dict):
        continue

    content_blocks = msg.get('content', [])
    if not isinstance(content_blocks, list):
        continue

    for block in content_blocks:
        if not isinstance(block, dict):
            continue
        if block.get('name') == 'Write':
            inp = block.get('input', {})
            fp = inp.get('file_path', '')
            if 'ADV_STATE' in fp:
                c = inp.get('content', '')
                print(f"Line {i}: Write to {fp}, content length={len(c)}")
                with open('/tmp/adv_restored.md', 'w', encoding='utf-8') as fout:
                    fout.write(c)
                print("SAVED to /tmp/adv_restored.md")
