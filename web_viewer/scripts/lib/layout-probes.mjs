// Read-only DOM probes. All generic findings are candidates, never proof of a product bug.
export function inspectLayout(config = {}) {
  const findings = [], exceptions = [];
  const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
  const visible = e => {const r=rect(e),s=getComputedStyle(e);return r.width>1&&r.height>1&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden],[inert]');};
  const locator = e => e.id ? '#'+CSS.escape(e.id) : e.tagName.toLowerCase()+ (typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).filter(Boolean).map(CSS.escape).join('.'):'');
  const add=(kind,e,detail)=>findings.push({kind,selector:e?locator(e):'document',rect:e?rect(e):null,detail});
  const excluded=e=>{const s=getComputedStyle(e);return /inset\(50%\)|rect\(0/.test(s.clipPath+' '+s.clip)||e.matches('.visually-hidden,.overview-visually-hidden,.sr-only');};
  const els=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&!excluded(e)&&!e.closest('svg'));
  const allowed=e=>(config.horizontalExceptions||[]).some(rule=>e.closest(rule));
  if(document.documentElement.scrollWidth>document.documentElement.clientWidth+2)add('document-overflow',null,{width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth});
  for(const e of els){
    const r=rect(e),s=getComputedStyle(e);
    if(r.x< -2||r.right>document.documentElement.clientWidth+2){if(allowed(e))exceptions.push({kind:'horizontal-scroll',selector:locator(e)});else add('viewport-overflow',e,{});}
    if(e.matches('h1,h2,h3,button,label')&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2))add('text-clipping-candidate',e,{ellipsis:s.textOverflow==='ellipsis',overflow:s.overflow});
    if((config.clippingExceptions||[]).some(rule=>e.matches(rule))){exceptions.push({kind:'intentional-art-crop',selector:locator(e),reason:config.exceptionReason});continue;}
    for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const ps=getComputedStyle(p),pr=rect(p);if((/hidden|clip/.test(ps.overflowX)&&(r.x<pr.x-2||r.right>pr.right+2))||(/hidden|clip/.test(ps.overflowY)&&(r.y<pr.y-2||r.bottom>pr.bottom+2))){add('parent-clipping',e,{parent:locator(p),parentRect:pr});break;}}
    if(e.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,select')&&parseFloat(s.fontSize)<16)add('small-input-risk',e,{fontSize:s.fontSize,hardwareConfirmationRequired:true});
    if(e.tagName==='IMG'&&e.complete){if(!e.naturalWidth)add('broken-image',e,{src:e.getAttribute('src')});else if(s.objectFit==='fill'&&Math.abs(r.width/r.height-e.naturalWidth/e.naturalHeight)>.1)add('image-distortion-candidate',e,{natural:[e.naturalWidth,e.naturalHeight],objectFit:s.objectFit});}
    if(e.scrollHeight>e.clientHeight+2&&/hidden|clip/.test(s.overflowY)&&e.matches('[data-qa-scroll], [data-archive-scroll-container]'))add('unreachable-scroll-end',e,{scrollHeight:e.scrollHeight,clientHeight:e.clientHeight});
  }
  // Targeted sibling pairs avoid treating ancestor/child or text overlays on images as collisions.
  const pairs=[['.archive-topbar h1','.archive-language-switch'],...(config.overlapPairs||[])];
  for(const [a,b] of pairs)for(const e of document.querySelectorAll(a))for(const f of document.querySelectorAll(b)){if(!visible(e)||!visible(f))continue;const r=rect(e),t=rect(f);if(Math.min(r.right,t.right)-Math.max(r.x,t.x)>2&&Math.min(r.bottom,t.bottom)-Math.max(r.y,t.y)>2)add('overlap',e,{other:locator(f),otherRect:t});}
  const targets=els.filter(e=>e.matches('button,input,a[href],[data-qa-target]'));
  for(const e of targets){const r=rect(e),x=r.x+r.width/2,y=r.y+r.height/2;if(x<0||x>document.documentElement.clientWidth||y<0||y>innerHeight)continue;const top=document.elementFromPoint(x,y);if(!top||e.contains(top)||top.contains(e))continue;let p=top;while(p&&p!==document.body){if(getComputedStyle(p).position==='fixed'){add(e===document.activeElement?'focus-obscured':'fixed-obscured',e,{occluder:locator(p)});break;}p=p.parentElement;}}
  return {findings,exceptions,scope:'candidate-only',url:location.href,title:document.title};
}
