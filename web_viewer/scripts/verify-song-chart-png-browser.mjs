// Browser plugin not available in the authoring session; run with Playwright.
// Set GS_PLAYWRIGHT_MODULE / GS_CHROMIUM_EXECUTABLE when using an external QA runtime.
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
const { chromium } = await import(process.env.GS_PLAYWRIGHT_MODULE || 'playwright')
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import sharp from 'sharp'
const root=fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const outputDir=resolve(process.env.GS_PNG_QA_DIR || tmpdir()+'/gs-song-chart-png-qa'); await fs.mkdir(outputDir,{recursive:true})
const {createServer}=await import(root+'/node_modules/vite/dist/node/index.js'); const server=await createServer({root,configLoader:'native',server:{host:'127.0.0.1',port:5198,strictPort:true,hmr:false}}); await server.listen();
const catalog=JSON.parse(await fs.readFile(root+'/public/data/song_catalog.json'))
const browser=await chromium.launch({headless:true,...(process.env.GS_CHROMIUM_EXECUTABLE ? {executablePath:process.env.GS_CHROMIUM_EXECUTABLE} : {}),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']})
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true})
const errors=[]; page.on('pageerror',e=>(errors.push(e.message),console.log('ERROR',e.message)))
page.on('console',m=>{if(m.type()==='error') (errors.push(m.text()),console.log('CONSOLE',m.text()))})
await page.route('**/__png-qa',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><title>GS chart PNG QA</title></head><body><div id="app"></div><script type="module">
import {createApp,h} from '/node_modules/vue/dist/vue.runtime.esm-bundler.js'; import Chart from '/src/components/archive/ArchiveSongChartPreview.vue';
const catalog=await(await fetch('/data/song_catalog.json')).json();
window.mountChart=(code)=>{window.qaApp?.unmount(); window.qaApp=createApp({render:()=>h(Chart,{songCode:code,title:catalog.songs[code].title,difficulties:catalog.songs[code].gameplay.difficulties})}); window.qaApp.mount('#app')}; window.mountChart('brndnf');
</script></body></html>`}))
const chartRequests=[];page.on('request',r=>{if(r.url().includes('/data/song_charts/'))chartRequests.push(r.url())});
await page.goto('http://127.0.0.1:5198/__png-qa')
await page.getByRole('button',{name:'打开谱面预览'}).waitFor()
assert.equal(await page.title(),'GS chart PNG QA'); assert.equal(await page.locator('vite-error-overlay').count(),0); assert.equal(chartRequests.length,0,'chart fetched before preview opened')
const results=[]
async function openLong(type=1,scale=90){
 await page.getByRole('button',{name:'打开谱面预览',exact:true}).click()
 await page.locator('.track-svg').waitFor()
 const label=['','EASY','NORMAL','HARD','EXPERT'][type]
 await page.getByRole('group',{name:'谱面难度',exact:true}).getByRole('button',{name:new RegExp('^'+label)}).click()
 await page.locator('.chart-count').filter({hasText:label}).waitFor()
 await page.getByRole('button',{name:'长轨图',exact:true}).click()
 await page.locator('svg.chart-svg').waitFor()
 await page.getByRole('button',{name:'视图设置',exact:true}).click()
 const popup=page.getByRole('dialog',{name:'谱面视图设置',exact:true})
 await popup.getByLabel('长轨排布',{exact:true}).selectOption('continuous')
 await popup.getByLabel('谱面纵向缩放',{exact:true}).selectOption(String(scale))
 await popup.getByRole('button',{name:'关闭视图设置',exact:true}).click()
}
async function exportChart(code,type,scale=90){
 await page.evaluate(c=>window.mountChart(c),code)
 await openLong(type,scale)
 const svgHeight=Number(await page.locator('svg.chart-svg').getAttribute('height'))
 if (svgHeight*2*820>64*1024*1024) { await page.getByRole('button',{name:'保存长轨 PNG',exact:true}).click(); await page.getByRole('alert').filter({hasText:'安全像素预算'}).waitFor(); const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出 SVG',exact:true}).click();await(await dl).saveAs(`${outputDir}/${code}-${type}-${scale}.svg`);results.push({code,type,scale,width:820,height:svgHeight*2,offline:true});return }
 const pending=page.waitForEvent('download',{timeout:600000}); await page.getByRole('button',{name:'保存长轨 PNG',exact:true}).click()
 const download=await pending, file=`${outputDir}/${code}-${type}-${scale}.png`; await download.saveAs(file)
 const meta=await sharp(file,{limitInputPixels:false}).metadata(); assert.equal(meta.width,820); assert.equal(meta.height,svgHeight*2)
 const raw=await sharp(file,{limitInputPixels:false}).extract({left:0,top:0,width:820,height:100}).raw().toBuffer()
 assert.ok(raw.some((v,i)=>i%4!==3&&v>60))
 results.push({code,type,scale,width:meta.width,height:meta.height,file})
 const svgDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'导出 SVG',exact:true}).click(); await(await svgDownload).saveAs(file.replace('.png','.svg'))
}
await exportChart('brndnf',1); console.log('ordinary done')
await exportChart('brndnf',4); console.log('holds done')
await exportChart('byndtd',4); console.log('slides done')
// Pick a genuine BPM-change chart and the largest corpus chart at maximum scale.
const all=[]; for(const [code,song] of Object.entries(catalog.songs)) for(const d of song.gameplay.difficulties){const c=JSON.parse(await fs.readFile(root+'/public'+d.chart.url)); all.push({code,type:d.type,c})}
const bpm=all.find(x=>x.c.tempos.length>1); await exportChart(bpm.code,bpm.type)
const longest=all.sort((a,b)=>b.c.maxTick-a.c.maxTick)[0]; await exportChart(longest.code,longest.type,150)
await page.evaluate(()=>window.mountChart('brndnf'));
const receipts=[]
await openLong()
// Compare each real split around a 1024-row boundary to a single bounded SVG raster.
const cross=await page.evaluate(async()=>{
 const {embedSongChartImages}=await import('/src/presentation/SongNotePresentation.js');
 const content=await embedSongChartImages(document.querySelector('svg.chart-svg'));
 const doc=new DOMParser().parseFromString(content,'image/svg+xml'); const el=doc.documentElement;
 el.setAttribute('width','820'); el.setAttribute('height','4096'); el.setAttribute('viewBox','0 0 410 2048');
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)],{type:'image/svg+xml'}));
 const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=820;c.height=4096;c.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);return c.toDataURL('image/png').split(',')[1];
});await fs.writeFile(outputDir+'/single-reference.png',Buffer.from(cross,'base64'))
// Asset corruption must fail closed; recover with the existing retry control.
await page.route('**/assets/song-chart-sprites/Note1SpriteAtlas/live_notes_normal.png',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));
await page.getByRole('button',{name:'保存长轨 PNG',exact:true}).click();await page.getByRole('alert').filter({hasText:'贴图校验失败'}).waitFor();receipts.push('asset hash rejection')
await page.unroute('**/assets/song-chart-sprites/Note1SpriteAtlas/live_notes_normal.png');
const pending=page.waitForEvent('download');await page.getByRole('button',{name:'重试导出'}).click();await(await pending).saveAs(outputDir+'/retry.png');receipts.push('retry PNG download')
const original=await sharp(outputDir+'/retry.png').extract({left:0,top:0,width:820,height:4096}).raw().toBuffer();const reference=await sharp(outputDir+'/single-reference.png').raw().toBuffer();let differences=0,maxDelta=0;for(let i=0;i<original.length;i++)if(original[i]!==reference[i]){differences++;maxDelta=Math.max(maxDelta,Math.abs(original[i]-reference[i]))}assert.ok(differences/original.length<0.0001 && maxDelta<=16,`unexpected raster difference: ${differences}, ${maxDelta}`);receipts.push(`4096 rows / 3 seams: ${differences} antialias channel differences, max ${maxDelta}/255; no missing pixels`)
// Cancel a verified snapshot when difficulty changes. It must not download the old chart.
let unexpectedDownload=false;const onDownload=()=>{unexpectedDownload=true};page.on('download',onDownload);
await page.getByRole('button',{name:'保存长轨 PNG',exact:true}).click();await page.getByRole('group',{name:'谱面难度',exact:true}).getByRole('button',{name:/^NORMAL/}).click();await page.getByRole('button',{name:'保存长轨 PNG',exact:true}).waitFor();await page.getByRole('button',{name:'保存长轨 PNG',exact:true}).isEnabled();await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));assert.equal(unexpectedDownload,false);page.off('download',onDownload);receipts.push('difficulty switch cancellation')
// Known-type validation stays ahead of rendering, even when fixture hash is correct.
await page.evaluate(async()=>{const {validateSongChart}=await import('/src/presentation/SongChartPresentation.js');const c=await(await fetch('/data/song_charts/brndnf-1.json')).json();c.notes[0].type='UNKNOWN';let rejected=false;try{validateSongChart(c,'brndnf',1)}catch{rejected=true}if(!rejected)throw Error('unknown type accepted')});receipts.push('unknown type rejection; initial chart fetch stays lazy')
// A synthetic tall chart marks the last row, and crosses the common 32767 Canvas limit.
const encoded=await page.evaluate(async()=>{const {exportSongChartPng}=await import('/src/presentation/SongChartPngExport.js');const c='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50001" viewBox="0 0 100 50001"><rect width="100" height="50001" fill="#123456"/><rect y="50000" width="100" height="1" fill="#ff0000"/></svg>';const blob=await exportSongChartPng(c);return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(blob)})});await fs.writeFile(outputDir+'/synthetic-tall.png',Buffer.from(encoded,'base64'));const meta=await sharp(outputDir+'/synthetic-tall.png',{limitInputPixels:false}).metadata();assert.equal(meta.height,100002);const last=await sharp(outputDir+'/synthetic-tall.png',{limitInputPixels:false}).extract({left:0,top:100001,width:1,height:1}).raw().toBuffer();assert.deepEqual([...last],[255,0,0,255]);receipts.push('100002-row final pixel preserved')

await page.screenshot({path:outputDir+'/desktop.png'})
await page.setViewportSize({width:390,height:844}); await page.screenshot({path:outputDir+'/mobile.png'})
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
const environmentWarnings=errors.filter(e=>e.includes('WebSocket connection')||e.includes('[vite] failed to connect'));
assert.deepEqual(errors.filter(e=>!environmentWarnings.includes(e)),[])
await fs.writeFile(outputDir+'/receipt.json',JSON.stringify({results,receipts,environmentWarnings},null,2)); console.log(JSON.stringify(results))
await browser.close(); await server.close()

// To verify a completed offline image without allocating its entire raster:
// npm run verify:song-chart-png -- output.png 820 <height>
