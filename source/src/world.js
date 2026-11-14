// Builds and animates the 3D view of one level from the simulation state and its event stream.
import * as THREE from 'three';
import {CELL} from './sim.js';
import {TerrainView} from './terrain.js';
import {LightField,LMU} from './lm.js';
import {MAT,timberSet,makeTorchProp,torchBracket,torchStand,makeDavyLamp,makeFlareProp,makeLift,makeRailRun,makeCart,rubbleHeap,makeHalo,updatePropTime} from './props.js';
import {Particles,makeAtmosphere,makeGas,makeCreature} from './fx.js';
import {makeChar,play,propFor,MODELS} from './chars.js';
import {sfx,setWhisper} from './audio.js';
const lerp=(a,b,t)=>a+(b-a)*t;
export class World{
  constructor(sim,scene,T,opt={}){
    this.sim=sim;this.scene=scene;this.opt=opt;this.root=new THREE.Group();scene.add(this.root);
    this.terrain=new TerrainView(sim,T,this.root);this.lf=new LightField(sim);
    this.atmo=makeAtmosphere(sim.W,sim.H,this.root);
    this.fxAdd=new Particles(900,true,this.root);this.fxAlpha=new Particles(1400,false,this.root);this.fxDust=new Particles(500,true,this.root);
    this.lightVis=new Map();this.chars=new Map();this.labels=[];this.shake=0;this.t=0;this.savedShown=0;this.timbers=[];
    this.decorate();
    for(const l of sim.lights)this.onLight(l);
    this.foreman=makeChar('foreman');this.root.add(this.foreman.root);if(opt.realLantern)this.foreman.root.traverse(o=>{o.castShadow=false;});
    this.creatures=sim.creatures.map(c=>{const m=makeCreature(this.root);m.position.set(c.x,c.y,0.95);return m;});
    this.gasMeshes=sim.gas.map(g=>makeGas(g,this.root));
    if(opt.realLantern){const pl=new THREE.PointLight(0xffb070,7,7,1.6);pl.castShadow=true;pl.shadow.mapSize.set(opt.shadowSize||512,opt.shadowSize||512);pl.shadow.bias=-0.006;pl.shadow.normalBias=0.03;pl.shadow.camera.near=0.15;pl.shadow.camera.far=9;this.root.add(pl);this.lantern=pl;}
    sim.drainEvents();
  }
  dispose(){this.scene.remove(this.root);this.root.traverse(o=>{if(o.geometry&&o.geometry.dispose&&!o.isSkinnedMesh)o.geometry.dispose();});}
  // ---------------- static decoration ----------------
  floorsInColumn(x){const s=this.sim,i=Math.floor(x/CELL);const out=[];for(let j=1;j<s.gh-1;j++){if(!s.solid(i,j)&&s.solid(i,j-1)){let h=0;while(j+h<s.gh&&!s.solid(i,j+h))h++;out.push({y:j*CELL,h:h*CELL});}}return out;}
  flatAround(x,y,w){const s=this.sim;for(let dx=-w;dx<=w;dx+=0.25){const g=s.groundY(x+dx,y+0.6,1.2);if(g==null||Math.abs(g-y)>0.3)return false;}return true;}
  nearSpecial(x,y,r){const s=this.sim;if(Math.hypot(x-s.entry.x,y-s.entry.y)<r||Math.hypot(x-s.exit.x-0.3,y-s.exit.y)<r+0.6)return true;for(const z of s.zones)if(x>z.x0-1&&x<z.x1+1&&y>z.y0-1&&y<z.y1+1)return true;return false;}
  decorate(){const s=this.sim,R=this.root;let seed=s.L.id*977;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    // timber sets
    for(let x=1.6;x<s.W-1;x+=2.6+rnd()*1.4){for(const f of this.floorsInColumn(x)){if(f.h<2.3||f.h>4.6||!this.flatAround(x,f.y,0.3)||this.nearSpecial(x,f.y,1.6))continue;
        for(const g of s.gas)if(x>g.x0-0.5&&x<g.x1+0.5&&f.y>g.y0-1&&f.y<g.y1)continue;
        const t=timberSet(f.y,f.h,{front:false});t.position.x=x;R.add(t);this.timbers.push({obj:t,x,y:f.y});}}
    // rails on long flat runs
    for(const f0 of this.collectRuns()){if(f0.x1-f0.x0<6||rnd()<0.35)continue;R.add(makeRailRun(f0.x0+0.4,f0.x1-0.4,f0.y));
      if(rnd()<0.6){const c=makeCart();const cx=rnd()<0.5?f0.x0+1.4:f0.x1-1.4;if(!this.nearSpecial(cx,f0.y,2.5)){c.position.set(cx,f0.y,-1.15);c.rotation.y=0.08;c.scale.setScalar(0.95);R.add(c);}}}
    // clutter: Poly Haven CC0 crates and barrels against the back wall, loose rock along the floor edges
    const prop=(k,x,y,z,sc,ry)=>{const M=MODELS[k];if(!M)return;const o=M.scene.clone(true);const f=sc/Math.max(M.size.x,M.size.y,M.size.z);o.scale.setScalar(f);o.position.set(x,y-M.min.y*f,z);o.rotation.y=ry;R.add(o);};
    const rocks=[];
    for(const f0 of this.collectRuns(3)){for(let x=f0.x0+1;x<f0.x1-1;x+=1.8+rnd()*3){if(this.nearSpecial(x,f0.y,2.2))continue;const r=rnd();
        if(r<0.12)prop('wooden_crate_01',x,f0.y,-1.25,0.75,rnd()*0.6);else if(r<0.2){prop('wine_barrel_01',x,f0.y,-1.3,0.8,rnd()*3);}
        else if(r<0.25){prop('wooden_crate_01',x,f0.y,-1.3,0.75,0.2);prop('wooden_crate_01',x+0.1,f0.y+0.72,-1.3,0.62,0.9);}
        for(let k=0;k<3;k++){const zb=rnd()<0.8?-1.0-rnd()*0.7:-0.75+rnd()*0.2;rocks.push([x+(rnd()-0.5)*1.4,f0.y,zb,0.06+rnd()*0.16]);}}}
    if(rocks.length){const im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),MAT.rubble,rocks.length);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
      rocks.forEach((r,i)=>{e.set(rnd()*3,rnd()*3,rnd()*3);q.setFromEuler(e);m4.compose(new THREE.Vector3(r[0],r[1]+r[3]*0.4,r[2]),q,new THREE.Vector3(r[3]*1.3,r[3]*0.8,r[3]));im.setMatrixAt(i,m4);});im.castShadow=true;R.add(im);}
    // entrance: a timbered side adit the crew stumbles out of
    {const e=s.entry;const g=new THREE.Group();const p1=timberSet(0,2.6,{front:false});p1.position.x=-0.8;const p2=timberSet(0,2.6,{front:false});p2.position.x=0.8;g.add(p1,p2);
      const lin=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.22,0.3),MAT.timber);lin.position.set(0,2.55,-1.45);g.add(lin);
      const dark=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.45),new THREE.MeshBasicMaterial({color:0x000000}));dark.position.set(0,1.22,-1.6);g.add(dark);
      for(let k=0;k<3;k++){const pl=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.18,0.05),MAT.timberDark);pl.position.set(0.1,0.5+k*0.75,-1.35);pl.rotation.z=(k-1)*0.35+0.2;if(k===1)pl.position.x=0.5;g.add(pl);}
      g.position.set(e.x,e.y,0);R.add(g);}
    // exit lift
    {const x=s.exit;const lift=makeLift();lift.position.set(x.x+0.3,x.y,-0.35);R.add(lift);this.lift=lift;
      const lamp=makeDavyLamp(1.3,true);lamp.position.set(x.x+0.9-0.3,2.0-0.4,0.9);lift.userData.cage.add(lamp);
      const sign=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.28,0.04),MAT.timberDark);sign.position.set(0,2.8,0.9);lift.userData.cage.add(sign);}
    // rubble near the blast wall reads as loose rock
  }
  collectRuns(minLen=6){const s=this.sim,runs=[];const seen=new Set();
    for(let x=1;x<s.W-1;x+=0.5)for(const f of this.floorsInColumn(x)){const k=Math.round(f.y*4);if(seen.has(k+':'+Math.round(x*2)))continue;
      let x1=x;while(x1<s.W-1&&this.flatAround(x1+0.5,f.y,0)){x1+=0.5;seen.add(k+':'+Math.round(x1*2));}if(x1-x>=minLen&&f.h>2.2)runs.push({x0:x,x1,y:f.y});}
    return runs;}
  // ---------------- light visuals ----------------
  onLight(l){let o=null;
    if(l.kind==='fixedTorch'||(l.kind==='torch'&&l.mount!=='stand')){o=new THREE.Group();const t=makeTorchProp();t.rotation.z=0.18*(l.id%2?1:-1);t.rotation.x=-0.25;o.add(t);o.add(torchBracket());o.position.set(l.x,l.y,l.entry?-0.9:-1.05);o.userData.torch=t;}
    else if(l.kind==='torch'){o=new THREE.Group();const st=torchStand(l.y-l.gy-0.15);st.position.y=l.gy-l.y;o.add(st);const t=makeTorchProp();o.add(t);o.position.set(l.x,l.y,0.15);o.userData.torch=t;}
    else if(l.kind==='lamp'||l.kind==='fixedLamp'){o=makeDavyLamp(1.6,true);o.position.set(l.x,l.y-0.35,0.25);}
    else if(l.kind==='flare'){o=makeFlareProp();o.position.set(l.x,l.y,0.2);}
    if(o){this.root.add(o);this.lightVis.set(l.id,o);if(this.ready){if(l.kind==='torch'){sfx.ignite();this.puff(l.x,l.y,6,[1,0.6,0.2]);}if(l.kind==='lamp')sfx.place();if(l.kind==='flare')sfx.flare();}}}
  offLight(l){const o=this.lightVis.get(l.id);if(o){this.root.remove(o);this.lightVis.delete(l.id);for(let k=0;k<8;k++)this.fxAlpha.emit({x:l.x,y:l.y,z:0.2,vx:(Math.random()-0.5)*0.3,vy:0.4+Math.random()*0.4,life:2.5,size:0.25,size1:0.9,col:[0.5,0.48,0.45],a:0.5,lit:true,drag:0.5});}}
  // ---------------- particles helpers ----------------
  puff(x,y,n,col,spd=1){for(let k=0;k<n;k++)this.fxAdd.emit({x,y,z:0.2,vx:(Math.random()-0.5)*2*spd,vy:Math.random()*2*spd,life:0.5+Math.random()*0.5,size:0.06,size1:0.01,col:[col[0]*3,col[1]*3,col[2]*3],a:1,grav:3,drag:1});}
  dust(x,y,n,w=0.5,dark=false){for(let k=0;k<n;k++)this.fxAlpha.emit({x:x+(Math.random()-0.5)*w,y:y+Math.random()*0.3,z:(Math.random()-0.5)*1.6,vx:(Math.random()-0.5)*1.2,vy:Math.random()*0.8,life:1.5+Math.random()*2,size:0.25,size1:1.1+Math.random(),col:dark?[0.05,0.04,0.06]:[0.75,0.68,0.6],a:dark?0.7:0.45,lit:!dark,drag:1.2,grav:-0.05});}
  debris(x,y,n,spd=3){for(let k=0;k<n;k++)this.fxAlpha.emit({x,y,z:(Math.random()-0.5)*1.5,vx:(Math.random()-0.5)*spd*2,vy:Math.random()*spd,life:1.2+Math.random(),size:0.05+Math.random()*0.07,col:[0.45,0.4,0.36],a:1,a1:1,lit:true,grav:12,floor:null});}
  // ---------------- events ----------------
  handle(evts){const s=this.sim;
    for(const e of evts){switch(e.type){
      case 'light':this.onLight(e.l);break;
      case 'unlight':this.offLight(e.l);break;
      case 'spawn':{const c=makeChar('miner',e.m.id);c.root.position.set(e.m.x,e.m.y,-1.7);c.emerge=0;c.ex=e.m.x;c.u.dis.value=0.9;this.root.add(c.root);this.chars.set(e.m.id,c);break;}
      case 'terrain':this.terrain.update(e.x0,e.y0,e.x1,e.y1);this.checkTimbers();break;
      case 'dig':{this.debris(e.x,e.y+0.1,4,1.6);this.dust(e.x,e.y,2,0.8);const c=this.chars.get(e.m.id);if(c&&Math.random()<0.6)sfx.pick();break;}
      case 'digstop':sfx.deny();break;
      case 'lost':{const c=this.chars.get(e.m.id);if(!c)break;c.lost=e.how;c.lostT=0;
        if(e.how==='taken'){sfx.taken();for(let k=0;k<26;k++)this.fxAlpha.emit({x:e.m.x+(Math.random()-0.5)*0.8,y:e.m.y+Math.random()*0.3,z:c.root.position.z,vx:(Math.random()-0.5)*0.4,vy:0.6+Math.random()*1.4,life:1.6+Math.random(),size:0.2,size1:0.9,col:[0.0,0.0,0.01],a:0.85,drag:0.6,fadeIn:0.3});}
        else if(e.how==='crushed'){c.root.visible=false;}
        else if(e.how==='fell'){sfx.fell();}
        else if(e.how==='blast'){c.root.visible=false;}
        break;}
      case 'saved':{const c=this.chars.get(e.m.id);if(c){c.saved=true;c.savedIdx=this.savedShown++;}sfx.saved();break;}
      case 'cavein':{const z=e.z;sfx.cavein();this.shake=Math.max(this.shake,0.9);const cx=(z.x0+z.x1)/2;for(let k=0;k<60;k++)this.dust(cx,z.y0+Math.random()*(z.y1-z.y0),1,z.x1-z.x0+1);this.debris(cx,z.y1,30,2);
        if(z.vis)for(const o of z.vis)this.root.remove(o);const r=rubbleHeap(z.x1-z.x0,1.2);r.position.set(cx,z.y0+(z.y1-z.y0)*0.2,0);this.root.add(r);break;}
      case 'shoring':{const c=this.chars.get(e.m.id);if(c)propFor(c,'mallet');break;}
      case 'shored':{const z=e.z;sfx.hammer();const c=this.chars.get(e.m.id);if(c)propFor(c,null);if(z.vis)for(const o of z.vis)this.root.remove(o);z.vis=[];
        for(let x=z.x0+0.6;x<z.x1;x+=1.3){const f=this.floorsInColumn(x).find(f=>f.y>=z.y0-0.6&&f.y<z.y1);if(!f)continue;const t=timberSet(f.y,Math.min(f.h,4.4),{front:false,fresh:true});t.position.x=x;this.root.add(t);z.vis.push(t);}
        this.dust((z.x0+z.x1)/2,z.y1-0.5,8,z.x1-z.x0);break;}
      case 'flare':{const c=this.chars.get(e.m.id);if(c)propFor(c,null);break;}
      case 'ignite':sfx.ignite();e.g.ign=0.01;break;
      case 'boom':{sfx.boom();this.shake=Math.max(this.shake,1.4);this.lf.flash(e.x,e.y,e.R*2.2,3.5,[1,0.55,0.2],1.2);
        for(let k=0;k<90;k++){const a=Math.random()*6.283,sp=2+Math.random()*7;this.fxAdd.emit({x:e.x,y:e.y,z:(Math.random()-0.5)*2,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.5+Math.random()*0.8,size:0.25+Math.random()*0.5,size1:0.05,col:[4,1.6,0.4],a:1,drag:2.2});}
        for(let k=0;k<70;k++)this.fxAlpha.emit({x:e.x+(Math.random()-0.5)*e.R,y:e.y+(Math.random()-0.5)*e.R*0.6,z:(Math.random()-0.5)*2,vx:(Math.random()-0.5)*2,vy:Math.random()*1.5,life:3+Math.random()*3,size:0.6,size1:2.4,col:[0.12,0.1,0.09],a:0.75,drag:0.8,lit:false});
        this.debris(e.x,e.y,60,6);for(const gm of this.gasMeshes[e.g?.id]||[])gm.visible=false;
        this.sim.gas.forEach((g,i)=>{if(!g.alive)for(const gm of this.gasMeshes[i])gm.visible=false;});break;}
      case 'banish':{const m=this.creatures[e.c.id];if(m){sfx.banish();m.userData.dying=1;for(let k=0;k<30;k++)this.fxAdd.emit({x:e.c.x,y:e.c.y,z:0.9,vx:(Math.random()-0.5)*3,vy:Math.random()*2,life:0.8,size:0.08,size1:0.01,col:[3,1,0.3],a:1,drag:1});}break;}
      case 'snatch':sfx.shriek();break;
      case 'assign':sfx.select();break;
      case 'release':sfx.select();break;
      case 'land':if(e.h>1.2){this.dust(e.m.x,e.m.y,3,0.5);sfx.land();}break;
    }}}
  checkTimbers(){const s=this.sim;this.timbers=this.timbers.filter(t=>{const g=s.groundY(t.x,t.y+0.5,0.6);if(g==null||Math.abs(g-t.y)>0.3){this.root.remove(t.obj);this.debris(t.x,t.y+1,6,2);return false;}return true;});}
  // ---------------- per frame ----------------
  update(dt,t,camRect){
    const s=this.sim;this.t=t;LMU.uTime.value=t;updatePropTime(t);this.ready=true;
    this.lf.update(t,dt,{skipForeman:false});
    // foreman
    const fm=s.foreman,fc=this.foreman;
    fc.root.position.x=fm.x;fc.root.position.y=fm.state==='fall'?fm.y:lerp(fc.root.position.y,fm.y,1-Math.exp(-dt*18));fc.root.position.z=0.3;
    this.face(fc,fm.state==='walk'?fm.dir*1.2:fm.dir*0.75,dt);
    if(fm.state==='walk')play(fc,'Walk_Lantern',0.2,{ts:1.32});else if(fm.state==='fall')play(fc,'Jump_Loop',0.1);else play(fc,'Idle_Lantern_Loop',0.3);
    fc.mixer.update(dt);
    if(fc.props.lamp){fc.root.updateMatrixWorld(true);const lp=fc.props.lamp;const q=new THREE.Quaternion();lp.parent.getWorldQuaternion(q);lp.quaternion.copy(q.invert());
      const wp=new THREE.Vector3();lp.getWorldPosition(wp);this.lampPos=wp;if(this.lantern){this.lantern.position.set(wp.x,wp.y+0.2,wp.z+0.25);this.lantern.intensity=9*(0.97+0.03*Math.sin(t*7));}}
    // miners
    let darkCount=0,active=0;
    for(const m of s.miners){const c=this.chars.get(m.id);if(!c)continue;
      if(c.saved){this.animSaved(c,m,dt);continue;}
      if(c.lost){this.animLost(c,m,dt);continue;}
      active++;if(m.fear>0.25)darkCount+=m.fear;
      const r=c.root;r.position.x=m.x;r.position.y=m.state==='fall'?m.y:lerp(r.position.y,m.y,1-Math.exp(-dt*20));
      if(c.emerge!=null){c.emerge+=dt;if(c.ex==null)c.ex=m.x;if(Math.abs(m.x-c.ex)>1.6)c.emerge=0.9;const k=Math.min(1,c.emerge/0.9);r.position.z=lerp(-1.7,c.lane,k*k*(3-2*k));c.u.dis.value=Math.max(0,0.9-k*1.2);if(k>=1)c.emerge=null;}
      else r.position.z=lerp(r.position.z,m.state==='block'?0.45:c.lane,1-Math.exp(-dt*3));
      c.u.fear.value=m.fear;
      let yaw=m.dir*1.15,anim='Idle_Loop',ts=1;
      switch(m.state){
        case 'walk':anim=m.speed>0?'Walk_Loop':'Idle_Loop';ts=m.speed>0?m.speed/1.12:1;break;
        case 'idle':anim=m.fear>0.35?'Crouch_Idle_Loop':'Idle_Loop';yaw=m.dir*0.7;break;
        case 'fall':anim='Jump_Loop';break;
        case 'dig':anim='Farm_Harvest';yaw=m.dir*0.5;ts=1.25;break;
        case 'block':anim='Idle_No_Loop';yaw=0;break;
        case 'shore':anim='Fixing_Kneeling';yaw=m.dir*1.2;break;
        case 'throw':anim='OverhandThrow';ts=1.2;break;}
      if(m.state==='dig')propFor(c,'pick');else if(m.state==='throw'&&!m.thrown)propFor(c,'flare');else if(m.state!=='shore')propFor(c,null);
      play(c,anim,anim==='Jump_Loop'?0.08:0.22,{ts,once:anim==='OverhandThrow'});this.face(c,yaw,dt);c.mixer.update(dt);
      // scared miners tremble: dark wisps cling to them
      if(m.fear>0.35&&Math.random()<m.fear*0.5)this.fxAlpha.emit({x:m.x+(Math.random()-0.5)*0.6,y:m.y+Math.random()*1.6,z:r.position.z+0.2,vx:(Math.random()-0.5)*0.3,vy:0.3+Math.random()*0.4,life:1.2,size:0.15,size1:0.5,col:[0,0,0.01],a:0.6*m.fear,drag:0.5});
    }
    setWhisper(Math.min(1,darkCount/2.5+(this.creatureNear||0)));
    // light visuals follow (flares fly)
    for(const l of s.lights){const o=this.lightVis.get(l.id);if(!o)continue;if(l.kind==='flare'){o.position.set(l.x,l.y-0.1,0.2);const f=s.flares.find(q=>q.light===l);if(f&&!f.rest)o.rotation.z+=dt*9;else o.rotation.z=lerp(o.rotation.z,1.35,dt*8);
        if(Math.random()<0.6)this.fxAdd.emit({x:l.x,y:l.y,z:0.25,vx:(Math.random()-0.5)*1.4,vy:Math.random()*1.8,life:0.4+Math.random()*0.4,size:0.04,size1:0.01,col:[4,1,0.4],a:1,grav:4});
        if(Math.random()<0.25)this.fxAlpha.emit({x:l.x,y:l.y+0.2,z:0.1,vx:(Math.random()-0.5)*0.2,vy:0.6,life:2.5,size:0.2,size1:0.9,col:[0.6,0.18,0.14],a:0.35,lit:true,drag:0.3});}
      else if(o.userData.torch&&Math.random()<0.12)this.fxAdd.emit({x:o.position.x+(Math.random()-0.5)*0.1,y:o.position.y+0.35,z:o.position.z,vx:(Math.random()-0.5)*0.3,vy:0.6+Math.random()*0.8,life:0.8+Math.random()*0.8,size:0.03,size1:0.005,col:[3,1.2,0.3],a:1,grav:-0.3});}
    // creatures
    this.creatureNear=0;
    s.creatures.forEach((c,i)=>{const m=this.creatures[i];const u=m.material.uniforms;u.uTime.value=t;
      if(m.userData.dying){m.userData.dying-=dt*1.3;u.uA.value=Math.max(0,m.userData.dying);u.uBurn.value=1;if(m.userData.dying<=0)m.visible=false;return;}
      if(!c.alive){m.visible=false;return;}
      m.position.x=lerp(m.position.x,c.x,1-Math.exp(-dt*10));m.position.y=lerp(m.position.y,c.y+0.1,1-Math.exp(-dt*10));if(Math.abs(c.vx)>0.05)u.uDir.value=c.vx>0?1:-1;u.uBurn.value=Math.min(1,c.burn);
      m.scale.setScalar(1+0.06*Math.sin(t*3+i));
      for(const mm of s.miners)if(mm.active&&Math.hypot(mm.x-c.x,mm.y-c.y)<5)this.creatureNear=0.5;});
    // gas
    s.gas.forEach((g,i)=>{for(const gm of this.gasMeshes[i]){gm.material.uniforms.uTime.value=t;if(g.fuse>=0)gm.material.uniforms.uIgn.value=Math.min(1,gm.material.uniforms.uIgn.value+dt*3);}});
    // cave-in zones: cracked timbers, drizzle of dust and creaks as the roof gives
    this.labels.length=0;
    for(const z of s.zones){if(!z.vis){z.vis=[];for(let x=z.x0+0.8;x<z.x1-0.2;x+=1.6){const f=this.floorsInColumn(x).find(f=>f.y>=z.y0-0.6&&f.y<z.y1);if(!f)continue;const tset=timberSet(f.y,Math.min(f.h,4.4),{front:false,cracked:true});tset.position.x=x;this.root.add(tset);z.vis.push(tset);}}
      const cx=(z.x0+z.x1)/2;
      if(!z.shored&&!z.fallen){const left=z.t-s.t;const urg=Math.max(0,1-left/25);
        if(Math.random()<dt*(1+urg*14))this.fxAlpha.emit({x:z.x0+Math.random()*(z.x1-z.x0),y:z.y1-0.2,z:(Math.random()-0.5)*2,vx:0,vy:-0.5,life:2.5,size:0.05+urg*0.15,size1:0.3+urg*0.4,col:[0.7,0.65,0.58],a:0.5,lit:true,grav:0.6});
        if(urg>0.5&&Math.random()<dt*urg*1.2)sfx.creak(0.1+urg*0.12);if(left<5&&Math.random()<dt*0.8)sfx.rumble(0.25);
        for(const o of z.vis){o.rotation.z=urg>0.6?Math.sin(t*30+o.position.x)*0.01*urg:0;}
        this.labels.push({x:cx,y:z.y1+0.3,text:Math.max(0,Math.ceil(left))+'s',cls:'warn'+(left<10?' urgent':''),icon:'roof',prog:z.shoring});}
      else if(z.shored&&!z.fallen&&(z.labelT=(z.labelT||0)+dt)<2.5)this.labels.push({x:cx,y:z.y1+0.3,text:'Shored',cls:'ok'});}
    for(const g of s.gas)if(g.alive)this.labels.push({x:(g.x0+g.x1)/2,y:g.y1+0.25,text:'Firedamp',cls:'gas'});
    // ambient dust motes drifting through the light
    if(camRect){for(let k=0;k<3;k++){const x=camRect[0]+Math.random()*(camRect[2]-camRect[0]),y=camRect[1]+Math.random()*(camRect[3]-camRect[1]);if(!s.solidAt(x,y)&&s.lumAt(x,y)>0.05)this.fxDust.emit({x,y,z:(Math.random()-0.5)*2.4,vx:(Math.random()-0.5)*0.12,vy:(Math.random()-0.5)*0.08,life:5+Math.random()*4,size:0.018+Math.random()*0.02,col:[0.9,0.8,0.65],a:0.9,a1:0,lit:true,fadeIn:1.5});}}
    // lift
    if(this.lift){const g=this.lift.userData.gate;g.position.x=lerp(g.position.x,s.over?0:-1.3,dt*2);
      if(s.over&&s.result&&s.result.win){this.liftUp=(this.liftUp||0)+dt;if(this.liftUp>1.2)this.lift.userData.cage.position.y+=dt*Math.min(2.5,(this.liftUp-1.2)*1.5);}}
    this.fxAdd.update(dt);this.fxAlpha.update(dt);this.fxDust.update(dt);
    this.shake=Math.max(0,this.shake-dt*1.6);
  }
  face(c,yaw,dt){c.yaw=lerp(c.yaw,yaw,1-Math.exp(-dt*9));c.root.rotation.y=c.yaw;}
  animSaved(c,m,dt){const ex=this.sim.exit;const k=c.savedIdx;const slot=k<8?{x:ex.x+0.3-0.55+(k%4)*0.37,z:-0.3-0.55*Math.floor(k/4)+0.1}:null;
    if(!slot){c.root.visible=false;return;}
    const r=c.root;const dx=slot.x-r.position.x;if(Math.abs(dx)>0.05){r.position.x+=Math.sign(dx)*Math.min(Math.abs(dx),dt*1.1);play(c,'Walk_Loop',0.2);this.face(c,Math.sign(dx)*1.2,dt);}
    else{play(c,'Idle_Loop',0.4);this.face(c,0.25,dt);}r.position.z=lerp(r.position.z,slot.z,dt*3);
    r.position.y=ex.y+0.09+(this.lift?this.lift.userData.cage.position.y:0);c.u.fear.value=0;c.mixer.update(dt);}
  animLost(c,m,dt){c.lostT+=dt;const r=c.root;
    if(c.lost==='taken'){play(c,'Hit_Knockback',0.1,{once:true});r.position.y+=dt*0.35*Math.min(1,c.lostT);c.u.dis.value=Math.min(1.1,c.lostT*0.7);if(c.lostT>1.8)r.visible=false;c.mixer.update(dt*0.6);}
    else if(c.lost==='fell'){if(m.y>-2)r.position.y=m.y;play(c,m.y>-0.5?'Death01':'Jump_Loop',0.1,{once:m.y>-0.5});c.mixer.update(dt);c.u.dis.value=Math.min(1.1,c.lostT*0.5);if(c.lostT>2.2)r.visible=false;}
    else if(c.lost==='left'){r.visible=false;}
  }
}
