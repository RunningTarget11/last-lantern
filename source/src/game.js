// Last Lantern - Lemmings-style 2D cutaway. Canvas renderer, input, HUD and screens.
import {Sim,TPS,H as MH,SKILLS,AIR} from './sim.js';
import {LEVELS} from './levels.js';
import {TerrainArt} from './terrain.js';
import {initAudio,sfx,setMuted,setWhisper,audioOn} from './audio.js';
const A=window.LL_A;const $=id=>document.getElementById(id);
const IS_TOUCH=matchMedia('(pointer:coarse)').matches;
const DPR=Math.min(window.devicePixelRatio||1,IS_TOUCH?1.5:2);
const ART=IS_TOUCH?2:3;                       // terrain art px per mask px
const MPM=MH/1.68;                             // mask px per metre
const MINER_K=1.12;                            // miner drawn a touch larger than life for readability
const PROP_K=1.25;
const SK_LABEL={walker:'Walk',climber:'Climber',floater:'Floater',blaster:'Blaster',blocker:'Blocker',builder:'Builder',basher:'Basher',miner:'Miner',digger:'Digger',lamp:'Lamp',torch:'Torch'};
const SK_SHORT={walker:'WALK',climber:'CLIMB',floater:'FLOAT',blaster:'BLAST',blocker:'BLOCK',builder:'BUILD',basher:'BASH',miner:'MINE',digger:'DIG',lamp:'LAMP',torch:'TORCH'};
const ST_LABEL={walk:'Walker',fall:'Faller',climb:'Climber',hoist:'Climber',blocker:'Blocker',builder:'Builder',basher:'Basher',miner:'Miner',digger:'Digger',shrug:'Walker',exit:'Home'};
// ---------------- assets ----------------
const IMG={};
function loadImg(k,src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(i);i.src=src;IMG[k]=i;});}
async function loadAssets(){const st=document.createElement('style');st.textContent=`@font-face{font-family:'Cinzel';src:url(${A.font.cinzel}) format('truetype');font-weight:400 900}@font-face{font-family:'CinzelDeco';src:url(${A.font.cinzelDeco}) format('truetype')}`;document.head.appendChild(st);
  const ks=Object.keys(A.img);let n=0;await Promise.all(ks.map(k=>loadImg(k,A.img[k]).then(()=>{n++;$('loadBar').style.width=(n/ks.length*100)+'%';})));
  try{await document.fonts.load('700 20px Cinzel');await document.fonts.load('700 20px CinzelDeco');}catch(e){}}
const MI=A.data.miner,PR=A.data.props;
// ---------------- state ----------------
const cv=$('cv'),ctx=cv.getContext('2d');
const G={state:'loading',lvl:0,sim:null,art:null,s:3,cx:0,cy:0,speed:1,paused:false,skill:null,hover:null,t:0,acc:0,parts:[],flash:[],shake:0,nukeArm:0,
  best:JSON.parse(localStorage.getItem('ll3_best')||'{}'),sound:localStorage.getItem('ll_sound')!=='off',demo:false,decor:[],dragging:false};
let VW=0,VH=0,BAR=0;
function barH(){const b=$('bar');return b.classList.contains('hidden')?0:b.getBoundingClientRect().height;}
function resize(){VW=innerWidth;BAR=barH();VH=Math.max(100,innerHeight-BAR);cv.width=Math.round(innerWidth*DPR);cv.height=Math.round(innerHeight*DPR);cv.style.width=innerWidth+'px';cv.style.height=innerHeight+'px';
  if(G.sim){fitZoomLimits();clampCam();}layoutMini();}
addEventListener('resize',()=>setTimeout(resize,50));
// ---------------- camera ----------------
function fitZoomLimits(){const s=G.sim;G.sFit=Math.min(VH/s.Hh,Math.max(VW/220,VW/s.W));G.sMin=Math.min(G.sFit,VW/s.W)*0.98;G.sMax=Math.max(G.sFit*3.2,6);}
function clampCam(){const s=G.sim;G.s=Math.max(G.sMin,Math.min(G.sMax,G.s));const vw=VW/G.s,vh=VH/G.s;
  G.cx=vw>=s.W?(s.W-vw)/2:Math.max(0,Math.min(s.W-vw,G.cx));G.cy=vh>=s.Hh?(s.Hh-vh)/2:Math.max(0,Math.min(s.Hh-vh,G.cy));}
function centerOn(x,y){G.cx=x-VW/G.s/2;G.cy=y-VH/G.s/2;clampCam();}
const w2s=(x,y)=>[(x-G.cx)*G.s,(y-G.cy)*G.s];const s2w=(x,y)=>[x/G.s+G.cx,y/G.s+G.cy];
function zoomAt(f,sx,sy){const [wx,wy]=s2w(sx,sy);G.s*=f;clampCam();G.cx=wx-sx/G.s;G.cy=wy-sy/G.s;clampCam();}
// ---------------- level ----------------
function ceilAbove(x,y){const s=G.sim;let yy=y;while(yy>0&&!s.solid(x,yy))yy--;return yy;}
function floorBelow(x,y){const s=G.sim;let yy=y;while(yy<s.Hh-1&&!s.solid(x,yy+1))yy++;return yy;}
function lowestFloor(x){const s=G.sim;for(let y=s.Hh-2;y>0;y--){if(!s.solid(x,y)&&s.solid(x,y+1)){// make sure there is headroom
      let k=0;while(k<20&&!s.solid(x,y-k))k++;if(k>=20)return y;}}return null;}
function buildDecor(L){const s=G.sim,D=[];const rnd=(()=>{let a=L.id*977;return()=>((a=(a*16807)%2147483647)/2147483647);})();
  // dust-dark AO behind terrain (static)
  for(const d of L.decor||[]){
    if(d.k==='timber'){// span the first tall cavity at x
      for(let y=2;y<s.Hh-2;y++){if(!s.solid(d.x,y)&&s.solid(d.x,y-1)){const top=y;let b=y;while(b<s.Hh-1&&!s.solid(d.x,b+1))b++;if(b-top>24&&b<s.Hh-2){D.push({k:'timber',x:d.x,top,bot:b});break;}y=b;}}}
    else if(d.k==='rails'){const segs=[];for(let x=d.x0;x<=d.x1;x+=4){const f=lowestFloor(x);if(f!=null)segs.push([x,f]);}D.push({k:'rails',segs});}
    else if(d.k==='cart'){const f=lowestFloor(d.x);if(f!=null)D.push({k:'cart',x:d.x,y:f+1});}}
  // scattered rubble boulders on floors (background)
  for(let i=0;i<Math.round(s.W/60);i++){const x=10+rnd()*(s.W-20)|0;const f=lowestFloor(x);if(f!=null)D.push({k:'rock',x,y:f+2,v:'ABC'[i%3],sc:0.5+rnd()*0.7});}
  // fixed lamps hang from the ceiling
  for(const l of s.lights)if(l.fixed){const c=ceilAbove(l.x|0,l.y|0);l.ceil=c;}
  return D;}
function makeBackAO(){const s=G.sim;const k=4;const w=Math.ceil(s.W/k),h=Math.ceil(s.Hh/k);const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const id=x.createImageData(w,h);
  const solid=new Float32Array(w*h);for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){let n=0;for(let j=0;j<k;j++)for(let i=0;i<k;i++)if(s.solid(xx*k+i,y*k+j))n++;solid[y*w+xx]=n/(k*k);}
  // blur (box x3)
  let a=solid;for(let pass=0;pass<3;pass++){const b=new Float32Array(w*h);for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){let sum=0,cnt=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const X=xx+i,Y=y+j;if(X>=0&&X<w&&Y>=0&&Y<h){sum+=a[Y*w+X];cnt++;}}b[y*w+xx]=sum/cnt;}a=b;}
  for(let i=0;i<w*h;i++){id.data[i*4+3]=Math.round(Math.min(1,a[i]*1.3)*235);}x.putImageData(id,0,0);return c;}
function loadLevel(i,demo=false){G.lvl=i;const L=LEVELS[i];G.sim=new Sim(L,{seed:7+i});G.art=new TerrainArt(G.sim,IMG,ART);G.parts=[];G.flash=[];G.shake=0;G.decor=buildDecor(L);G.backAO=makeBackAO();
  G.skill=null;G.hover=null;G.speed=1;G.paused=false;G.log=[];G.walkOnly=false;G.selDir=0;G.restartArm=0;G.underN=0;G.acc=0;G.demo=demo;G.nukeArm=0;G.overT=0;G.lastDig=0;G.hatchCeil=ceilAbove(L.hatch.x,L.hatch.y);
  resize();fitZoomLimits();G.s=G.sFit;if(VW/G.s>G.sim.W)G.s=Math.max(G.sMin,VW/G.sim.W);clampCam();centerOn(L.hatch.x+VW/G.s*0.25,G.sim.Hh/2);
  buildBar();updateHud();drawMiniBase();}
// ---------------- particles ----------------
function emit(p){G.parts.push(p);if(G.parts.length>900)G.parts.splice(0,G.parts.length-900);}
function chips(x,y,n,dir=0,col='rock'){for(let k=0;k<n;k++)emit({t:'chip',x:x+(Math.random()-0.5)*6,y:y+(Math.random()-0.5)*6,vx:(Math.random()-0.5)*40+dir*30,vy:-Math.random()*50-10,life:0,max:0.8+Math.random()*0.6,sz:0.6+Math.random()*1.3,rot:Math.random()*6,col:col==='plank'?'#7a5a34':Math.random()<0.5?'#6b5a48':'#3e342b'});
  for(let k=0;k<Math.ceil(n/3);k++)emit({t:'dust',x:x+(Math.random()-0.5)*8,y:y+(Math.random()-0.5)*6,vx:(Math.random()-0.5)*10+dir*8,vy:-Math.random()*8,life:0,max:1.2+Math.random(),sz:3+Math.random()*4,grow:8,a:0.35});}
function sparks(x,y,n){for(let k=0;k<n;k++)emit({t:'spark',x,y,vx:(Math.random()-0.5)*90,vy:-Math.random()*70,life:0,max:0.3+Math.random()*0.4,sz:0.7});}
function smoke(x,y,n,dark=true,spread=6){for(let k=0;k<n;k++)emit({t:dark?'shade':'dust',x:x+(Math.random()-0.5)*spread,y:y+(Math.random()-0.5)*spread,vx:(Math.random()-0.5)*8,vy:-6-Math.random()*12,life:0,max:1.2+Math.random()*1.4,sz:3+Math.random()*3,grow:10,a:dark?0.75:0.4});}
function updParts(dt){const s=G.sim;for(const p of G.parts){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.t==='chip'){p.vy+=160*dt;p.rot+=dt*8;if(s&&s.solid(p.x,p.y+1)&&p.vy>0){p.vy*=-0.25;p.vx*=0.5;}}
    else if(p.t==='spark'){p.vy+=120*dt;}else{p.vx*=0.98;p.vy*=0.97;}}
  G.parts=G.parts.filter(p=>p.life<p.max);}
// ---------------- sim events -> fx/audio ----------------
let lastPick=0,lastHammer=0;
function handleEvents(ev){const s=G.sim;let dirty=null;
  for(const e of ev){switch(e.type){
    case 'dirty':if(!dirty)dirty=[e.x0,e.y0,e.x1,e.y1];else{dirty[0]=Math.min(dirty[0],e.x0);dirty[1]=Math.min(dirty[1],e.y0);dirty[2]=Math.max(dirty[2],e.x1);dirty[3]=Math.max(dirty[3],e.y1);}break;
    case 'dig':chips(e.x,e.y,Math.min(10,2+e.n/12|0),0);if(G.t-lastPick>0.09){lastPick=G.t;if(!G.demo)sfx.pick();}break;
    case 'plank':if(G.t-lastHammer>0.12){lastHammer=G.t;if(!G.demo)sfx.hammer();}chips(e.x+e.dir*5,e.y-1,2,e.dir,'plank');break;
    case 'clink':sparks(e.m.x+e.m.dir*6,e.m.y-7,14);if(!G.demo)sfx.deny();break;
    case 'boom':G.flash.push({x:e.x,y:e.y,r:120,t:0,max:0.7});chips(e.x,e.y,40);smoke(e.x,e.y,18,false,20);sparks(e.x,e.y,30);G.shake=Math.max(G.shake,0.6);if(!G.demo)sfx.boom();break;
    case 'splat':smoke(e.m.x,e.m.y-2,6,false);if(!G.demo)sfx.fell();break;
    case 'taken':smoke(e.m.x,e.m.y-8,22,true,10);if(!G.demo)sfx.taken();break;
    case 'saved':if(!G.demo)sfx.saved();break;
    case 'spawn':break;
    case 'torch':if(!G.demo)sfx.place();break;
    case 'shrug':break;
    case 'over':break;}}
  if(dirty){G.art.rebuild(dirty[0]-2,dirty[1]-2,dirty[2]+2,dirty[3]+2);G.miniDirty=true;}}
// ---------------- drawing helpers ----------------
function prop(name,x,y,k=PROP_K,flip=false,alpha=1){const p=PR[name];if(!p)return;const sc=MPM/p.ppm*k*G.s;const [sx,sy]=w2s(x,y);
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(sx,sy);if(flip)ctx.scale(-1,1);ctx.drawImage(IMG.props,p.x,p.y,p.w,p.h,-p.ox*sc,-p.oy*sc,p.w*sc,p.h*sc);ctx.restore();}
function propStretch(name,x,yTop,yBot,k=PROP_K){const p=PR[name];const sc=MPM/p.ppm*k*G.s;const [sx,sy]=w2s(x,yTop);const h=(yBot-yTop)*G.s;ctx.drawImage(IMG.props,p.x,p.y,p.w,p.h,sx-p.w*sc/2,sy,p.w*sc,h);}
function flame(x,y,size,t,hue=0){const [sx,sy]=w2s(x,y);const r=size*G.s;const f=1+0.12*Math.sin(t*23+x)+0.08*Math.sin(t*37+y);
  ctx.save();ctx.globalCompositeOperation='lighter';
  let g=ctx.createRadialGradient(sx,sy-r*0.4,0,sx,sy-r*0.4,r*3.2*f);g.addColorStop(0,'rgba(255,170,80,0.35)');g.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=g;ctx.fillRect(sx-r*3.4,sy-r*3.8,r*6.8,r*6.8);
  ctx.translate(sx,sy);ctx.scale(1,1.7*f);g=ctx.createRadialGradient(0,-r*0.25,0,0,-r*0.25,r);g.addColorStop(0,'rgba(255,245,210,0.95)');g.addColorStop(0.35,'rgba(255,190,90,0.8)');g.addColorStop(1,'rgba(255,90,20,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,-r*0.25,r,0,Math.PI*2);ctx.fill();ctx.restore();}
function grain(){if(!G.grain){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const id=x.createImageData(128,128);for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=14;}x.putImageData(id,0,0);G.grain=ctx.createPattern(c,'repeat');}return G.grain;}
// ---------------- miners ----------------
function animFor(m){const st=m.state;
  if(st==='walk'||st==='shrug')return st==='shrug'?['shrug',m.st/21,false]:[m.lamp?'lamp':'walk',m.anim/TPS*12/12,true];
  if(st==='fall')return m.floating?['float',m.anim/TPS*0.6,true]:['fall',m.anim/TPS*1.6,true];
  if(st==='climb')return['climb',m.anim/TPS*1.1,true];if(st==='hoist')return['hoist',m.st/9,false];
  if(st==='blocker')return['block',m.anim/TPS*0.4,true];if(st==='builder')return['build',m.st/16,true];
  if(st==='basher')return['bash',m.st/12,true];if(st==='miner')return['mine',m.st/18,true];if(st==='digger')return['dig',(m.anim%15)/15,true];
  if(st==='exit')return['exit',m.st/26,false];if(st==='splat')return['splat',m.st/20,false];if(st==='taken')return['taken',m.st/26,false];return['idle',0,true];}
function drawMiner(m,alpha=1){const [name,ph,loop]=animFor(m);const a=MI.anims[name];let f=loop?Math.floor(((ph%1)+1)%1*a.n):Math.min(a.n-1,Math.floor(ph*a.n));
  const sc=MPM/MI.ppm*MINER_K*G.s;const [sx,sy]=w2s(m.x+0.5,m.y+1);const fw=MI.fw,fh=MI.fh;let flip=m.dir<0;if(name==='lamp')flip=!flip;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(sx,sy);if(flip)ctx.scale(-1,1);ctx.drawImage(IMG.miner,f*fw,a.row*fh,fw,fh,-fw/2*sc,-MI.baseY*sc,fw*sc,fh*sc);ctx.restore();}
// ---------------- lighting ----------------
const LC=document.createElement('canvas'),lctx=LC.getContext('2d');
function lights(){const s=G.sim,t=G.t;const out=[];
  for(const l of s.lights){const fl=1+0.06*Math.sin(t*9+l.x)+0.04*Math.sin(t*23+l.y);out.push({x:l.x,y:l.y,r:(l.r*1.25)*fl,i:l.kind==='torch'?1.0:0.9,c:l.kind==='torch'?[255,160,80]:[255,190,120]});}
  for(const m of s.miners){if(!m.alive)continue;if(m.lamp)out.push({x:m.x,y:m.y-9,r:62*1.25,i:0.95,c:[255,190,120]});else out.push({x:m.x+m.dir*3,y:m.y-11,r:30,i:0.6,c:[255,205,145]});}
  for(const f of G.flash){const k=1-f.t/f.max;out.push({x:f.x,y:f.y,r:f.r*(0.6+0.4*k),i:1.6*k,c:[255,190,120]});}
  return out;}
function drawLighting(){const s=G.sim,L=s.L;const lw=Math.ceil(VW/2),lh=Math.ceil(VH/2);if(LC.width!==lw||LC.height!==lh){LC.width=lw;LC.height=lh;}
  const k=G.s/2;const amb=L.ambient||[160,150,156];lctx.globalCompositeOperation='source-over';lctx.fillStyle=`rgb(${amb})`;lctx.fillRect(0,0,lw,lh);
  for(const z of L.dark||[]){const [x,y]=[(z[0]-G.cx)*k,(z[1]-G.cy)*k];const w=z[2]*k,h=z[3]*k;const e=18*k;
    for(let i=0;i<6;i++){const p=i/6;lctx.fillStyle=`rgba(14,12,20,${0.22})`;lctx.fillRect(x+e*p,y+e*p*0.3,w-2*e*p,h-e*p*0.3);}}
  lctx.globalCompositeOperation='lighter';
  for(const l of lights()){const x=(l.x-G.cx)*k,y=(l.y-G.cy)*k,r=l.r*k;if(x<-r||y<-r||x>lw+r||y>lh+r)continue;const g=lctx.createRadialGradient(x,y,0,x,y,r);const [cr,cg,cb]=l.c;
    g.addColorStop(0,`rgba(${cr},${cg},${cb},${0.95*l.i})`);g.addColorStop(0.35,`rgba(${cr},${cg*0.85|0},${cb*0.7|0},${0.5*l.i})`);g.addColorStop(1,'rgba(0,0,0,0)');lctx.fillStyle=g;lctx.fillRect(x-r,y-r,r*2,r*2);}
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(LC,0,0,VW,VH);ctx.restore();}
// ---------------- frame ----------------
function draw(){const s=G.sim;if(!s)return;const t=G.t;ctx.setTransform(DPR,0,0,DPR,0,0);
  let jx=0,jy=0;if(G.shake>0){jx=(Math.random()-0.5)*G.shake*8;jy=(Math.random()-0.5)*G.shake*8;}
  ctx.fillStyle='#000';ctx.fillRect(0,0,VW,innerHeight);ctx.save();ctx.beginPath();ctx.rect(0,0,VW,VH);ctx.clip();ctx.translate(jx,jy);
  // back wall (parallax) + depth
  if(!G.backPat){G.backPat=ctx.createPattern(IMG.back,'repeat');}
  ctx.save();const bs=G.s*0.42;ctx.translate(-G.cx*G.s*0.9,-G.cy*G.s*0.9);ctx.scale(bs,bs);ctx.fillStyle=G.backPat;ctx.fillRect((G.cx*G.s*0.9)/bs-10,(G.cy*G.s*0.9)/bs-10,VW/bs+20,VH/bs+20);ctx.restore();
  ctx.fillStyle='rgba(8,6,5,0.18)';ctx.fillRect(0,0,VW,VH);
  {const [x,y]=w2s(0,0);ctx.drawImage(G.backAO,x,y,s.W*G.s,s.Hh*G.s);}
  // decor (behind)
  for(const d of G.decor){if(d.k==='timber'){propStretch('post',d.x-11,d.top-2,d.bot+1);propStretch('post',d.x+11,d.top-2,d.bot+1);prop('cap',d.x,d.top+3,PROP_K*1.05);}
    else if(d.k==='rails'){for(const [x,y] of d.segs){const [sx,sy]=w2s(x,y+1);ctx.fillStyle='#2a1d12';ctx.fillRect(sx,sy-G.s*1.1,G.s*2.4,G.s*1.1);}
      ctx.strokeStyle='#6d665e';ctx.lineWidth=Math.max(1,G.s*0.7);ctx.beginPath();d.segs.forEach(([x,y],i)=>{const [sx,sy]=w2s(x,y-0.2);i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy);});ctx.stroke();}
    else if(d.k==='cart')prop('cart',d.x,d.y,PROP_K*1.1);else if(d.k==='rock')prop('rock'+d.v,d.x,d.y,PROP_K*d.sc*0.6);}
  // fixed lamps on chains
  for(const l of s.lights)if(l.fixed){const [x0,y0]=w2s(l.x,l.ceil);const [x1,y1]=w2s(l.x,l.y-4);ctx.strokeStyle='#1c1712';ctx.lineWidth=Math.max(1,G.s*0.4);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();prop('lamp',l.x,l.y-3.2,PROP_K*1.4);}
  // hatch
  {const L=s.L;prop(s.hatchOpen>=1||s.tick>8?'hatch_open':'hatch',L.hatch.x,G.hatchCeil+3,PROP_K*0.95);}
  // terrain
  {const A=ART;const x0=Math.max(0,Math.floor(G.cx)),y0=Math.max(0,Math.floor(G.cy));const x1=Math.min(s.W,Math.ceil(G.cx+VW/G.s)+1),y1=Math.min(s.Hh,Math.ceil(G.cy+VH/G.s)+1);
    if(x1>x0&&y1>y0){const [dx,dy]=w2s(x0,y0);ctx.drawImage(G.art.cv,x0*A,y0*A,(x1-x0)*A,(y1-y0)*A,dx,dy,(x1-x0)*G.s,(y1-y0)*G.s);}}
  // solid earth outside the level bounds (portrait letterbox / zoomed out)
  {const [lx,ly]=w2s(0,0);const lw=s.W*G.s,lh=s.Hh*G.s;if(lx>0||ly>0||lx+lw<VW||ly+lh<VH){if(!G.rockPat)G.rockPat=ctx.createPattern(IMG.rock,'repeat');ctx.save();ctx.beginPath();ctx.rect(0,0,VW,VH);ctx.rect(lx+lw,ly,-lw,lh);ctx.clip('evenodd');
    ctx.translate(lx,ly);const k=G.s/ART*0.9;ctx.scale(k,k);ctx.fillStyle=G.rockPat;ctx.fillRect(-lx/k-4,-ly/k-4,VW/k+8,VH/k+8);ctx.restore();
    ctx.save();ctx.fillStyle='rgba(0,0,0,0.62)';ctx.beginPath();ctx.rect(0,0,VW,VH);ctx.rect(lx+lw,ly,-lw,lh);ctx.fill('evenodd');ctx.restore();}}
  // exit lift
  {const e=s.L.exit;prop('exit',e.x,e.y+1,PROP_K*1.1);}
  // torches
  for(const l of s.lights)if(l.kind==='torch'){prop('torch',l.x,l.gy+1,PROP_K*1.5);}
  // miners
  for(const m of s.miners){if(m.state==='saved'||(!m.alive&&m.state==='dead'))continue;let a=1;
    if(m.state==='exit')a=Math.max(0,1-Math.max(0,m.st-14)/12);
    if(!m.alive){m.st++;if(m.state==='splat'&&m.st>60)continue;if(m.state==='taken'){if(m.st>40)continue;a=Math.max(0,1-m.st/40);}if(m.state==='splat')a=Math.max(0,1-(m.st-30)/30);}
    drawMiner(m,a);
    if(m.alive&&m.dread>0.05){// shadow tendrils reach for him
      const [sx,sy]=w2s(m.x,m.y);ctx.save();ctx.strokeStyle=`rgba(4,2,8,${Math.min(0.9,m.dread/2)})`;ctx.lineWidth=G.s*0.8;ctx.lineCap='round';
      for(let k=0;k<5;k++){const a0=k*1.3+t*2;ctx.beginPath();ctx.moveTo(sx+Math.cos(a0)*14*G.s,sy+4*G.s);ctx.quadraticCurveTo(sx+Math.cos(a0+1)*8*G.s,sy-8*G.s,sx+Math.sin(t*5+k)*2*G.s,sy-(4+m.dread*4)*G.s);ctx.stroke();}ctx.restore();}}
  // particles
  for(const p of G.parts){const [sx,sy]=w2s(p.x,p.y);const k=p.life/p.max;
    if(p.t==='chip'){ctx.save();ctx.translate(sx,sy);ctx.rotate(p.rot);ctx.fillStyle=p.col;ctx.globalAlpha=1-k*k;const z=p.sz*G.s;ctx.beginPath();ctx.moveTo(-z,-z*0.6);ctx.lineTo(z*0.8,-z*0.8);ctx.lineTo(z,z*0.5);ctx.lineTo(-z*0.5,z);ctx.closePath();ctx.fill();ctx.restore();}
    else if(p.t==='dust'||p.t==='shade'){const r=(p.sz+p.grow*k)*G.s;const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r);const c=p.t==='dust'?'120,105,90':'6,4,10';const al=p.a*Math.sin(Math.PI*Math.min(1,k*1.2));
      g.addColorStop(0,`rgba(${c},${al})`);g.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=g;ctx.fillRect(sx-r,sy-r,r*2,r*2);}}
  drawLighting();
  // glows & flames (additive, after lighting)
  for(const l of s.lights){if(l.kind==='torch')flame(l.x+0.6,l.y+3,2.2,t);else flame(l.x,l.y+1.2,1.1,t);}
  for(const m of s.miners)if(m.alive&&m.lamp&&m.state!=='exit'){const [nm]=animFor(m);const ox=nm==='lamp'?m.dir*3.5:0;flame(m.x+ox,m.y-7,0.8,t);}
  {const e=s.L.exit;const [sx,sy]=w2s(e.x,e.y-14);ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(sx,sy,0,sx,sy,26*G.s);g.addColorStop(0,'rgba(255,200,120,0.18)');g.addColorStop(1,'rgba(255,160,60,0)');ctx.fillStyle=g;ctx.fillRect(sx-26*G.s,sy-26*G.s,52*G.s,52*G.s);ctx.restore();}
  for(const p of G.parts)if(p.t==='spark'){const [sx,sy]=w2s(p.x,p.y);ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,${180+Math.random()*60|0},90,${1-p.life/p.max})`;ctx.fillRect(sx-G.s*0.4,sy-G.s*0.4,G.s*0.9,G.s*0.9);ctx.restore();}
  for(const f of G.flash){const [sx,sy]=w2s(f.x,f.y);const k=1-f.t/f.max;ctx.save();ctx.globalCompositeOperation='lighter';const r=40*G.s*(1.2-k*0.4);const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r);g.addColorStop(0,`rgba(255,240,200,${0.9*k})`);g.addColorStop(0.4,`rgba(255,150,60,${0.5*k})`);g.addColorStop(1,'rgba(255,80,20,0)');ctx.fillStyle=g;ctx.fillRect(sx-r,sy-r,r*2,r*2);ctx.restore();}
  // shadow seam: creeping smoke and watching eyes
  for(const z of s.L.dark||[]){const [x,y]=w2s(z[0],z[1]);const w=z[2]*G.s,h=z[3]*G.s;
    for(let k=0;k<7;k++){const ex=z[0]+((k*137+Math.floor(t*0.15+k)*61)%z[2]),ey=z[1]+z[3]*0.35+((k*53)%Math.max(1,z[3]*0.4));if(s.lightAt(ex,ey)>0.05)continue;const bl=(Math.sin(t*1.7+k*2.1)>0.6)?0:1;
      const [sx,sy]=w2s(ex,ey);if(bl){ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle='rgba(255,120,40,0.55)';const r=G.s*0.55;ctx.beginPath();ctx.ellipse(sx-r*2,sy,r,r*0.6,0,0,7);ctx.ellipse(sx+r*2,sy,r,r*0.6,0,0,7);ctx.fill();ctx.restore();}}}
  // stopped miners (blockers, shrugging builders) get a pulsing brass ring and a 'release' chevron so Walk is obvious
  for(const m of s.miners){if(!m.alive||(m.state!=='blocker'&&m.state!=='shrug'))continue;const [sx,sy]=w2s(m.x+0.5,m.y+0.5);const pu=0.55+0.45*Math.sin(t*5+m.id);
    ctx.save();ctx.globalCompositeOperation='lighter';const r=Math.max(10,7*G.s);const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r*1.6);g.addColorStop(0,`rgba(255,170,70,${0.35*pu})`);g.addColorStop(1,'rgba(255,120,30,0)');ctx.fillStyle=g;ctx.fillRect(sx-r*1.6,sy-r*1.6,r*3.2,r*3.2);ctx.restore();
    ctx.save();ctx.strokeStyle=`rgba(255,205,130,${0.5+0.4*pu})`;ctx.lineWidth=Math.max(1.5,G.s*0.45);ctx.beginPath();ctx.ellipse(sx,sy,r,r*0.32,0,0,Math.PI*2);ctx.stroke();
    const hy=sy-MH*1.32*G.s-4,z=Math.max(4,1.7*G.s);ctx.fillStyle=`rgba(255,214,140,${0.6+0.4*pu})`;ctx.shadowColor='rgba(255,140,40,0.9)';ctx.shadowBlur=6;ctx.beginPath();ctx.moveTo(sx-z*0.6,hy-z);ctx.lineTo(sx+z*0.8,hy);ctx.lineTo(sx-z*0.6,hy+z);ctx.closePath();ctx.fill();ctx.restore();}
  // selection highlight
  if(G.hover&&G.hover.alive){const m=G.hover;const [sx,sy]=w2s(m.x+0.5,m.y);const hh=MH*1.18*G.s,ww=Math.max(14,9*G.s);const ok=G.skill?s.canAssign(m,G.skill):true;
    ctx.save();ctx.strokeStyle=ok?'rgba(255,214,140,0.95)':'rgba(200,110,90,0.8)';ctx.lineWidth=2;ctx.shadowColor=ok?'rgba(255,160,60,0.9)':'transparent';ctx.shadowBlur=8;
    const L=ww*0.35;const x0=sx-ww/2,y0=sy-hh,x1=sx+ww/2,y1=sy+2*G.s;ctx.beginPath();
    ctx.moveTo(x0,y0+L);ctx.lineTo(x0,y0);ctx.lineTo(x0+L,y0);ctx.moveTo(x1-L,y0);ctx.lineTo(x1,y0);ctx.lineTo(x1,y0+L);ctx.moveTo(x1,y1-L);ctx.lineTo(x1,y1);ctx.lineTo(x1-L,y1);ctx.moveTo(x0+L,y1);ctx.lineTo(x0,y1);ctx.lineTo(x0,y1-L);ctx.stroke();ctx.restore();}
  // classic cursor (desktop): crosshair, turning into a box over a selectable miner
  if(!IS_TOUCH&&G.mouse&&G.mouse.in&&G.state==='play'&&G.mouse.y<VH){const {x,y}=G.mouse;ctx.save();ctx.strokeStyle='rgba(255,226,170,0.95)';ctx.lineWidth=1.5;ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.beginPath();
    if(G.hover&&G.hover.alive){const b=14;ctx.rect(x-b,y-b,b*2,b*2);ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);}else{ctx.moveTo(x-12,y);ctx.lineTo(x-4,y);ctx.moveTo(x+4,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y-4);ctx.moveTo(x,y+4);ctx.lineTo(x,y+12);}
    ctx.stroke();ctx.restore();}
  // fuses
  ctx.save();ctx.textAlign='center';for(const m of s.miners)if(m.alive&&m.fuse>=0){const [sx,sy]=w2s(m.x,m.y-MH*1.35);const n=Math.ceil(m.fuse/TPS);ctx.font=`700 ${Math.max(11,6*G.s)|0}px Cinzel`;ctx.fillStyle='#ffd08a';ctx.shadowColor='#ff6a20';ctx.shadowBlur=10;ctx.fillText(n,sx,sy);
    if(Math.random()<0.6)sparks(m.x+m.dir*3,m.y-9,1);}ctx.restore();
  // vignette + grain
  ctx.restore();ctx.save();const vg=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*0.35,VW/2,VH/2,Math.max(VW,VH)*0.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.55)');ctx.fillStyle=vg;ctx.fillRect(0,0,VW,VH);
  ctx.globalCompositeOperation='overlay';ctx.translate(Math.random()*128|0,Math.random()*128|0);ctx.fillStyle=grain();ctx.fillRect(-128,-128,VW+256,VH+256);ctx.restore();
  drawMini();}
// ---------------- minimap ----------------
const MC=$('mini'),mctx=MC.getContext('2d');let MW=180,MHt=50;
function layoutMini(){if(!G.sim)return;const portrait=innerHeight>innerWidth;const ar=G.sim.W/G.sim.Hh;
  if(portrait){MW=Math.round(Math.min(innerWidth-24,64*ar));MHt=Math.round(MW/ar);if(MHt>64){MHt=64;MW=Math.round(64*ar);}}
  else{const cb=$('cluster');const h=Math.max(40,cb?cb.getBoundingClientRect().height:60);MW=Math.round(Math.min(240,innerWidth*0.19,h*ar*1.25));MHt=Math.round(MW/ar);if(MHt>h){MHt=Math.round(h);MW=Math.round(MHt*ar);}}
  MC.width=MW*DPR;MC.height=MHt*DPR;MC.style.width=MW+'px';MC.style.height=MHt+'px';}
function drawMiniBase(){layoutMini();G.miniDirty=true;}
function drawMini(){if(MC.classList.contains('hidden')||!G.sim)return;const s=G.sim;mctx.setTransform(DPR,0,0,DPR,0,0);mctx.fillStyle='#0a0807';mctx.fillRect(0,0,MW,MHt);mctx.imageSmoothingEnabled=true;mctx.drawImage(G.art.mini,0,0,MW,MHt);
  const k=MW/s.W;mctx.fillStyle='#ffd58a';for(const m of s.miners)if(m.alive)mctx.fillRect(m.x*k-1,(m.y-6)*k-1,2,2);
  mctx.fillStyle='#ff9a3c';mctx.fillRect(s.L.exit.x*k-2,(s.L.exit.y-8)*k-2,4,4);
  for(const z of s.L.dark||[]){mctx.fillStyle='rgba(60,0,80,0.35)';mctx.fillRect(z[0]*k,z[1]*k,z[2]*k,z[3]*k);}
  mctx.strokeStyle='rgba(241,207,138,0.9)';mctx.lineWidth=1;mctx.strokeRect(G.cx*k+0.5,G.cy*k+0.5,VW/G.s*k-1,VH/G.s*k-1);}
{let down=false;const go=e=>{const r=MC.getBoundingClientRect();const k=G.sim.W/MW;centerOn((e.clientX-r.left)*k,(e.clientY-r.top)*k);};
  MC.addEventListener('pointerdown',e=>{down=true;MC.setPointerCapture(e.pointerId);go(e);e.preventDefault();});MC.addEventListener('pointermove',e=>{if(down)go(e);});MC.addEventListener('pointerup',()=>down=false);}
// ---------------- HUD / panel (classic Lemmings layout) ----------------
const ICON={};
function makeIcons(){const mk=(anim,f,extra)=>{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');const a=MI.anims[anim];const t=document.createElement('canvas');t.width=MI.fw;t.height=MI.fh;const tx=t.getContext('2d');tx.drawImage(IMG.miner,f*MI.fw,a.row*MI.fh,MI.fw,MI.fh,0,0,MI.fw,MI.fh);const d=tx.getImageData(0,0,MI.fw,MI.fh).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let yy=0;yy<MI.fh;yy++)for(let xx=0;xx<MI.fw;xx++)if(d[(yy*MI.fw+xx)*4+3]>40){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(yy<y0)y0=yy;if(yy>y1)y1=yy;}
    if(x1<0){x0=0;y0=0;x1=MI.fw-1;y1=MI.fh-1;}const bw=x1-x0+1,bh=y1-y0+1,sc=Math.min(84/bw,84/bh);x.filter='brightness(1.35)';x.drawImage(t,x0,y0,bw,bh,48-bw*sc/2,92-bh*sc,bw*sc,bh*sc);x.filter='none';if(extra)extra(x);return c.toDataURL();};
  ICON.walker=mk('walk',3,x=>{x.fillStyle='#f1cf8a';x.strokeStyle='#1a0e06';x.lineWidth=3;x.beginPath();x.moveTo(58,22);x.lineTo(80,22);x.lineTo(80,13);x.lineTo(94,28);x.lineTo(80,43);x.lineTo(80,34);x.lineTo(58,34);x.closePath();x.stroke();x.fill();});ICON.climber=mk('climb',4);ICON.floater=mk('float',2);ICON.blocker=mk('block',0);ICON.builder=mk('build',5);ICON.basher=mk('bash',3);ICON.miner=mk('mine',4);ICON.digger=mk('dig',4);ICON.lamp=mk('lamp',3,x=>{const g=x.createRadialGradient(36,64,0,36,64,22);g.addColorStop(0,'rgba(255,220,140,0.9)');g.addColorStop(1,'rgba(255,150,50,0)');x.fillStyle=g;x.fillRect(10,40,52,52);});
  ICON.blaster=mk('idle',0,x=>{x.fillStyle='#3a2416';x.strokeStyle='#1a0e06';x.lineWidth=2;x.beginPath();x.ellipse(62,70,11,14,0,0,7);x.fill();x.stroke();x.fillStyle='#7a5a34';x.fillRect(51,62,22,3);x.fillRect(51,76,22,3);x.strokeStyle='#caa070';x.beginPath();x.moveTo(62,56);x.quadraticCurveTo(66,46,72,44);x.stroke();
    const g=x.createRadialGradient(73,43,0,73,43,9);g.addColorStop(0,'rgba(255,240,180,1)');g.addColorStop(1,'rgba(255,120,30,0)');x.fillStyle=g;x.fillRect(62,32,22,22);});
  {const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');const p=PR.torch;const sc=72/p.h;x.drawImage(IMG.props,p.x,p.y,p.w,p.h,48-p.w*sc/2,20,p.w*sc,p.h*sc);const g=x.createRadialGradient(46,20,0,46,20,20);g.addColorStop(0,'rgba(255,240,190,1)');g.addColorStop(0.4,'rgba(255,170,70,0.8)');g.addColorStop(1,'rgba(255,90,20,0)');x.fillStyle=g;x.fillRect(20,0,56,44);ICON.torch=c.toDataURL();}}

const SVG={pause:'<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',play:'<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  ff:'<svg viewBox="0 0 24 24"><path d="M3 6l8 6-8 6zM12 6l8 6-8 6z"/></svg>',slow:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 .01 0zm0 2.2a6.8 6.8 0 1 1-.01 0zM11 7h2v5.2l3.6 2.1-1 1.7L11 13.4z"/></svg>',
  nuke:'<svg viewBox="0 0 24 24"><path d="M12 2c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-5 1 1 2 2 3 1zM5 14h14l-2 8H7z"/></svg>',
  menu:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="2.4"/><rect x="4" y="11" width="16" height="2.4"/><rect x="4" y="16" width="16" height="2.4"/></svg>',
  minus:'<svg viewBox="0 0 24 24"><rect x="5" y="10.6" width="14" height="2.8"/></svg>',plus:'<svg viewBox="0 0 24 24"><rect x="5" y="10.6" width="14" height="2.8"/><rect x="10.6" y="5" width="2.8" height="14"/></svg>',
  back:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="3" height="14"/><path d="M20 5v14L9 12z"/></svg>',fwd:'<svg viewBox="0 0 24 24"><rect x="17" y="5" width="3" height="14"/><path d="M4 5v14l11-7z"/></svg>',
  restart:'<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.4 5h2.3A6 6 0 1 0 12 6v3L7 5l5-4z"/></svg>',
  left:'<svg viewBox="0 0 24 24"><path d="M16 4v16L5 12z"/></svg>',right:'<svg viewBox="0 0 24 24"><path d="M8 4v16l11-8z"/></svg>',
  walkonly:'<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2.5"/><path d="M10 8h4l1.5 6-1.8.4-.9-3.4-.6 4 2.6 6.5-2 .8-2.5-6-1.6 6.2-2-.5 2-8.5L9 13l-1.8-.6z"/></svg>'};
const PANEL_SKILLS=['walker',...SKILLS];   // Walker first (NeoLemmix), then the classic eight in DOS order, then the light skills
const FKEY={climber:'F3',floater:'F4',blaster:'F5',blocker:'F6',builder:'F7',basher:'F8',miner:'F9',digger:'F10'};
const KEYNUM={walker:'W',climber:'1',floater:'2',blaster:'3',blocker:'4',builder:'5',basher:'6',miner:'7',digger:'8',lamp:'9',torch:'0'};
function slotEl(cls,html,onDown,title){const d=document.createElement('div');d.className='slot '+cls;d.innerHTML=html;if(title)d.title=title;
  d.addEventListener('pointerdown',e=>{if(e.button===2)return;e.preventDefault();e.stopPropagation();onDown(e,d);});d.addEventListener('contextmenu',e=>e.preventDefault());return d;}
function holdRepeat(fn){return (e,d)=>{fn();let n=0;const iv=setInterval(()=>{n++;if(n>3)fn();},70);const up=()=>{clearInterval(iv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);};addEventListener('pointerup',up);addEventListener('pointercancel',up);};}
function hasSkill(k){return k==='walker'||(k in G.sim.skills);}
function buildBar(){const s=G.sim,mn=$('main'),cl=$('cluster');mn.innerHTML='';cl.innerHTML='';
  mn.appendChild(slotEl('sk ctl rr','<span class="num" id="rrMin">'+s.minRate+'</span>'+SVG.minus+'<span class="key">F1</span>',holdRepeat(()=>rate(-1)),'Release rate down (F1, hold to repeat). Number = minimum rate'));
  mn.appendChild(slotEl('sk ctl rr','<span class="num" id="rrCur">'+s.rate+'</span>'+SVG.plus+'<span class="key">F2</span>',holdRepeat(()=>rate(+1)),'Release rate up (F2, hold to repeat). Number = current rate'));
  PANEL_SKILLS.forEach(k=>{if(!hasSkill(k))return;const d=slotEl('sk skill'+(k==='walker'?' walker':''),`<span class="num">${k==='walker'?'∞':s.skills[k]}</span><img src="${ICON[k]}" alt=""><span class="key">${FKEY[k]||KEYNUM[k]}</span><span class="lab">${SK_SHORT[k]}</span>`,()=>selectSkill(k),SK_LABEL[k]+' ('+(FKEY[k]?FKEY[k]+' / ':'')+KEYNUM[k]+')');d.dataset.k=k;mn.appendChild(d);});
  mn.appendChild(slotEl('sk ctl',SVG.pause+'<span class="key">F11</span><span class="lab">PAUSE</span>',()=>togglePause(),'Pause (F11 / P / Space / middle click)'));mn.lastChild.id='bPause';
  mn.appendChild(slotEl('sk ctl nuke',SVG.nuke+'<span class="key">F12</span><span class="lab">NUKE</span>',()=>nukePress(),'Nuke - press twice (F12 / Delete)'));mn.lastChild.id='bNuke';
  const cb=(id,svg,fn,title,lab)=>{const d=slotEl('cb',svg+(lab?'<span class="lab">'+lab+'</span>':''),fn,title);d.id=id;cl.appendChild(d);};
  cb('bFF',SVG.ff,()=>setSpeed(G.speed>1?1:3),'Fast-forward 3x (F)','FAST');cb('bSlow',SVG.slow,()=>setSpeed(G.speed<1?1:0.25),'Slow motion 1/4 (S)','SLOW');
  cb('bBack',SVG.back,holdRepeat(()=>frameBack(1)),'Back one frame (B, hold to rewind; Backspace = back 1 s)','-1F');cb('bStep',SVG.fwd,holdRepeat(()=>frameStep(1)),'Forward one frame (N, hold to repeat)','+1F');cb('bMenu',SVG.menu,()=>openPause(),'Menu (Esc)','MENU');
  cb('bLeft',SVG.left,()=>setDir(G.selDir===-1?0:-1),'Select only left-facing (hold Left arrow)','LEFT');cb('bWalkOnly',SVG.walkonly,()=>{G.walkOnly=!G.walkOnly;updateBar();toast(G.walkOnly?'Selecting walkers only':'Selecting any miner',1.2);},'Select walkers only (hold Ctrl / right-click / long-press)','WALK');
  cb('bRight',SVG.right,()=>setDir(G.selDir===1?0:1),'Select only right-facing (hold Right arrow)','RIGHT');cb('bRestart',SVG.restart,()=>restartPress(),'Restart level (R; tap twice on touch)','RETRY');
  updateBar();setTimeout(resize,0);}
function rate(d,abs){const s=G.sim;const before=s.rate;s.setRate(abs!=null?abs:s.rate+d);if(s.rate!==before){act({a:'rate',r:s.rate});sfx.tap&&d!==0&&0;}updateBar();updateHud();}
function updateBar(){const s=G.sim;if(!s)return;for(const d of document.querySelectorAll('#main .skill')){const k=d.dataset.k;if(k!=='walker')d.querySelector('.num').textContent=s.skills[k];d.classList.toggle('sel',G.skill===k);d.classList.toggle('empty',k!=='walker'&&s.skills[k]<=0);}
  const c=$('rrCur'),mi=$('rrMin');if(c)c.textContent=s.rate;if(mi)mi.textContent=s.minRate;
  const p=$('bPause');if(p){p.classList.toggle('on',G.paused);p.innerHTML=(G.paused?SVG.play:SVG.pause)+'<span class="key">F11</span><span class="lab">'+(G.paused?'PLAY':'PAUSE')+'</span>';}
  const tg=(id,v)=>{const e=$(id);if(e)e.classList.toggle('on',!!v);};tg('bFF',G.speed>1);tg('bSlow',G.speed<1);tg('bLeft',G.selDir===-1||G.keyDir===-1);tg('bRight',G.selDir===1||G.keyDir===1);tg('bWalkOnly',G.walkOnly||G.keyWalk);
  const n=$('bNuke');if(n)n.classList.toggle('arm',G.nukeArm>0);const r=$('bRestart');if(r)r.classList.toggle('arm',G.restartArm>0);}
function selectSkill(k){const s=G.sim;if(!s||!hasSkill(k))return;if(k!=='walker'&&s.skills[k]<=0&&k!=='blocker'){toast(SK_LABEL[k]+': none left');sfx.deny();return;}G.skill=G.skill===k?null:k;sfx.select();updateBar();updateHud();
  if(G.skill==='torch')toast('Tap the ground to plant a torch');else if(G.skill==='walker')toast('Walk: tap a stopped or busy miner to send him on (tap a walker to turn him)',2.2);}
function cycleSkill(d){const list=PANEL_SKILLS.filter(hasSkill);let i=list.indexOf(G.skill);i=(i+d+list.length)%list.length;if(G.skill==null)i=d>0?0:list.length-1;G.skill=null;selectSkill(list[i]);}
function togglePause(){G.paused=!G.paused;updateBar();updateHud();}
function setSpeed(v){G.speed=v;updateBar();updateHud();}
function setDir(d){G.selDir=d;updateBar();if(d)toast('Selecting '+(d<0?'left':'right')+'-facing miners',1.2);}
function nukePress(){if(G.nukeArm>0){act({a:'nuke'});G.nukeArm=0;toast('Every charge is lit!');}else{G.nukeArm=2.5;toast('Press NUKE again to blow every charge');}updateBar();}
function restartPress(fromKey){if(fromKey||G.restartArm>0){G.restartArm=0;restartLevel();return;}G.restartArm=2.5;toast('Tap RETRY again to restart the level');updateBar();}
function restartLevel(){const i=G.lvl;loadLevel(i);G.state='play';show('pause',false);show('result',false);toast('Level restarted',1.2);}
// ---- replay log: every player action is recorded with its tick, so the deterministic sim can be rewound frame by frame ----
function act(e){const s=G.sim;e.t=s.tick;applyAct(s,e);G.log.push(e);handleEvents(s.drain());}
function applyAct(s,e){if(e.a==='assign'){const m=s.miners.find(m=>m.id===e.id);return m?s.assign(m,e.sk):false;}if(e.a==='torch')return s.placeTorch(e.x,e.y);if(e.a==='rate'){s.setRate(e.r);return true;}if(e.a==='nuke'){s.nuke();return true;}}
function rebuildTo(target){const L=LEVELS[G.lvl];const log=G.log.filter(e=>e.t<target);const s=new Sim(L,{seed:7+G.lvl});let k=0;
  while(s.tick<target&&!s.over){while(k<log.length&&log[k].t<=s.tick){applyAct(s,log[k]);k++;}s.step();s.drain();}
  while(k<log.length&&log[k].t<=s.tick){applyAct(s,log[k]);k++;}s.drain();
  const hv=G.hover&&G.hover.id;const om=G.sim.mask,nm=s.mask,W=s.W,Hh=s.Hh,C=32;G.art.s=s;
  for(let cy=0;cy<Hh;cy+=C)for(let cx=0;cx<W;cx+=C){let diff=false;for(let y=cy;y<Math.min(Hh,cy+C)&&!diff;y++){const o=y*W;for(let x=cx;x<Math.min(W,cx+C);x++)if(om[o+x]!==nm[o+x]){diff=true;break;}}if(diff)G.art.rebuild(cx-2,cy-2,cx+C+1,cy+C+1);}
  G.sim=s;G.log=log;G.parts=[];G.flash=[];G.overT=0;G.hover=hv!=null?s.miners.find(m=>m.id===hv&&m.alive)||null:null;updateBar();updateHud();}
function frameBack(n){if(G.state!=='play')return;G.paused=true;const t=Math.max(0,G.sim.tick-n);rebuildTo(t);updateBar();}
function frameStep(n){if(G.state!=='play')return;G.paused=true;const s=G.sim;for(let i=0;i<n&&!s.over;i++){s.step();handleEvents(s.drain());}updateBar();updateHud();}
function fmt(t){t=Math.max(0,Math.ceil(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
function fmtC(t){t=Math.max(0,Math.ceil(t));return Math.floor(t/60)+'-'+String(t%60).padStart(2,'0');}   // classic "4-32"
const ST_UP={walk:'WALKER',fall:'FALLER',climb:'CLIMBER',hoist:'CLIMBER',blocker:'BLOCKER',builder:'BUILDER',basher:'BASHER',miner:'MINER',digger:'DIGGER',shrug:'STOPPED',exit:'HOME'};
function minerType(m){if(m.state==='fall'&&m.floating)return 'FLOATER';if(m.state==='walk'||m.state==='fall'){if(m.fuse>=0)return 'BLASTER';if(m.lamp)return 'LAMP';if(m.climber&&m.floater)return 'ATHLETE';if(m.climber)return 'CLIMBER';if(m.floater)return 'FLOATER';}return ST_UP[m.state]||'';}
function updateHud(){const s=G.sim;if(!s)return;const out=s.miners.filter(m=>m.alive&&m.state!=='exit').length;const pct=Math.floor(s.saved/s.L.total*100),need=Math.round(s.L.quota/s.L.total*100);
  const h=G.hover&&G.hover.alive?G.hover:null;$('stSel').textContent=h?minerType(h)+' '+(G.underN||1):(G.skill?SK_LABEL[G.skill].toUpperCase():'');
  $('stOut').textContent=out;$('stIn').textContent=pct+'%';$('stNeed').textContent=need+'%';$('stTime').textContent=fmtC(s.timeLeft);$('stTimeW').classList.toggle('low',s.timeLeft<30);
  const md=[];if(G.paused)md.push('PAUSED');if(G.speed>1)md.push('FAST');if(G.speed<1)md.push('SLOW');if(G.walkOnly||G.keyWalk)md.push('WALKERS');if(G.selDir||G.keyDir)md.push((G.keyDir||G.selDir)<0?'◄ ONLY':'► ONLY');$('stMode').textContent=md.join(' · ');}
let toastT=0;function toast(t,d=2){const e=$('toast');e.textContent=t;e.style.opacity=1;toastT=d;}
// ---------------- input ----------------
const ptrs=new Map();let tapStart=null,pinch=null,lpTimer=0;
// selection rules: nearest miner under the cursor; a miner that can take the selected skill always wins; busy / skilled miners win ties (classic priority);
// modifiers: walkers only (Ctrl, right-click, long-press or the WALK toggle) and direction only (hold Left/Right arrow or the arrow toggles)
function selFilter(m,walkOnly,dir){if(walkOnly&&!(m.state==='walk'||m.state==='shrug'))return false;if(dir&&m.dir!==dir)return false;return true;}
function pickMiner(sx,sy,opt={}){const s=G.sim;if(!s)return null;const walkOnly=opt.walkOnly!=null?opt.walkOnly:(G.walkOnly||G.keyWalk);const dir=opt.dir!=null?opt.dir:(G.keyDir||G.selDir);
  const R=Math.max(IS_TOUCH?30:22,MH*0.7*G.s);let best=null,bd=1e9,n=0;
  for(const m of s.miners){if(!m.alive||m.state==='exit')continue;const [mx,my]=w2s(m.x,m.y-MH*0.5);const dx=sx-mx,dy=(sy-my)*0.7;const d=Math.hypot(dx,dy);if(d>R)continue;n++;
    if(!selFilter(m,walkOnly,dir))continue;const busy=m.state!=='walk'||m.climber||m.floater||m.lamp;
    const pen=(G.skill&&!s.canAssign(m,G.skill)?R*2:0)-(busy?3:0);if(d+pen<bd){bd=d+pen;best=m;}}G.underN=n;return best;}
function assignAt(sx,sy,opt){const s=G.sim;if(!G.skill){const m=pickMiner(sx,sy,opt);if(m){G.hover=m;updateHud();toast('Pick a skill on the panel, then tap a miner',1.6);}return;}
  if(G.skill==='torch'){const [wx,wy]=s2w(sx,sy);const before=s.skills.torch;act({a:'torch',x:wx|0,y:wy|0});if(s.skills.torch<before){if(s.skills.torch<=0)G.skill=null;}else{G.log.pop();toast('A torch needs open ground');sfx.deny();}updateBar();return;}
  const m=pickMiner(sx,sy,opt);if(!m){return;}
  if(s.canAssign(m,G.skill)){const sk=G.skill;const wasBlock=m.state==='blocker';act({a:'assign',id:m.id,sk});
    if(sk==='walker')toast(wasBlock?'Blocker released':m.state==='walk'?'Walking on':'',1.0);else if(sk==='blocker'&&wasBlock)toast('Blocker released',1.2);
    sfx.tap();if(sk!=='walker'&&s.skills[sk]<=0&&sk!=='blocker')G.skill=null;updateBar();updateHud();}
  else{sfx.deny();}}
const doTap=(sx,sy)=>assignAt(sx,sy);
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{if(G.state!=='play')return;
  if(e.pointerType==='mouse'){G.mouse={x:e.clientX,y:e.clientY,in:true};
    if(e.button===1){togglePause();e.preventDefault();return;}
    if(e.button===2){assignAt(e.clientX,e.clientY,{walkOnly:true});e.preventDefault();return;}   // right-click = walkers only (DOS priority inversion)
    if(e.buttons&2){assignAt(e.clientX,e.clientY,{walkOnly:true});return;}}
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){tapStart={x:e.clientX,y:e.clientY,cx:G.cx,cy:G.cy,t:performance.now(),moved:false,long:false,ctrl:e.ctrlKey||e.metaKey};G.hover=pickMiner(e.clientX,e.clientY,tapStart.ctrl?{walkOnly:true}:{});updateHud();
    if(e.pointerType!=='mouse'){clearTimeout(lpTimer);lpTimer=setTimeout(()=>{if(tapStart&&!tapStart.moved&&ptrs.size===1){tapStart.long=true;G.hover=pickMiner(tapStart.x,tapStart.y,{walkOnly:true});updateHud();toast('Walkers only',0.8);if(navigator.vibrate)navigator.vibrate(12);}},420);}}
  else if(ptrs.size===2){clearTimeout(lpTimer);const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s:G.s,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,cx:G.cx,cy:G.cy};tapStart=null;}});
cv.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')G.mouse={x:e.clientX,y:e.clientY,in:true};if(G.state!=='play')return;const p=ptrs.get(e.pointerId);
  if(!p){if(e.pointerType==='mouse'){G.hover=pickMiner(e.clientX,e.clientY,(e.ctrlKey||e.metaKey)?{walkOnly:true}:{});updateHud();}return;}
  p.x=e.clientX;p.y=e.clientY;
  if(pinch&&ptrs.size>=2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const wx=pinch.mx/pinch.s+pinch.cx,wy=pinch.my/pinch.s+pinch.cy;G.s=pinch.s*d/pinch.d;clampCam();G.cx=wx-mx/G.s;G.cy=wy-my/G.s;clampCam();return;}
  if(tapStart){const dx=e.clientX-tapStart.x,dy=e.clientY-tapStart.y;if(!tapStart.moved&&Math.hypot(dx,dy)>10){tapStart.moved=true;clearTimeout(lpTimer);G.hover=null;}
    if(tapStart.moved){G.cx=tapStart.cx-dx/G.s;G.cy=tapStart.cy-dy/G.s;clampCam();}else{G.hover=pickMiner(e.clientX,e.clientY,(tapStart.long||tapStart.ctrl)?{walkOnly:true}:{});updateHud();}}});
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&G.mouse)G.mouse.in=false;});
document.addEventListener('mouseleave',()=>{if(G.mouse)G.mouse.in=false;});
const endPtr=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);clearTimeout(lpTimer);
  if(ptrs.size<2)pinch=null;
  if(tapStart&&!tapStart.moved&&ptrs.size===0&&G.state==='play')assignAt(e.clientX,e.clientY,(tapStart.long||tapStart.ctrl||e.ctrlKey||e.metaKey)?{walkOnly:true}:{});
  if(ptrs.size===0){tapStart=null;if(e.pointerType!=='mouse'){setTimeout(()=>{if(!ptrs.size){G.hover=null;updateHud();}},350);}}};
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);tapStart=null;pinch=null;clearTimeout(lpTimer);});
cv.addEventListener('wheel',e=>{if(G.state!=='play')return;e.preventDefault();if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){G.cx+=(e.deltaX||e.deltaY)/G.s;clampCam();}else zoomAt(Math.exp(-e.deltaY*0.0015),e.clientX,e.clientY);},{passive:false});
// desktop edge-scroll (mouse within 14px of the play area edge)
function edgeScroll(dt){const m=G.mouse;if(IS_TOUCH||!m||!m.in||ptrs.size||G.state!=='play')return;const E=14,v=420*dt/G.s;let moved=false;
  if(m.x<E){G.cx-=v;moved=true;}else if(m.x>VW-E){G.cx+=v;moved=true;}if(m.y<E){G.cy-=v*0.7;moved=true;}else if(m.y>VH-E&&m.y<VH){G.cy+=v*0.7;moved=true;}if(moved)clampCam();}
const heldKeys=new Set();
function keyMods(){G.keyDir=heldKeys.has('ArrowLeft')?-1:heldKeys.has('ArrowRight')?1:0;G.keyWalk=heldKeys.has('Control')||heldKeys.has('Meta');updateBar();updateHud();
  if(G.mouse&&G.mouse.in&&G.state==='play'){G.hover=pickMiner(G.mouse.x,G.mouse.y);}}
addEventListener('keyup',e=>{heldKeys.delete(e.key);if(['ArrowLeft','ArrowRight','Control','Meta','Shift'].includes(e.key))keyMods();});
addEventListener('blur',()=>{heldKeys.clear();keyMods();});
addEventListener('keydown',e=>{if(G.state!=='play'){if(e.key==='Escape'&&G.state==='paused')closePause();return;}const k=e.key,K=k.length===1?k.toLowerCase():k;
  const FS={F3:'climber',F4:'floater',F5:'blaster',F6:'blocker',F7:'builder',F8:'basher',F9:'miner',F10:'digger'};
  if(/^F([1-9]|1[0-2])$/.test(k))e.preventDefault();
  if(['ArrowLeft','ArrowRight','Control','Meta'].includes(k)){if(e.shiftKey&&k.startsWith('Arrow')){G.cx+=(k==='ArrowLeft'?-1:1)*60/G.s*3;clampCam();return;}heldKeys.add(k);keyMods();e.preventDefault();return;}
  if(k==='ArrowUp'){if(e.shiftKey){G.cy-=30;clampCam();}else cycleSkill(+1);e.preventDefault();return;}
  if(k==='ArrowDown'){if(e.shiftKey){G.cy+=30;clampCam();}else cycleSkill(-1);e.preventDefault();return;}
  if(k==='F1'){e.shiftKey?rate(0,G.sim.minRate):rate(-1);return;}if(k==='F2'){e.shiftKey?rate(0,99):rate(+1);return;}
  if(FS[k]){if(hasSkill(FS[k]))selectSkill(FS[k]);return;}
  if(k==='F11'||k==='Pause'||K==='p'||k===' '){togglePause();e.preventDefault();return;}
  if(k==='F12'||k==='Delete'){nukePress();return;}
  if(k>='0'&&k<='9'){const i=(+k+9)%10;const sk=SKILLS[i];if(sk&&hasSkill(sk))selectSkill(sk);return;}
  if(K==='w'){selectSkill('walker');return;}
  if(k==='-'||k==='_'){e.shiftKey&&k==='_'?rate(0,G.sim.minRate):rate(-1);return;}if(k==='+'||k==='='){k==='+'?rate(0,99):rate(+1);return;}
  if(K==='f'){setSpeed(G.speed>1?1:3);return;}if(K==='s'){setSpeed(G.speed<1?1:0.25);return;}
  if(K==='n'||k==='.'){frameStep(1);return;}if(K==='b'||k===','){frameBack(1);return;}if(k==='Backspace'){frameBack(TPS);e.preventDefault();return;}
  if(K==='r'){restartPress(true);return;}if(K==='m'){G.sound=!G.sound;setMuted(!G.sound);toast('Sound '+(G.sound?'on':'off'),1);return;}
  if(K==='z'){zoomAt(1/1.25,VW/2,VH/2);return;}if(K==='x'){zoomAt(1.25,VW/2,VH/2);return;}
  if(k==='Escape')openPause();});
// ---------------- screens ----------------
const show=(id,v)=>$(id).classList.toggle('hidden',!v);
const STAR='<svg class="star" viewBox="0 0 24 24"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/></svg>';
function buildLevelList(){const el=$('lvList');el.innerHTML='';LEVELS.forEach((L,i)=>{const b=G.best[L.id]||0;const d=document.createElement('div');d.className='lv';
  d.innerHTML=`<div class="num">${i+1}</div><div class="nm">${L.name}</div><div class="ds">${L.tag}</div><div class="stars small">${[0,1,2].map(k=>STAR.replace('class="star"','class="star'+(k<b?' on':'')+'"')).join('')}</div>`;
  d.onclick=()=>{sfx.select();openIntro(i);};el.appendChild(d);});}
function openIntro(i){loadLevel(i);G.state='intro';const L=LEVELS[i];show('levelsS',false);show('result',false);show('pause',false);show('title',false);
  $('iNum').textContent='Level '+(i+1);$('iName').textContent=L.name;$('iHint').textContent=L.hint;$('iTotal').textContent=L.total;$('iQuota').textContent=L.quota+' ('+Math.round(L.quota/L.total*100)+'%)';$('iRate').textContent=L.rate;$('iTime').textContent=fmt(L.time);
  $('iSkills').innerHTML=SKILLS.filter(k=>k in L.skills).map(k=>`<span><img src="${ICON[k]}">${SK_LABEL[k]} ×${L.skills[k]}</span>`).join('');show('intro',true);show('bar',true);show('hud',true);show('mini',true);resize();}
function begin(){initAudio();setMuted(!G.sound);show('intro',false);G.state='play';toast(G.lvl===0?'Tap DIG, then tap a miner on the ledge':'Tap a skill, then tap a miner');}
function openPause(){if(G.state!=='play')return;G.state='paused';show('pause',true);}
function closePause(){G.state='play';show('pause',false);}
function showResult(){const r=G.sim.result,L=G.sim.L;G.state='result';if(r.win){const b=G.best[L.id]||0;if(r.stars>b){G.best[L.id]=r.stars;localStorage.setItem('ll3_best',JSON.stringify(G.best));}}
  $('rSub').textContent='Level '+(G.lvl+1)+' · '+L.name;$('rTitle').textContent=r.win?(r.saved===L.total?'Every Soul Home':'The Lift Rises'):'The Dark Keeps Them';
  $('rStars').innerHTML=[0,1,2].map(k=>STAR.replace('class="star"','class="star'+(r.win&&k<r.stars?' on':'')+'"')).join('');
  $('rSaved').textContent=r.saved+' ('+Math.round(r.saved/L.total*100)+'%)';$('rQuota').textContent=L.quota;$('rLost').textContent=r.lost;
  $('rHint').textContent=r.win?(G.lvl<LEVELS.length-1?'The cage rattles up into the light.':'The last lantern reaches the surface. You brought them home.'):L.hint;
  show('bNext',r.win&&G.lvl<LEVELS.length-1);show('result',true);r.win?sfx.win():sfx.lose();}
$('bPlay').onclick=()=>{initAudio();setMuted(!G.sound);sfx.select();show('title',false);buildLevelList();show('levelsS',true);G.state='levels';};
$('bBackTitle').onclick=()=>{show('levelsS',false);show('title',true);G.state='title';startDemo();};
$('bBegin').onclick=begin;$('bIntroBack').onclick=()=>{show('intro',false);hideGameUI();buildLevelList();show('levelsS',true);G.state='levels';};
$('bResume').onclick=closePause;$('bRetry').onclick=()=>{show('pause',false);openIntro(G.lvl);};$('bRetry2').onclick=()=>openIntro(G.lvl);
$('bLevels').onclick=$('bLevels2').onclick=()=>{show('pause',false);show('result',false);hideGameUI();buildLevelList();show('levelsS',true);G.state='levels';};
$('bNext').onclick=()=>openIntro(G.lvl+1);
const how=()=>{show('how',true);};$('bHow').onclick=how;$('bHow2').onclick=how;$('bHowOk').onclick=()=>show('how',false);
const snd=()=>{G.sound=!G.sound;localStorage.setItem('ll_sound',G.sound?'on':'off');setMuted(!G.sound);$('bSound').textContent=$('bSound2').textContent='Sound: '+(G.sound?'On':'Off');};$('bSound').onclick=snd;$('bSound2').onclick=snd;
function hideGameUI(){show('bar',false);show('hud',false);}
// attract demo behind the title: level 1 auto-played
function startDemo(){loadLevel(0,true);hideGameUI();resize();G.s=Math.max(G.sMin,VH/G.sim.Hh);clampCam();G.demoSteps=0;}
function demoAI(){const s=G.sim;if(s.tick%15)return;if(s.skills.digger>7){const m=s.miners.find(m=>m.alive&&m.state==='walk'&&m.x>300&&m.x<340&&m.y<120);if(m)s.assign(m,'digger');}
  if(s.over&&G.t-G.demoEnd>4)startDemo();if(s.over&&!G.demoEnd)G.demoEnd=G.t;}
// ---------------- main loop ----------------
let last=performance.now();
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;G.t+=dt;
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').style.opacity=0;}
  if(G.nukeArm>0){G.nukeArm-=dt;if(G.nukeArm<=0)updateBar();}if(G.restartArm>0){G.restartArm-=dt;if(G.restartArm<=0)updateBar();}edgeScroll(dt);
  const s=G.sim;
  if(s&&(G.state==='play'||(G.state==='title'&&G.demo))){if(!G.paused){G.acc+=dt*G.speed;let n=0;while(G.acc>=1/TPS&&n<12){s.step();handleEvents(s.drain());if(G.demo)demoAI();G.acc-=1/TPS;n++;}}
    if(G.state==='play'){if(s.tick%6===0)updateHud();if(s.over){G.overT+=dt;if(G.overT>1.8)showResult();}
      // whisper while miners are in the seam
      let dread=0;for(const m of s.miners)if(m.alive)dread=Math.max(dread,m.dread);setWhisper(Math.min(1,dread*0.6));}
    else{G.cx+=Math.sin(G.t*0.08)*0.05;clampCam();}}
  if(s){updParts(G.paused&&G.state==='play'?0:dt*G.speed);for(const f of G.flash)f.t+=dt;G.flash=G.flash.filter(f=>f.t<f.max);G.shake=Math.max(0,G.shake-dt*1.5);}
  draw();requestAnimationFrame(frame);}
(async function boot(){await loadAssets();makeIcons();$('bSound').textContent=$('bSound2').textContent='Sound: '+(G.sound?'On':'Off');
  const QS=new URLSearchParams(location.search);show('loading',false);resize();
  if(QS.has('level')){const i=Math.max(0,Math.min(LEVELS.length-1,(+QS.get('level')||1)-1));openIntro(i);}else{G.state='title';show('title',true);startDemo();}
  requestAnimationFrame(frame);
  window.__LL={G,LEVELS,updateHud,act,frameBack,frameStep,restartLevel,assignAt,openIntro,begin,showResult,pickMiner,doTap,w2s,s2w,selectSkill,centerOn};})();
