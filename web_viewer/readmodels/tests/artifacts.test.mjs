import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs/promises'; import os from 'node:os'; import path from 'node:path';
import { writeReadModels } from '../lib/projections.mjs';
import { ArtifactWriter, createOutput, jsonBytes } from '../lib/common.mjs';
import { verifyArtifacts } from '../tools/verify_artifacts.mjs';
import { fixture } from './fixture.mjs';
const release = 'a'.repeat(64);
const temp = () => fs.mkdtemp(path.join(os.tmpdir(), 'gs-kit-test-'));

test('Core products preserve details, keep catalogs thin, and close descriptors', async () => {
  const dir = await temp();
  try {
    const p = fixture(); const { bootstrap, report } = await writeReadModels(dir, release, p, { fixture:true });
    await fs.writeFile(path.join(dir,'BUILD_COMPLETE.json'),jsonBytes({release}));
    const verified = await verifyArtifacts(dir); assert.equal(verified.verified, report.artifactFiles);
    assert.ok(report.bootstrapDecodedBytes < 64 * 1024); assert.equal(bootstrap.counts.canonical_cards, 3);
    const home = report.artifacts.find(a => a.kind === 'home.cues');
    const homeBody=JSON.parse(await fs.readFile(path.join(dir,'pages',home.url.slice(1)),'utf8'));
    assert.equal(homeBody.data.rows[0].previewStep.step_id,7);
    const cardPage = report.artifacts.find(a => a.kind === 'cards.page');
    const body=JSON.parse(await fs.readFile(path.join(dir,'pages',cardPage.url.slice(1)),'utf8'));
    assert.ok(!JSON.stringify(body).includes('preview_step')); assert.ok(!JSON.stringify(body).includes('home_voice_cues'));
    const story = report.artifacts.find(a => a.kind === 'stories.detail');
    const storyBody=JSON.parse(await fs.readFile(path.join(dir,'pages',story.url.slice(1)),'utf8'));
    assert.equal(storyBody.data.story.episodes[0].local_playable_start_index,3); assert.equal(storyBody.data.story.releaseAt,null);
    await fs.appendFile(path.join(dir,'pages',story.url.slice(1)),' ');
    await assert.rejects(verifyArtifacts(dir),/Artifact drift/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('Synthetic 30 MB card database is not embedded into bootstrap or directory pages', async () => {
  const dir=await temp();
  try {
    const p=fixture({cards:1000,padding:33000,idols:49});
    assert.ok(jsonBytes(p.cards).length > 30 * 1024 * 1024);
    const {report}=await writeReadModels(dir,release,p,{fixture:true});
    assert.ok(report.bootstrapDecodedBytes < 32 * 1024);
    for(const item of report.artifacts.filter(a=>a.kind==='cards.page')) assert.ok(item.bytes<192*1024);
    assert.ok(report.artifactFiles < 9000);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('Large global story search remains complete across bounded pages', async () => {
  const dir = await temp();
  try {
    const p = fixture();
    p.stories = Array.from({ length: 400 }, (_, i) => ({
      ...p.stories[0], id: `story:${i}`, file: `story-${i}.json`, title: `Story ${i} ${'x'.repeat(2500)}`,
    }));
    const { bootstrap } = await writeReadModels(dir, release, p, { fixture: true });
    const index = JSON.parse(await fs.readFile(path.join(dir, 'pages', bootstrap.domains.stories.url.slice(1)), 'utf8'));
    assert.ok(index.data.searchPages.length > 1);
    const rows = [];
    for (const descriptor of index.data.searchPages) {
      const page = JSON.parse(await fs.readFile(path.join(dir, 'pages', descriptor.url.slice(1)), 'utf8'));
      rows.push(...page.data.rows);
      assert.ok(descriptor.bytes <= 192 * 1024);
    }
    assert.equal(rows.length, index.data.searchCount);
    assert.deepEqual(rows.map(row => row.id), p.stories.map(story => story.id));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('Oversized and duplicate output is rejected instead of silently increasing budgets', async () => {
  const dir=await temp(); try {
    const w=new ArtifactWriter(dir,release);
    await assert.rejects(w.emit('huge.json','test','x'.repeat(800*1024)),/RAW_BUDGET/);
    await w.emit('one.json','test',1); await assert.rejects(w.emit('one.json','test',2),/EEXIST/);
    await assert.rejects(w.emit('../bad.json','test',1),/Unsafe/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('Output safety refuses source tree and pre-existing directories', async () => {
  const dir=await temp(); try {
    await fs.mkdir(path.join(dir,'repo')); await fs.mkdir(path.join(dir,'existing'));
    await assert.rejects(createOutput(path.join(dir,'repo','out'),[path.join(dir,'repo')]),/outside source/);
    await assert.rejects(createOutput(path.join(dir,'existing')),/EEXIST/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
