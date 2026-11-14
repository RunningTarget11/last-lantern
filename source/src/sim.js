// Last Lantern - deterministic game simulation (no rendering). Runs in the browser and in Node tests.
export const CELL=0.25, LCELL=0.5, SUB=4;
export const P={walk:1.1,foreman:1.75,step:3,head:5,lethal:4.6,grav:15,term:10,darkLum:0.10,turnLum:0.13,followR:6.5,
  flameKinds:{torch:1,flare:1,fixedTorch:1},creatureSpeed:1.25};
export const LIGHT={
  torch:{r:5.5,i:1.0,c:[1.0,0.52,0.22],flame:true},
  fixedTorch:{r:5.5,i:1.0,c:[1.0,0.5,0.2],flame:true},
  lamp:{r:4.6,i:0.85,c:[1.0,0.74,0.42],flame:false},
  fixedLamp:{r:4.6,i:0.85,c:[1.0,0.74,0.42],flame:false},
  foreman:{r:6.5,i:1.05,c:[1.0,0.7,0.38],flame:false},
  flare:{r:7.5,i:1.5,c:[1.0,0.22,0.1],flame:true},
  exit:{r:4.6,i:0.9,c:[0.95,0.78,0.55],flame:false},
};
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967295;}
function vn(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi),b=hash2(xi+1,yi),c=hash2(xi,yi+1),d=hash2(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
export function fbm2(x,y,o=3){let a=.5,s=0,n=0;for(let i=0;i<o;i++){s+=a*vn(x,y);n+=a;x*=2.07;y*=2.07;a*=.5;}return s/n;}

export class Sim{
  constructor(L){
    this.L=L;const rows=L.map;this.H=rows.length;this.W=Math.max(...rows.map(r=>r.length));
    this.ch=(cx,cy)=>{const r=rows[this.H-1-cy];if(!r||cx<0||cx>=this.W)return '=';return r[cx]||'=';};
    this.gw=this.W*SUB;this.gh=this.H*SUB;this.g=new Uint8Array(this.gw*this.gh);// 0 air 1 rock 2 granite 3 rubble
    this.buildTerrain();
    this.lw=this.W*2;this.lh=this.H*2;this.lum=new Float32Array(this.lw*this.lh);
    this.t=0;this.dt=1/60;this.events=[];this.miners=[];this.lights=[];this.flares=[];this.creatures=[];this.zones=[];this.gas=[];
    this.tools={...L.tools};this.spawned=0;this.saved=0;this.lost=0;this.over=false;this.result=null;this.terrainVer=0;this.lightId=0;this.onlyBlockersT=0;
    this.parseMarkers();
  }
  solid(i,j){if(i<0||i>=this.gw||j>=this.gh)return 1;if(j<0)return 0;return this.g[j*this.gw+i];}
  solidAt(x,y){return this.solid(Math.floor(x/CELL),Math.floor(y/CELL));}
  buildTerrain(){
    const W=this.W,H=this.H,cs=(cx,cy)=>{const c=this.ch(cx,cy);return (c==='#'||c==='='||c==='r')?1:0;};
    const S=(x,y)=>{const fx=x-0.5,fy=y-0.5,x0=Math.floor(fx),y0=Math.floor(fy),u=fx-x0,v=fy-y0;
      const a=cs(x0,y0),b=cs(x0+1,y0),c=cs(x0,y0+1),d=cs(x0+1,y0+1);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;};
    for(let j=0;j<this.gh;j++)for(let i=0;i<this.gw;i++){
      const x=(i+.5)*CELL,y=(j+.5)*CELL;const s=S(x,y);
      const below=S(x,y-0.55),above=S(x,y+0.55);const floorness=Math.max(0,Math.min(1,(below-above)*1.6));
      const n=(fbm2(x*0.75+3.1,y*0.75+7.7)-0.5)+0.45*(fbm2(x*2.3,y*2.3)-0.5);
      const A=0.75*(1-floorness)+0.05*floorness;
      let v=s+n*A>0.5?1:0;
      const c=this.ch(Math.floor(x),Math.floor(y));
      if(v){v=c==='='?2:c==='r'?3:1;
        if(c!=='='&&c!=='r'){// granite bleeds into neighbouring rock for natural seams
          let near=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(this.ch(Math.floor(x+dx*0.5),Math.floor(y+dy*0.5))==='=')near=true;if(near)v=2;}}
      if('EXFTLS'.includes(c))v=0;
      this.g[j*this.gw+i]=v;}
    // left/right/top walls are always granite
    for(let j=0;j<this.gh;j++){for(const i of [0,1,this.gw-1,this.gw-2])this.g[j*this.gw+i]=2;}
  }
  groundY(x,y,maxDown=6){// y of the floor surface at or below (x,y)
    const i=Math.floor(x/CELL);let j=Math.floor(y/CELL);
    if(this.solid(i,j)){for(let k=0;k<8&&this.solid(i,j);k++)j++;return j*CELL;}
    for(let k=0;k<maxDown/CELL;k++){if(this.solid(i,j-1))return j*CELL;j--;}return null;}
  parseMarkers(){
    const seen=new Set();const zonesC=[],zonesG=[];
    for(let cy=0;cy<this.H;cy++)for(let cx=0;cx<this.W;cx++){const c=this.ch(cx,cy);const x=cx+0.5,y=cy+0.5;
      if(c==='E'){this.entry={x,y:this.groundY(x,y)};}
      if(c==='X'){const gy=this.groundY(x,y);this.exit={x,y:gy};this.addLight('exit',x+0.9,gy+2.0);}
      if(c==='F'){this.foreman={x,y:this.groundY(x,y),tx:x,dir:1,state:'idle',vy:0,speed:0};}
      if(c==='T'){this.addLight('fixedTorch',x,y+0.3);}
      if(c==='L'){this.addLight('fixedLamp',x,this.groundY(x,y)+0.35);}
      if(c==='S'){this.creatures.push({id:this.creatures.length,x,y,hx:x,hy:y,vx:0,vy:0,alive:true,burn:0,cool:0,phase:cy*1.7+cx});}
      if((c==='C'||c==='G')&&!seen.has(cx+','+cy)){// flood fill a zone
        const st=[[cx,cy]];let x0=cx,x1=cx,y0=cy,y1=cy;seen.add(cx+','+cy);
        while(st.length){const [a,b]=st.pop();x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);
          for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(a+da)+','+(b+db);if(!seen.has(k)&&this.ch(a+da,b+db)===c){seen.add(k);st.push([a+da,b+db]);}}}
        (c==='C'?zonesC:zonesG).push({x0,x1:x1+1,y0,y1:y1+1});}
    }
    zonesC.sort((a,b)=>a.x0-b.x0);
    const timers=this.L.caveins||[];
    zonesC.forEach((z,k)=>{// the zone spans the full tunnel height at its columns
      let y0=z.y0;while(y0>0&&!this.solidAt(z.x0+0.5,y0-0.5))y0-=0.25;
      this.zones.push({...z,y0:this.groundY((z.x0+z.x1)/2,z.y0+0.5)??z.y0,t:timers[k]??60,shored:false,fallen:false,shoring:0,id:k});});
    zonesG.forEach((z,k)=>this.gas.push({...z,alive:true,fuse:-1,id:k}));
    if(!this.foreman){this.foreman={x:this.entry.x+2,y:this.entry.y,tx:this.entry.x+2,dir:1,state:'idle',vy:0,speed:0};}
    this.fLight=this.addLight('foreman',this.foreman.x,this.foreman.y+1.25);
    this.addLight('fixedTorch',this.entry.x+0.2,this.entry.y+2.4).entry=true;
  }
  // ---------------- lighting ----------------
  addLight(kind,x,y){const d=LIGHT[kind];const l={id:++this.lightId,kind,x,y,r:d.r,i:d.i,c:d.c,flame:d.flame,vis:null,key:'',on:true,born:this.t};this.lights.push(l);this.lightDirty=true;this.events.push({type:'light',l});return l;}
  removeLight(l){l.on=false;this.lights=this.lights.filter(o=>o!==l);this.events.push({type:'unlight',l});}
  visOf(l){
    const key=Math.round(l.x*8)+','+Math.round(l.y*8)+','+this.terrainVer;if(l.key===key&&l.vis)return l.vis;
    const R=l.r,i0=Math.max(0,Math.floor((l.x-R)/LCELL)),i1=Math.min(this.lw-1,Math.floor((l.x+R)/LCELL)),j0=Math.max(0,Math.floor((l.y-R)/LCELL)),j1=Math.min(this.lh-1,Math.floor((l.y+R)/LCELL));
    const w=i1-i0+1,h=j1-j0+1;const vis=new Float32Array(w*h);const dirx=new Float32Array(w*h),diry=new Float32Array(w*h);
    const offs=[[0,0],[0.22,0.12],[-0.18,-0.2]];
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const cx=(i+.5)*LCELL,cy=(j+.5)*LCELL;const dx=cx-l.x,dy=cy-l.y;const d=Math.hypot(dx,dy);if(d>=R)continue;
      let v=0;for(const [ox,oy] of offs){const sx=l.x+ox,sy=l.y+oy;const ddx=cx-sx,ddy=cy-sy;const dd=Math.hypot(ddx,ddy);const n=Math.ceil(dd/0.18);let ok=1;
        for(let s=1;s<n;s++){const t=s/n;if(t*dd<0.12||dd*(1-t)<0.42)continue;if(this.solidAt(sx+ddx*t,sy+ddy*t)){ok=0;break;}}v+=ok;}
      if(!v)continue;const f=Math.pow(1-d/R,1.5)*l.i*(v/3);const k=(j-j0)*w+(i-i0);vis[k]=f;dirx[k]=d>0.01?-dx/d:0;diry[k]=d>0.01?-dy/d:0;}
    l.vis=vis;l.dirx=dirx;l.diry=diry;l.box=[i0,j0,w,h];l.key=key;return vis;}
  recombine(){const lum=this.lum;lum.fill(0);for(const l of this.lights){if(!l.on)continue;const v=this.visOf(l);const [i0,j0,w,h]=l.box;
      for(let y=0;y<h;y++){const row=(j0+y)*this.lw+i0,vr=y*w;for(let x=0;x<w;x++){const f=v[vr+x];if(f)lum[row+x]+=f;}}}}
  lumAt(x,y){const fx=x/LCELL-0.5,fy=y/LCELL-0.5;let i=Math.floor(fx),j=Math.floor(fy);const u=fx-i,v=fy-j;
    const g=(a,b)=>{a=Math.max(0,Math.min(this.lw-1,a));b=Math.max(0,Math.min(this.lh-1,b));return this.lum[b*this.lw+a];};
    return g(i,j)*(1-u)*(1-v)+g(i+1,j)*u*(1-v)+g(i,j+1)*(1-u)*v+g(i+1,j+1)*u*v;}
  lightReaches(l,x,y){const v=this.visOf(l);const [i0,j0,w,h]=l.box;const i=Math.floor(x/LCELL)-i0,j=Math.floor(y/LCELL)-j0;if(i<0||j<0||i>=w||j>=h)return 0;return v[j*w+i];}
  // ---------------- terrain edits ----------------
  setCell(i,j,v){if(i<2||i>=this.gw-2||j<0||j>=this.gh)return;this.g[j*this.gw+i]=v;}
  dirty(x0,y0,x1,y1){this.terrainVer++;this.events.push({type:'terrain',x0,y0,x1,y1});}
  // ---------------- commands ----------------
  moveForeman(x){this.foreman.tx=Math.max(0.7,Math.min(this.W-0.7,x));}
  minerAt(x,y,r=0.9){let best=null,bd=r;for(const m of this.miners){if(!m.active)continue;const d=Math.hypot(m.x-x,(m.y+0.85)-y);if(d<bd){bd=d;best=m;}}return best;}
  assign(m,role){
    if(!m||!m.active)return 'none';
    if(m.state==='block'){m.state='walk';if(Math.abs(this.foreman.x-m.x)>1)m.dir=Math.sign(this.foreman.x-m.x);this.events.push({type:'release',m});if(role==='lantern'||!role)return 'released';}
    if(!role||role==='lantern')return 'none';
    if(!(this.tools[role]>0))return 'empty';
    const onGround=m.state==='walk'||m.state==='idle';
    if(role==='digger'){if(!onGround)return 'busy';m.state='dig';m.t=0;m.digRows=0;}
    else if(role==='blocker'){if(!onGround)return 'busy';m.state='block';m.t=0;}
    else if(role==='shorer'){if(m.role==='shorer'||m.state==='shore')return 'busy';m.role='shorer';}
    else if(role==='flare'){if(!onGround)return 'busy';m.state='throw';m.t=0;m.thrown=false;}
    this.tools[role]--;this.events.push({type:'assign',m,role});return 'ok';}
  placeLight(kind,x,y){
    if(!(this.tools[kind]>0))return null;if(x<0.6||x>this.W-0.6||y<0.3||y>this.H-0.3)return null;
    // find nearest air spot
    let px=x,py=y;if(this.solidAt(px,py)){let found=false;for(let r=0.25;r<=1.5&&!found;r+=0.25)for(let a=0;a<16&&!found;a++){const qx=x+Math.cos(a/16*6.283)*r,qy=y+Math.sin(a/16*6.283)*r;if(!this.solidAt(qx,qy)){px=qx;py=qy;found=true;}}if(!found)return null;}
    let l;
    if(kind==='lamp'){const gy=this.groundY(px,py,4);if(gy==null)return null;l=this.addLight('lamp',px,gy+0.35);l.mount='ground';}
    else{const gy=this.groundY(px,py,2.2);if(gy!=null){py=gy+1.5;let k=0;while(this.solidAt(px,py)&&k++<6)py-=0.2;l=this.addLight('torch',px,py);l.mount='stand';l.gy=gy;}
      else{l=this.addLight('torch',px,py);l.mount='wall';}}
    this.tools[kind]--;return l;}
  // ---------------- walking ----------------
  stepWalk(m,dir,speed,maxDrop){
    const nx=m.x+dir*speed*this.dt;const i1=Math.floor(m.x/CELL),i2=Math.floor(nx/CELL);let j=Math.round(m.y/CELL);
    if(i2===i1){m.x=nx;if(!this.solid(i1,j-1)){return this.startFall(m,maxDrop);}return 'ok';}
    let nj=null;
    if(this.solid(i2,j)){for(let k=1;k<=P.step;k++)if(!this.solid(i2,j+k)){nj=j+k;break;}if(nj===null)return 'wall';}
    else{nj=j;let k=0;while(k<P.step&&!this.solid(i2,nj-1)){nj--;k++;}
      if(!this.solid(i2,nj-1)){if(maxDrop!=null){const gy=this.groundY(nx,m.y,maxDrop+0.3);if(gy==null||m.y-gy>maxDrop)return 'ledge';}
        for(let h=1;h<=P.head;h++)if(this.solid(i2,j+h))return 'wall';
        m.x=nx;return this.startFall(m);}}
    for(let h=1;h<=P.head;h++)if(this.solid(i2,nj+h))return 'wall';
    m.x=nx;m.y=nj*CELL;return 'ok';}
  startFall(m,maxDrop){m.state='fall';m.vy=0;m.fallY=m.y;return 'fall';}
  stepFall(m){m.vy=Math.max(m.vy-P.grav*this.dt,-P.term);const ny=m.y+m.vy*this.dt;const i=Math.floor(m.x/CELL);
    if(ny<-1){return 'abyss';}
    const jn=Math.floor(ny/CELL);if(this.solid(i,jn)&&ny<m.y){let j=jn;while(this.solid(i,j))j++;m.y=j*CELL;m.vy=0;return 'land';}
    m.y=ny;return 'falling';}
  // ---------------- main tick ----------------
  tick(){
    if(this.over)return;const dt=this.dt;this.t+=dt;const L=this.L;
    // foreman light follows him
    const fm=this.foreman;this.fLight.x=fm.x+fm.dir*0.25;this.fLight.y=fm.y+1.25;
    // flares
    for(const f of this.flares){f.life-=dt;if(!f.rest){f.vy-=9.8*dt;const nx=f.x+f.vx*dt,ny=f.y+f.vy*dt;
        if(this.solidAt(nx,ny)){if(!this.solidAt(f.x,ny)){f.vx*=-0.35;}else if(f.vy<0){f.vy=0;f.vx*=0.5;if(Math.abs(f.vx)<0.3){f.rest=true;f.vx=0;}}else f.vy*=-0.3;}else{f.x=nx;f.y=ny;}
        if(f.y<-1)f.life=0;}
      else{if(!this.solidAt(f.x,f.y-0.08)){f.rest=false;}}
      f.light.x=f.x;f.light.y=f.y+0.15;if(f.life<=0&&f.light.on){this.removeLight(f.light);this.events.push({type:'flareout',f});}}
    this.flares=this.flares.filter(f=>f.life>0);
    this.recombine();
    // spawning
    if(this.spawned<L.total&&this.t>2.5+this.spawned*L.spawnEvery){this.spawnMiner();}
    // foreman
    this.tickForeman();
    // miners
    for(const m of this.miners)if(m.active)this.tickMiner(m);
    this.tickZones();this.tickGas();this.tickCreatures();
    // end conditions
    const mobile=this.miners.filter(m=>m.active&&m.state!=='block').length,blockers=this.miners.filter(m=>m.active&&m.state==='block').length;
    if(this.spawned>=L.total&&mobile===0){if(blockers===0)this.finish('done');else{this.onlyBlockersT+=dt;if(this.onlyBlockersT>12)this.finish('done');}}else this.onlyBlockersT=0;
    if(this.t>=L.time)this.finish('time');
  }
  finish(why){if(this.over)return;this.over=true;for(const m of this.miners)if(m.active){m.active=false;m.state='left';this.lost++;}
    const s=this.saved,st=this.L.stars;const stars=s>=st[2]?3:s>=st[1]?2:s>=st[0]?1:0;this.result={why,saved:s,lost:this.lost,stars,win:s>=this.L.quota,time:this.t};this.events.push({type:'over',result:this.result});}
  spawnMiner(){const e=this.entry;const k=this.spawned++;const m={id:k,x:e.x+(k%3-1)*0.06,y:e.y,dir:this.L.dir,state:'walk',active:true,fear:0,vy:0,t:0,role:null,off:((k*0.618)%1)*1.6-0.8,turnCd:0,shoreT:0};this.miners.push(m);this.events.push({type:'spawn',m});}
  kill(m,how){if(!m.active)return;m.active=false;m.state=how;m.t=0;this.lost++;this.events.push({type:'lost',m,how});}
  tickForeman(){const fm=this.foreman;const dt=this.dt;
    if(fm.state==='fall'){const r=this.stepFall(fm);if(r==='land'){fm.state='idle';this.events.push({type:'land',m:fm});}if(r==='abyss'){fm.y=this.entry.y;fm.x=this.entry.x;fm.state='idle';}fm.speed=0;return;}
    const dx=fm.tx-fm.x;if(Math.abs(dx)<0.12){fm.state='idle';fm.speed=0;if(!this.solidAt(fm.x,fm.y-0.1)){this.startFall(fm);}return;}
    fm.dir=Math.sign(dx);fm.state='walk';const r=this.stepWalk(fm,fm.dir,Math.min(P.foreman,Math.abs(dx)/dt),4.4);
    if(r==='wall'||r==='ledge'){fm.tx=fm.x;fm.state='idle';this.events.push({type:'blocked',m:fm,why:r});}fm.speed=r==='ok'?P.foreman:0;}
  blockerAhead(m,dir){for(const b of this.miners){if(b===m||!b.active||b.state!=='block')continue;const d=(b.x-m.x)*dir;if(d>0&&d<0.5&&Math.abs(b.y-m.y)<1.3)return b;}return null;}
  tickMiner(m){
    const dt=this.dt;m.t+=dt;m.turnCd-=dt;
    const lum=this.lumAt(m.x,m.y+1.0);m.lum=lum;
    // darkness
    if(['walk','idle','dig','block','shore','throw','fall'].includes(m.state)){
      if(lum<P.darkLum)m.fear+=dt/this.L.darkTime*(lum<P.darkLum*0.5?1:0.6);else m.fear=Math.max(0,m.fear-dt/1.2);
      if(m.fear>=1){this.kill(m,'taken');return;}}
    // exit
    const ex=this.exit;if(m.state!=='fall'&&Math.abs(m.x-ex.x)<0.75&&m.y>ex.y-0.4&&m.y<ex.y+1.5){m.active=false;m.state='saved';this.saved++;this.events.push({type:'saved',m});return;}
    switch(m.state){
      case 'fall':{const r=this.stepFall(m);if(r==='abyss'){this.kill(m,'fell');return;}
        if(r==='land'){const h=m.fallY-m.y;if(h>P.lethal){this.kill(m,'fell');return;}m.state='walk';m.t=0;this.events.push({type:'land',m,h});}m.speed=0;return;}
      case 'block':m.speed=0;return;
      case 'dig':{m.speed=0;if(m.t<0.3)return;m.t=0;const ic=Math.floor(m.x/CELL),j=Math.round(m.y/CELL)-1;
        for(let i=ic-2;i<=ic+2;i++)if(this.solid(i,j)===2){m.state='walk';this.events.push({type:'digstop',m});return;}
        for(let i=ic-2;i<=ic+2;i++)this.setCell(i,j,0);m.y-=CELL;m.digRows++;this.dirty((ic-2)*CELL,j*CELL,(ic+3)*CELL,(j+1)*CELL);this.events.push({type:'dig',m,x:m.x,y:m.y});
        let below=false;for(let i=ic-1;i<=ic;i++)if(this.solid(i,j-1))below=true;
        if(!below){m.state='fall';m.vy=0;m.fallY=m.y;}return;}
      case 'shore':{m.speed=0;const z=m.zone;if(z.fallen){m.state='walk';return;}if(m.t>3.2){z.shored=true;z.shoring=0;m.state='walk';m.role=null;this.events.push({type:'shored',z,m});}else z.shoring=m.t/3.2;return;}
      case 'throw':{m.speed=0;if(!m.thrown&&m.t>0.55){m.thrown=true;const f={x:m.x+m.dir*0.35,y:m.y+1.7,vx:m.dir*4.6,vy:3.4,life:30,rest:false};f.light=this.addLight('flare',f.x,f.y);this.flares.push(f);this.events.push({type:'flare',f,m});}
        if(m.t>1.1)m.state='walk';return;}
    }
    // walk / idle with follow + light seeking
    if(m.role==='shorer'){for(const z of this.zones){if(!z.shored&&!z.fallen&&m.x>z.x0+0.3&&m.x<z.x1-0.3&&m.y>=z.y0-0.5&&m.y<z.y1){m.state='shore';m.t=0;m.zone=z;this.events.push({type:'shoring',m,z});return;}}}
    const fm=this.foreman;let want=m.dir,idle=false;
    if(fm.state!=='fall'&&Math.abs(fm.x-m.x)<P.followR&&Math.abs(fm.y-m.y)<2.2&&this.lightReaches(this.fLight,m.x,m.y+1.0)>0.05){
      const nearExit=Math.abs(fm.x-this.exit.x)<2.6&&Math.abs(fm.y-this.exit.y)<1;const tx=nearExit?this.exit.x:fm.x+m.off;const d=tx-m.x;if(Math.abs(d)<0.15)idle=true;else want=Math.sign(d);
      if(!idle&&this.blockerAhead(m,want))idle=true;m.following=true;}
    else{m.following=false;
      if(lum<P.turnLum&&m.turnCd<=0){const a=this.lumAt(m.x-1.6,m.y+1.0),b=this.lumAt(m.x+1.6,m.y+1.0);const best=Math.max(a,b);
        if(best>lum+0.015){const nd=b>a?1:-1;if(nd!==m.dir){m.dir=nd;m.turnCd=0.6;this.events.push({type:'turn',m});}want=m.dir;}}}
    if(idle){m.state='idle';m.speed=0;if(!this.solid(Math.floor(m.x/CELL),Math.round(m.y/CELL)-1))this.startFall(m);return;}
    m.state='walk';m.dir=want;
    if(this.blockerAhead(m,m.dir)){m.dir=-m.dir;m.turnCd=0.4;}
    const sp=P.walk*(m.fear>0.3?1.18:1);const r=this.stepWalk(m,m.dir,sp,null);
    if(r==='wall'){m.dir=-m.dir;m.turnCd=0.3;}m.speed=r==='ok'?sp:0;
  }
  tickZones(){for(const z of this.zones){if(z.shored||z.fallen)continue;const left=z.t-this.t;z.left=left;
      if(left<=0){z.fallen=true;// fill tunnel with rubble
        const ia=Math.floor(z.x0/CELL),ib=Math.ceil(z.x1/CELL),ja=Math.floor((z.y0)/CELL),jb=Math.ceil(z.y1/CELL)+2;
        for(let j=ja;j<jb;j++)for(let i=ia;i<ib;i++)if(!this.solid(i,j))this.setCell(i,j,3);
        this.dirty(z.x0,z.y0,z.x1,z.y1+0.5);
        for(const m of this.miners)if(m.active&&m.x>z.x0-0.2&&m.x<z.x1+0.2&&m.y>z.y0-0.6&&m.y<z.y1+0.3)this.kill(m,'crushed');
        const fm=this.foreman;if(fm.x>z.x0-0.2&&fm.x<z.x1+0.2&&fm.y>z.y0-0.6&&fm.y<z.y1+0.3){fm.x=fm.dir>0?z.x0-0.4:z.x1+0.4;fm.y=this.groundY(fm.x,fm.y+1.5)??fm.y;fm.tx=fm.x;}
        this.events.push({type:'cavein',z});}}}
  tickGas(){for(const g of this.gas){if(!g.alive)continue;
      if(g.fuse<0){for(const l of this.lights){if(!l.on||!l.flame)continue;if(l.x>g.x0-0.8&&l.x<g.x1+0.8&&l.y>g.y0-0.8&&l.y<g.y1+0.8){g.fuse=0.45;this.events.push({type:'ignite',g,l});break;}}}
      else{g.fuse-=this.dt;if(g.fuse<=0)this.explode(g);}}}
  explode(g){g.alive=false;const cx=(g.x0+g.x1)/2,cy=(g.y0+g.y1)/2;const R=Math.max(g.x1-g.x0,g.y1-g.y0)/2+2.6;
    for(let j=Math.floor((cy-R)/CELL);j<=Math.ceil((cy+R)/CELL);j++)for(let i=Math.floor((cx-R)/CELL);i<=Math.ceil((cx+R)/CELL);i++){const x=(i+.5)*CELL,y=(j+.5)*CELL;const d=Math.hypot((x-cx)*0.85,y-cy);
      const v=this.solid(i,j);const nz=0.45*fbm2(x*2,y*2);if((v===3&&d<R-nz)||(v===1&&d<R*0.62-nz&&y>g.y0+0.1))this.setCell(i,j,0);}
    this.dirty(cx-R,cy-R,cx+R,cy+R);
    for(const m of this.miners)if(m.active&&Math.hypot(m.x-cx,m.y+0.9-cy)<R+0.6)this.kill(m,'blast');
    for(const l of [...this.lights])if(l.flame&&Math.hypot(l.x-cx,l.y-cy)<R){if(l.kind==='flare'){const f=this.flares.find(f=>f.light===l);if(f)f.life=0;}this.removeLight(l);}
    for(const c of this.creatures)if(c.alive&&Math.hypot(c.x-cx,c.y-cy)<R+1){c.alive=false;this.events.push({type:'banish',c});}
    const fm=this.foreman;if(!this.solidAt(fm.x,fm.y-0.1)&&fm.state!=='fall')this.startFall(fm);
    for(const m of this.miners)if(m.active&&(m.state==='walk'||m.state==='idle'||m.state==='block')&&!this.solid(Math.floor(m.x/CELL),Math.round(m.y/CELL)-1))this.startFall(m);
    this.events.push({type:'boom',x:cx,y:cy,R});
    for(const o of this.gas)if(o.alive&&o.fuse<0&&Math.hypot((o.x0+o.x1)/2-cx,(o.y0+o.y1)/2-cy)<R+1.5)o.fuse=0.35;}
  tickCreatures(){const dt=this.dt;for(const c of this.creatures){if(!c.alive)continue;c.cool-=dt;c.phase+=dt;
      const lum=this.lumAt(c.x,c.y);c.lum=lum;
      if(lum>0.42){c.burn+=dt;if(c.burn>1.1){c.alive=false;this.events.push({type:'banish',c});continue;}}else c.burn=Math.max(0,c.burn-dt*0.5);
      let tx=c.hx+Math.sin(c.phase*0.5)*2.5,ty=c.hy+Math.sin(c.phase*0.8)*0.6,sp=0.6;
      if(lum>0.16){// flee towards darker air
        let best=null,bl=lum;for(let a=0;a<8;a++){const qx=c.x+Math.cos(a*0.785)*1.2,qy=c.y+Math.sin(a*0.785)*1.2;if(this.solidAt(qx,qy))continue;const q=this.lumAt(qx,qy);if(q<bl){bl=q;best=[qx,qy];}}
        if(best){tx=best[0];ty=best[1];sp=2.0;}}
      else if(c.cool<=0){let tm=null,bd=9;for(const m of this.miners){if(!m.active||m.state==='fall')continue;const d=Math.hypot(m.x-c.x,m.y+0.9-c.y);if(d<bd&&this.lumAt(m.x,m.y+0.9)<0.3){bd=d;tm=m;}}
        if(tm){tx=tm.x;ty=tm.y+0.9;sp=P.creatureSpeed;if(bd<0.7){this.kill(tm,'taken');tm.by=c.id;c.cool=3;this.events.push({type:'snatch',c,m:tm});}}}
      const dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy);if(d>0.05){const vx=dx/d*sp,vy=dy/d*sp;c.vx+=(vx-c.vx)*Math.min(1,dt*3);c.vy+=(vy-c.vy)*Math.min(1,dt*3);}
      const ok=(x,y)=>!this.solidAt(x,y)&&(lum>0.16||this.lumAt(x,y)<0.2);
      const nx=c.x+c.vx*dt,ny=c.y+c.vy*dt;if(ok(nx,c.y))c.x=nx;else c.vx*=-0.3;if(ok(c.x,ny))c.y=ny;else c.vy*=-0.3;}}
  drainEvents(){const e=this.events;this.events=[];return e;}
}
