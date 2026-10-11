import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
import {renderToString} from '@vue/server-renderer';
import {createSSRApp} from 'vue';

const server=await createServer({configFile:false,plugins:[vue()],optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,watch:null,hmr:false},appType:'custom'});
const originalFetch=globalThis.fetch, calls=[], fixtures={};
for(const domain of ['photos','costumes','cards'])
  fixtures[domain]=await fs.readFile(new URL(`../public/translations/zh-CN/archive-general/${domain}.json`,import.meta.url),'utf8');
let mode='failure';
globalThis.fetch=async url=>{
  const domain=url.match(/\/(photos|costumes|cards)\.json\?rev=([a-f0-9]{64})$/)?.[1];
  assert.ok(domain,`Versioned optional name request: ${url}`);calls.push(domain);
  if(mode==='failure')return new Response('',{status:503});
  if(mode==='html')return new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}});
  const body=mode==='malformed'?JSON.stringify({schemaVersion:1,entries:{'photo-spots':null}}):fixtures[domain];
  return new Response(body,{headers:{'content-type':'application/json'}});
};
try {
  const names=await server.ssrLoadModule('/src/components/archive/useArchiveNamedText.js');
  const photo=await server.ssrLoadModule('/src/components/archive/useArchivePhotoText.js');
  const locale=await server.ssrLoadModule('/src/localization/ui/UiLocaleStore.js');
  assert.equal(calls.length,0,'Importing a photo text helper must not load optional resources');
  assert.equal(photo.archiveText('photo-spots','撮影スタジオ'),'撮影スタジオ');
  for(mode of ['failure','html','malformed']) {
    await assert.rejects(names.loadArchiveNames('photos'));
    assert.equal(photo.archiveText('photo-spots','撮影スタジオ'),'撮影スタジオ','Invalid optional data keeps source usable');
  }
  mode='valid';
  const first=names.loadArchiveNames('photos'),second=names.loadArchiveNames('photos');
  assert.equal(first,second,'Concurrent owners share one successful request');await first;
  const source=Object.entries(JSON.parse(fixtures.photos).entries['photo-spots'].name).find(([ja,zh])=>ja!==zh);
  assert.ok(source);
  assert.equal(photo.archiveText('photo-spots',source[0]),source[1]);
  locale.setUiLocale('ja-JP');
  assert.equal(photo.archiveText('photo-spots',source[0]),source[0]);
  assert.equal(photo.archiveSearchText('photo-spots',source[0]),`${source[0]} ${source[1]}`);
  assert.equal(photo.archiveText('photo-spots','unknown source'),'unknown source');
  locale.setUiLocale('zh-CN');
  await names.loadArchiveNames('costumes');
  const costume=Object.entries(JSON.parse(fixtures.costumes).entries.costume.name).find(([ja,zh])=>ja!==zh);
  assert.equal(photo.archiveText('costume',costume[0]),costume[1]);
  await names.loadArchiveNames('cards');
  assert.equal(calls.filter(domain=>domain==='photos').length,4,'Each failed request is retryable; valid result is shared');
  const {default:Failure}=await server.ssrLoadModule('/src/components/archive/ArchivePageLoadError.vue');
  const html=await renderToString(createSSRApp(Failure));
  assert.match(html,/role="alert"/);assert.match(html,/重新加载此页/);
  console.log('Optional names: actual helpers, 503/HTML/schema fallback, retries, request sharing, locale and source aliases; load-error component render passed. Browser acceptance is separate.');
} finally {globalThis.fetch=originalFetch;await server.close();}
