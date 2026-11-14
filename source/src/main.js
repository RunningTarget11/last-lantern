import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {Sim} from './sim.js';
import {LEVELS} from './levels.js';
import {World} from './world.js';
import {LMU} from './lm.js';
import {initMaterials,makeDavyLamp,makeTorchProp,makePickaxe,makeMallet,makeFlareProp,timberSet} from './props.js';
import {loadModels,makeChar,play} from './chars.js';
import {initAudio,sfx,setMuted} from './audio.js';
const A=window.__ASSETS;const $=id=>document.getElementById(id);
const QS=new URLSearchParams(location.search);
const IS_MOBILE=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||(matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<900);
const QUAL={low:{pr:0.85,bloom:false,lantern:false},med:{pr:1.25,bloom:true,lantern:false},high:{pr:1.75,bloom:true,lantern:true,shadow:1024}};
let qName=QS.get('q')||localStorage.getItem('ll_q')||(IS_MOBILE?'med':'high');if(!QUAL[qName])qName='med';
{const st=document.createElement('style');st.textContent=`@font-face{font-family:'Cinzel';src:url(${A.font.cinzel}) format('truetype');font-weight:400 900}@font-face{font-family:'CinzelDeco';src:url(${A.font.cinzelDeco}) format('truetype')}`;document.head.appendChild(st);}
const loadStep=(t,p)=>{$('loadTxt').textContent=t;$('loadBar').style.width=(p*100)+'%';};
// ---------- renderer ----------
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,0.5,120);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;scene.environmentIntensity=0.05;
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType});
const composer=new EffectComposer(renderer,rt);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.7,0.55,0.9);composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uRes:{value:new THREE.Vector2(1,1)}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){vec2 uv=vUv;vec2 c=uv-.5;float r=length(c*vec2(1.2,1.));vec3 col;col.r=texture2D(tDiffuse,uv+c*0.002*r).r;col.g=texture2D(tDiffuse,uv).g;col.b=texture2D(tDiffuse,uv-c*0.002*r).b;
  float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,0.84);col*=mix(vec3(0.82,0.9,1.08),vec3(1.08,1.0,0.86),smoothstep(0.,0.5,l));
  col=pow(col,vec3(1.04));col*=mix(0.28,1.,smoothstep(0.9,0.3,r));col+=(h(uv*900.+fract(uTime))-.5)*0.03;gl_FragColor=vec4(col,1.);}`});
composer.addPass(grade);
function applyQuality(){const q=QUAL[qName];const pr=Math.min(devicePixelRatio,q.pr);renderer.setPixelRatio(pr);composer.setPixelRatio(pr);composer.setSize(innerWidth,innerHeight);bloom.enabled=q.bloom;bloom.resolution.set(innerWidth*pr/2,innerHeight*pr/2);
  document.querySelectorAll('#qrow .btn').forEach(b=>b.classList.toggle('on',b.dataset.q===qName));}
// ---------- textures ----------
const tl=new THREE.TextureLoader();const tex=(k,srgb)=>{const t=tl.load(A.tex[k]);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
const T={rockD:tex('dark_rock_diff',1),rockN:tex('dark_rock_nor'),groundD:tex('rock_ground_diff',1),groundN:tex('rock_ground_nor'),woodD:tex('medieval_wood_diff',1),woodN:tex('medieval_wood_nor'),rustD:tex('rusty_metal_02_diff',1),rustN:tex('rusty_metal_02_nor')};
// ---------- state ----------
const G={state:'loading',sim:null,world:null,level:0,speed:1,tool:'lantern',acc:0,paused:false,overT:0,camX:10,camY:6,viewH:11,tcx:10,tcy:6,lastPan:-99,sound:localStorage.getItem('ll_snd')!=='0',t:0,demo:false};
const best=JSON.parse(localStorage.getItem('ll_best')||'{}');
const TOOLS=[{k:'lantern',lab:'Foreman'},{k:'torch',lab:'Torch'},{k:'lamp',lab:'Davy Lamp'},{sep:1},{k:'digger',lab:'Digger'},{k:'blocker',lab:'Blocker'},{k:'shorer',lab:'Shorer'},{k:'flare',lab:'Flare'},{sep:1},{k:'speed',small:1},{k:'menu',small:1}];
const ICONS={};
// ---------- icons: rendered from the game's own 3D props ----------
function renderIcons(){
  const S=112;const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(S,S);r.setPixelRatio(1);r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.15;
  const sc=new THREE.Scene();const pm=new THREE.PMREMGenerator(r);sc.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;sc.environmentIntensity=0.35;
  const key=new THREE.DirectionalLight(0xffc890,3.2);key.position.set(2,3,4);const rim=new THREE.DirectionalLight(0x8aa0ff,2.4);rim.position.set(-3,1,-3);const fill=new THREE.AmbientLight(0x403028,1.2);sc.add(key,rim,fill);
  const cam=new THREE.PerspectiveCamera(30,1,0.05,50);const expo=LMU.uLMExpo.value;LMU.uLMExpo.value=0;const amb=LMU.uAmb.value.clone();LMU.uAmb.value.setRGB(0,0,0);
  const shot=(name,obj,{dist=1.2,ty=0,rx=0,ry=0.5,rz=0,pl=null,crop=1}={})=>{const g=new THREE.Group();g.add(obj);g.rotation.set(rx,ry,rz);sc.add(g);g.traverse(o=>{if(o.isSprite)o.visible=false;});g.updateMatrixWorld(true);
    const b=new THREE.Box3();g.traverse(o=>{if(o.isMesh&&o.visible&&!o.material.isShaderMaterial)b.expandByObject(o);});if(crop<1)b.min.y=b.max.y-(b.max.y-b.min.y)*crop;const c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3());const d=Math.max(sz.x,sz.y)*dist/(2*Math.tan(15*Math.PI/180));
    cam.position.set(c.x,c.y+ty,c.z+d);cam.lookAt(c.x,c.y+ty,c.z);let p=null;if(pl){p=new THREE.PointLight(pl[0],pl[1],4,1.5);p.position.copy(c).add(new THREE.Vector3(...pl[2]));sc.add(p);}
    r.render(sc,cam);ICONS[name]=r.domElement.toDataURL('image/png');sc.remove(g);if(p)sc.remove(p);};
  shot('torch',makeTorchProp(),{rz:-0.5,ry:0.3,dist:1.05});
  shot('lamp',makeDavyLamp(1,true),{ry:0.6,dist:1.15,pl:[0xffa050,1.5,[0,-0.05,0.15]]});
  shot('digger',makePickaxe(),{rz:0.7,ry:0.3,dist:1.0});
  {const g=new THREE.Group();const t=timberSet(0,0.9,{front:false});t.scale.setScalar(0.5);g.add(t);const m=makeMallet();m.scale.setScalar(1.6);m.rotation.z=-0.7;m.position.set(0.05,0.0,0.35);g.add(m);shot('shorer',g,{ry:0.5,dist:1.0});}
  shot('flare',makeFlareProp(),{rz:-0.6,dist:1.0});
  {const c=makeChar('foreman');play(c,'Idle_Lantern_Loop',0);c.mixer.update(0.8);c.root.updateMatrixWorld(true);const lp=c.props.lamp;lp.quaternion.copy(lp.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    const g=new THREE.Group();g.add(c.root);shot('lantern',g,{ry:0.45,dist:1.0,crop:0.5,pl:[0xffb060,6,[0.3,-0.2,0.5]]});}
  {const c=makeChar('miner',2);play(c,'Idle_No_Loop',0);c.mixer.update(0.9);const g=new THREE.Group();g.add(c.root);shot('blocker',g,{ry:0.0,dist:1.0,crop:0.55});}
  LMU.uLMExpo.value=expo;LMU.uAmb.value.copy(amb);pm.dispose();r.dispose();r.forceContextLoss();}
// ---------- toolbar ----------
const SVG={menu:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="2.6" rx="1"/><rect x="4" y="10.7" width="16" height="2.6" rx="1"/><rect x="4" y="16.4" width="16" height="2.6" rx="1"/></svg>'};
function buildBar(){const el=$('tools');el.innerHTML='';
  for(const t of TOOLS){if(t.sep){const s=document.createElement('div');s.className='sep';el.appendChild(s);continue;}
    const b=document.createElement('div');b.className='slot'+(t.small?' small':'');b.dataset.k=t.k;
    if(t.k==='speed')b.innerHTML='<div class="sp" id="spd">1×</div>';else if(t.k==='menu')b.innerHTML=SVG.menu;else b.innerHTML=`<img src="${ICONS[t.k]||''}" alt=""><span class="lab">${t.lab}</span>${t.k==='lantern'?'':'<span class="cnt">0</span>'}`;
    el.appendChild(b);
    b.addEventListener('pointerdown',ev=>{ev.stopPropagation();initAudio();onToolDown(t.k,ev);});}}
function refreshBar(){const s=G.sim;if(!s)return;for(const b of document.querySelectorAll('#tools .slot')){const k=b.dataset.k;
    if(k in s.L.tools){const n=s.tools[k];const total=s.L.tools[k];b.classList.toggle('none',total===0);b.classList.toggle('empty',n<=0);const c=b.querySelector('.cnt');if(c)c.textContent=n;}
    b.classList.toggle('sel',k===G.tool);}
  $('spd')&&($('spd').textContent=G.speed+'×');}
let dragTool=null;
function onToolDown(k,ev){const s=G.sim;if(!s||G.state!=='play')return;
  if(k==='menu'){openPause();return;}
  if(k==='speed'){G.speed=G.speed===1?2:G.speed===2?3:1;sfx.tap();refreshBar();return;}
  if(k!=='lantern'&&!(s.tools[k]>0)){sfx.deny();toast('None left');return;}
  G.tool=G.tool===k&&k!=='lantern'?'lantern':k;sfx.tap();refreshBar();
  const tips={lantern:'Tap the tunnel to move the Foreman. Tap a Blocker to release him.',torch:'Tap or drag into the tunnel to plant a torch (open flame!)',lamp:'Tap or drag to set down a Davy lamp (safe in gas)',digger:'Tap a miner to dig straight down',blocker:'Tap a miner to hold the line',shorer:'Tap a miner - he props up the next weak roof',flare:'Tap a miner to throw a flare ahead of him'};
  toast(tips[G.tool]);
  if(k==='torch'||k==='lamp'){dragTool={k,id:ev.pointerId,moved:false,x0:ev.clientX,y0:ev.clientY};}}
// ---------- toast / labels ----------
let toastT=0;function toast(t,dur=2.2){const e=$('toast');e.textContent=t;e.style.opacity=1;toastT=dur;}
const labelPool=[];function drawLabels(list){const el=$('labels');while(labelPool.length<list.length){const d=document.createElement('div');d.className='wl';el.appendChild(d);labelPool.push(d);}
  const v=new THREE.Vector3();labelPool.forEach((d,i)=>{const L=list[i];if(!L){d.style.display='none';return;}v.set(L.x,L.y,0.8).project(camera);if(v.z>1){d.style.display='none';return;}d.style.display='flex';
    d.style.left=((v.x+1)/2*innerWidth)+'px';d.style.top=((1-v.y)/2*innerHeight)+'px';d.className='wl '+(L.cls||'');const html=(L.icon==='roof'?'⚠ ':'')+L.text+(L.prog>0?`<span class="pb"><span style="width:${L.prog*100}%"></span></span>`:'');if(d._h!==html){d.innerHTML=html;d._h=html;}});}
// ---------- camera ----------
function barH(){return G.state==='play'||G.state==='paused'?$('bar').offsetHeight:0;}
function camFit(){const s=G.sim;if(!s)return;const aspect=innerWidth/Math.max(1,innerHeight-barH());
  // portrait phones see less width: keep about 10 m across; landscape about 12 m tall
  const minH=Math.max(5.5,(aspect<1?8/aspect:0));G.viewH=Math.max(G.viewH,Math.min(minH,s.H+2));G.viewH=Math.min(G.viewH,Math.max(7,s.H*1.05),aspect<1?24:20);}
function clampCam(){const s=G.sim;if(!s)return;const aspect=innerWidth/Math.max(1,innerHeight-barH());const vw=G.viewH*aspect;
  const hw=Math.min(vw/2,s.W/2),hh=Math.min(G.viewH/2,s.H/2);G.tcx=Math.max(hw-0.5,Math.min(s.W-hw+0.5,G.tcx));G.tcy=Math.max(hh-0.5,Math.min(s.H-hh+0.5,G.tcy));}
function updateCamera(dt){const s=G.sim;if(!s)return;
  if(G.state==='play'&&G.t-G.lastPan>2.5){// soft-follow the foreman when he walks off-screen
    const fm=s.foreman;const aspect=innerWidth/Math.max(1,innerHeight-barH());const vw=G.viewH*aspect;if(Math.abs(fm.x-G.tcx)>vw*0.32)G.tcx+=(fm.x-G.tcx-Math.sign(fm.x-G.tcx)*vw*0.32)*Math.min(1,dt*3);if(Math.abs(fm.y+1-G.tcy)>G.viewH*0.28)G.tcy+=(fm.y+1-G.tcy-Math.sign(fm.y+1-G.tcy)*G.viewH*0.28)*Math.min(1,dt*3);}
  if(G.state==='title'){let sx=s.foreman.x,n=1;for(const m of s.miners)if(m.active){sx+=m.x;n++;}G.tcx=sx/n+(innerWidth>innerHeight?3.2:0)+Math.sin(G.t*0.07)*1.0;G.tcy=s.foreman.y+1.6;G.viewH=7.5;}
  clampCam();const k=1-Math.exp(-dt*7);G.camX+=(G.tcx-G.camX)*k;G.camY+=(G.tcy-G.camY)*k;
  const bh=barH();const fov=camera.fov*Math.PI/180;const D=G.viewH/(2*Math.tan(fov/2));
  camera.aspect=innerWidth/innerHeight;// full-screen viewport; shift so the bar doesn't hide the frame
  const shiftY=(bh/innerHeight)*G.viewH*(innerHeight/Math.max(1,innerHeight-bh))*0.5;
  const sh=G.world?G.world.shake:0;const jx=(Math.random()-0.5)*sh*0.25,jy=(Math.random()-0.5)*sh*0.25;
  camera.position.set(G.camX+jx,G.camY+1.1-shiftY+jy,D*(innerHeight/Math.max(1,innerHeight-bh)));camera.lookAt(G.camX+jx*0.5,G.camY-shiftY-0.15,0);camera.updateProjectionMatrix();}
function screenToWorld(cx,cy){const v=new THREE.Vector3((cx/innerWidth)*2-1,-(cy/innerHeight)*2+1,0.5).unproject(camera);const d=v.sub(camera.position).normalize();const t=-camera.position.z/d.z;return {x:camera.position.x+d.x*t,y:camera.position.y+d.y*t};}
function worldToScreen(x,y,z=0){const v=new THREE.Vector3(x,y,z).project(camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};}
// ---------- input ----------
const ptrs=new Map();let gesture=null;
const cvs=renderer.domElement;
addEventListener('pointerdown',ev=>{if(ev.target!==cvs)return;initAudio();ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,x0:ev.clientX,y0:ev.clientY,t0:performance.now()});
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];gesture={pinch:Math.hypot(a.x-b.x,a.y-b.y),vh:G.viewH};}else gesture={pan:true,cx:G.tcx,cy:G.tcy,moved:false};});
addEventListener('pointermove',ev=>{
  if(dragTool&&ev.pointerId===dragTool.id){if(Math.hypot(ev.clientX-dragTool.x0,ev.clientY-dragTool.y0)>14){dragTool.moved=true;const g=$('ghost');g.src=ICONS[dragTool.k];g.classList.remove('hidden');g.style.left=ev.clientX+'px';g.style.top=(ev.clientY-30)+'px';}return;}
  const p=ptrs.get(ev.pointerId);if(!p)return;p.x=ev.clientX;p.y=ev.clientY;
  if(ptrs.size===2&&gesture&&gesture.pinch){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);G.viewH=Math.max(5,Math.min(24,gesture.vh*gesture.pinch/Math.max(20,d)));camFit();G.lastPan=G.t;return;}
  if(gesture&&gesture.pan&&ptrs.size===1){const dx=p.x-p.x0,dy=p.y-p.y0;if(Math.hypot(dx,dy)>10)gesture.moved=true;if(gesture.moved){const k=G.viewH/Math.max(1,innerHeight-barH());G.tcx=gesture.cx-dx*k;G.tcy=gesture.cy+dy*k;G.lastPan=G.t;}}});
addEventListener('pointerup',ev=>{
  if(dragTool&&ev.pointerId===dragTool.id){const d=dragTool;dragTool=null;$('ghost').classList.add('hidden');if(d.moved&&ev.clientY<innerHeight-barH()){const w=screenToWorld(ev.clientX,ev.clientY-30);placeLight(d.k,w.x,w.y);}return;}
  const p=ptrs.get(ev.pointerId);ptrs.delete(ev.pointerId);if(!p)return;
  if(gesture&&gesture.pan&&!gesture.moved&&performance.now()-p.t0<600&&ptrs.size===0)onTap(ev.clientX,ev.clientY);
  if(ptrs.size===0)gesture=null;});
addEventListener('pointercancel',ev=>{ptrs.delete(ev.pointerId);if(ptrs.size===0)gesture=null;dragTool=null;$('ghost').classList.add('hidden');});
addEventListener('wheel',ev=>{if(G.state!=='play')return;G.viewH=Math.max(5,Math.min(24,G.viewH*(1+Math.sign(ev.deltaY)*0.1)));camFit();G.lastPan=G.t;},{passive:true});
addEventListener('keydown',ev=>{if(G.state!=='play')return;const map={'1':'lantern','2':'torch','3':'lamp','4':'digger','5':'blocker','6':'shorer','7':'flare'};if(map[ev.key])onToolDown(map[ev.key],{});if(ev.key===' '||ev.key==='Escape')openPause();
  if(ev.key==='ArrowLeft')G.tcx-=2;if(ev.key==='ArrowRight')G.tcx+=2;if(ev.key==='ArrowUp')G.tcy+=2;if(ev.key==='ArrowDown')G.tcy-=2;G.lastPan=G.t;});
function pickMiner(cx,cy,pred=()=>true){const s=G.sim;let best=null,bd=46;for(const m of s.miners){if(!m.active||!pred(m))continue;const p=worldToScreen(m.x,m.y+0.85,0);const d=Math.hypot(p.x-cx,p.y-cy)*(m.state==='block'?0.9:1);if(d<bd){bd=d;best=m;}}return best;}
function onTap(cx,cy){const s=G.sim;if(!s||G.state!=='play')return;const w=screenToWorld(cx,cy);const tool=G.tool;
  if(tool==='lantern'){const b=pickMiner(cx,cy,m=>m.state==='block');if(b){s.assign(b,'lantern');toast('Blocker released');return;}
    s.moveForeman(w.x);sfx.tap();showMarker(w.x,s.groundY(w.x,w.y+0.5,8)??w.y);return;}
  if(tool==='torch'||tool==='lamp'){placeLight(tool,w.x,w.y);return;}
  const m=pickMiner(cx,cy);if(!m){toast('Tap a miner');return;}
  const r=s.assign(m,tool);if(r==='ok'){if(!(s.tools[tool]>0))G.tool='lantern';refreshBar();}else if(r==='busy'){sfx.deny();toast(m.state==='fall'?'He is falling':'He is busy');}else if(r==='empty'){sfx.deny();toast('None left');}}
function placeLight(k,x,y){const s=G.sim;const l=s.placeLight(k,x,y);if(!l){sfx.deny();toast(s.tools[k]>0?'Cannot place it there':'None left');return;}if(!(s.tools[k]>0))G.tool='lantern';refreshBar();
  for(const g of s.gas)if(g.alive&&k==='torch'&&l.x>g.x0-0.8&&l.x<g.x1+0.8&&l.y>g.y0-0.8&&l.y<g.y1+0.8)toast('Firedamp!');}
let markerT=0;function showMarker(x,y){markerT=1.2;G.markerPos={x,y};}
// ---------- screens ----------
function show(id,on=true){$(id).classList.toggle('hidden',!on);}
function starsHTML(n,cls=''){const p='<path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6 5.7 21.2l1.5-7.1L1.8 9.2 9 8.4z"/>';let h=`<div class="stars ${cls}">`;for(let i=0;i<3;i++)h+=`<svg class="star ${i<n?'on':''}" viewBox="0 0 24 24">${p}</svg>`;return h+'</div>';}
function buildLevelList(){const el=$('lvList');el.innerHTML='';LEVELS.forEach((L,i)=>{const d=document.createElement('div');d.className='lv';d.innerHTML=`<div class="num">${i+1}</div><div class="nm">${L.name}</div><div class="ds">${L.sub}</div>${starsHTML(best[L.id]||0,'small').replace('class="stars small"','class="stars small" style="justify-content:flex-start;margin:6px 0 0"')}`;
  d.onclick=()=>{sfx.select();startLevel(i);};el.appendChild(d);});}
const fmtT=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function loadLevel(i,demo=false){if(G.world){G.world.dispose();G.world=null;}G.level=i;const L=LEVELS[i];G.sim=new Sim(L);G.demo=demo;
  G.world=new World(G.sim,scene,T,{realLantern:QUAL[qName].lantern,shadowSize:QUAL[qName].shadow});
  const e=G.sim.entry;G.tcx=G.camX=e.x+5;G.tcy=G.camY=e.y+1.5;G.viewH=8.5;camFit();G.tool='lantern';G.speed=1;G.acc=0;G.overT=0;}
function startLevel(i){loadLevel(i);const L=LEVELS[i];show('levelsS',false);show('result',false);show('pause',false);show('title',false);
  $('iNum').textContent='Level '+(i+1);$('iName').textContent=L.name;$('iHint').textContent=L.hint;$('iTotal').textContent=L.total;$('iQuota').textContent=L.quota;$('iTime').textContent=fmtT(L.time);
  show('intro',true);G.state='intro';show('bar',true);$('sLv').textContent=L.name;buildBar();refreshBar();updateStatus();}
$('bBegin').onclick=()=>{initAudio();sfx.select();show('intro',false);G.state='play';toast('Tap the tunnel to move the Foreman');};
function openPause(){if(G.state!=='play')return;G.state='paused';show('pause',true);sfx.tap();}
$('bResume').onclick=()=>{show('pause',false);G.state='play';};
$('bRetry').onclick=$('bRetry2').onclick=()=>{sfx.select();startLevel(G.level);};
$('bLevels').onclick=$('bLevels2').onclick=()=>{show('pause',false);show('result',false);show('bar',false);buildLevelList();show('levelsS',true);G.state='levels';};
$('bNext').onclick=()=>{sfx.select();startLevel(Math.min(LEVELS.length-1,G.level+1));};
$('bPlay').onclick=()=>{initAudio();sfx.select();show('title',false);buildLevelList();show('levelsS',true);G.state='levels';};
$('bBackTitle').onclick=()=>{show('levelsS',false);show('title',true);G.state='title';};
function soundLabel(){$('bSound').textContent=$('bSound2').textContent='Sound: '+(G.sound?'On':'Off');}
$('bSound').onclick=$('bSound2').onclick=()=>{G.sound=!G.sound;localStorage.setItem('ll_snd',G.sound?'1':'0');setMuted(!G.sound);initAudio();soundLabel();};
{const q=$('qrow');for(const k of ['low','med','high']){const b=document.createElement('button');b.className='btn dark';b.dataset.q=k;b.textContent=k==='med'?'Medium':k[0].toUpperCase()+k.slice(1);b.onclick=()=>{qName=k;localStorage.setItem('ll_q',k);applyQuality();toast('Graphics: '+b.textContent+(k==='high'?' (lantern shadows on next restart)':''));};q.appendChild(b);}}
function updateStatus(){const s=G.sim;if(!s)return;const L=s.L;$('sSaved').textContent=s.saved+'/'+L.quota;$('sOut').textContent=s.miners.filter(m=>m.active).length+(s.spawned<L.total?'+'+(L.total-s.spawned):'');$('sLost').textContent=s.lost;
  const left=L.time-s.t;$('sTime').textContent=fmtT(left);$('sTimeW').classList.toggle('low',left<30);$('sQ').style.width=Math.min(100,s.saved/L.total*100)+'%';$('sQm').style.left=(L.quota/L.total*100)+'%';}
function showResult(){const r=G.sim.result,L=G.sim.L;G.state='result';const win=r.win;
  if(win&&(best[L.id]||0)<r.stars){best[L.id]=r.stars;localStorage.setItem('ll_best',JSON.stringify(best));}
  $('rSub').textContent='Level '+(G.level+1)+' · '+L.name;$('rTitle').textContent=win?'The Lift Rises':'The Dark Takes Them';$('rStars').outerHTML=starsHTML(win?r.stars:0).replace('class="stars "','class="stars" id="rStars"');
  $('rSaved').textContent=r.saved+' / '+L.total;$('rQuota').textContent=L.quota;$('rLost').textContent=r.lost;
  $('rHint').textContent=win?(r.stars<3?`Save ${L.stars[r.stars]} for the next star.`:'Every soul brought home.'):'Not enough miners reached the lift. Light their way and try again.';
  $('bNext').classList.toggle('hidden',!win||G.level>=LEVELS.length-1);show('result',true);win?sfx.win():sfx.lose();}
// ---------- loop ----------
let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(0.05,(now-last)/1000);last=now;G.t+=dt;
  const s=G.sim,w=G.world;
  if(s&&w){
    if(G.state==='play'){G.acc+=dt*G.speed;let n=0;while(G.acc>=s.dt&&n<12){s.tick();w.handle(s.drainEvents());G.acc-=s.dt;n++;}
      if(s.over){G.overT+=dt;if(G.overT>2.6)showResult();}updateStatus();}
    else if(G.state==='title'&&G.demo){// attract mode: the crew walks the lamp room behind the title
      G.acc+=dt;while(G.acc>=s.dt){s.tick();w.handle(s.drainEvents());G.acc-=s.dt;}if(s.t>14&&!s.over&&((s.t*60)|0)%240===0){s.moveForeman(s.foreman.x+3);} if(s.over||s.t>120)loadLevel(0,true);}
    const simDt=(G.state==='play'||G.state==='title')?dt*(G.state==='play'?G.speed:1):0;
    updateCamera(dt);const aspect=innerWidth/innerHeight;const vw=G.viewH*aspect;
    w.update(simDt,G.t,[G.camX-vw/2,G.camY-G.viewH/2,G.camX+vw/2,G.camY+G.viewH/2]);
    drawLabels(G.state==='play'||G.state==='paused'?w.labels:[]);
  }
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').style.opacity=0;}
  if(markerT>0&&G.markerPos){markerT-=dt;const p=worldToScreen(G.markerPos.x,G.markerPos.y,0.3);const m=$('marker');m.style.left=p.x+'px';m.style.top=p.y+'px';m.style.opacity=Math.min(1,markerT*2);}
  grade.uniforms.uTime.value=G.t;composer.render();}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);applyQuality();camFit();});
// ---------- boot ----------
(async()=>{try{
  loadStep('Lighting the lamps…',0.15);await new Promise(r=>setTimeout(r,30));initMaterials(T);
  loadStep('Waking the crew…',0.4);await loadModels(A);
  loadStep('Forging the tools…',0.7);await new Promise(r=>setTimeout(r,30));renderIcons();
  applyQuality();setMuted(!G.sound);soundLabel();
  loadLevel(0,true);loadStep('Descending…',1);
  // warm the shader cache with one frame before revealing
  updateCamera(0.016);G.world.update(0.016,0,null);composer.render();
  G.state=QS.has('level')?'intro':'title';show('loading',false);
  if(QS.has('level'))startLevel(Math.max(0,Math.min(LEVELS.length-1,(+QS.get('level')||1)-1)));else show('title',true);
  window.__LL={G,LEVELS,startLevel,showResult,onTap,screenToWorld,worldToScreen,toast,placeLight,camera,renderer};
  requestAnimationFrame(frame);
}catch(e){console.error(e);$('loadTxt').textContent='Error: '+e.message;}})();
