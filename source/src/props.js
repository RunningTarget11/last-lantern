// Procedural props (timber, iron, brass) built from CC0 Poly Haven textures. All materials take the light field.
import * as THREE from 'three';
import {patchLM} from './lm.js';
export const MAT={};
export function initMaterials(T){
  const wood=(c,r=0.85)=>patchLM(new THREE.MeshStandardMaterial({map:T.woodD,normalMap:T.woodN,color:c,roughness:r,metalness:0}));
  MAT.timber=wood(0x8a7a66);MAT.timberDark=wood(0x4a3c30);MAT.timberNew=wood(0xc4a47c,0.75);
  MAT.iron=patchLM(new THREE.MeshStandardMaterial({map:T.rustD,normalMap:T.rustN,color:0x6a6058,roughness:0.62,metalness:0.75}));
  MAT.ironDark=patchLM(new THREE.MeshStandardMaterial({map:T.rustD,normalMap:T.rustN,color:0x2a2622,roughness:0.55,metalness:0.8}));
  MAT.brass=patchLM(new THREE.MeshStandardMaterial({color:0xc89a52,roughness:0.32,metalness:1}));
  MAT.glass=new THREE.MeshStandardMaterial({color:0xffd9a0,roughness:0.1,metalness:0,transparent:true,opacity:0.28,emissive:0xff9a40,emissiveIntensity:0.5,depthWrite:false});
  MAT.gauze=patchLM(new THREE.MeshStandardMaterial({color:0x9a9a92,roughness:0.5,metalness:0.9,transparent:true,opacity:0.7,alphaTest:0.05}));
  MAT.cloth=patchLM(new THREE.MeshStandardMaterial({color:0x2a2018,roughness:0.95}));
  MAT.leather=patchLM(new THREE.MeshStandardMaterial({color:0x2b2119,roughness:0.7,metalness:0}));
  MAT.flareStick=patchLM(new THREE.MeshStandardMaterial({color:0x6a1410,roughness:0.6}));
  MAT.cable=patchLM(new THREE.MeshStandardMaterial({color:0x2a2724,roughness:0.5,metalness:0.8}));
  MAT.rubble=patchLM(new THREE.MeshStandardMaterial({map:T.rockD,normalMap:T.rockN,color:0x6a625a,roughness:0.95}));
}
// ---------- flame billboard (procedural, HDR for bloom) ----------
const flameMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor,
  uniforms:{uTime:{value:0},uSeed:{value:0},uCol:{value:new THREE.Color(1,0.5,0.15)},uI:{value:1}},
  vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);vec2 s=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));mv.xy+=(position.xy)*s;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec2 vUv;uniform float uTime,uSeed,uI;uniform vec3 uCol;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  void main(){vec2 p=vUv-vec2(.5,.18);float t=uTime*2.6+uSeed*7.;
   float w=n(vec2(p.x*5.,p.y*4.-t*1.7))*0.6+n(vec2(p.x*11.,p.y*9.-t*3.1))*0.4;
   float sh=(0.26-abs(p.x+(w-0.5)*0.22*p.y*3.)*(1.4+p.y*2.2))-max(p.y,0.)*0.32+(w-0.5)*0.1;
   float core=smoothstep(0.0,0.16,sh);float body=smoothstep(-0.04,0.09,sh);
   if(p.y<0.)body*=smoothstep(-0.14,0.,p.y);
   vec3 c=mix(uCol*1.6,vec3(1.,0.85,0.55)*3.2,core)+vec3(0.15,0.25,1.)*0.6*smoothstep(-0.05,0.02,-p.y)*body*0.5;
   float a=body*(0.65+0.35*w);gl_FragColor=vec4(c*a*uI,clamp(a,0.,1.));}`});
export function makeFlame(size=0.45,col=[1,0.5,0.15],intensity=1){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1.6),flameMat);m.scale.set(size,size,1);m.renderOrder=5;const seed=Math.random()*10;
  m.onBeforeRender=()=>{flameMat.uniforms.uSeed.value=seed;flameMat.uniforms.uCol.value.setRGB(...col);flameMat.uniforms.uI.value=m.userData.i??intensity;flameMat.uniformsNeedUpdate=true;};m.frustumCulled=false;return m;}
// soft glow halo (volumetric-feeling bloom around light sources)
const haloTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.12,'rgba(255,255,255,0.55)');gr.addColorStop(0.4,'rgba(255,255,255,0.12)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);return t;})();
export function makeHalo(size,col,op=0.5){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,color:new THREE.Color(...col),transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));m.scale.set(size,size,1);m.renderOrder=4;return m;}
export function updatePropTime(t){flameMat.uniforms.uTime.value=t;}

// ---------- Blender-built props (ll_props.glb: modelled + AO-baked in Blender, see /source/blender) ----------
export const BP={};
const TINT={LL_Iron:[0.9,0.85,0.8],LL_Wood:[0.62,0.58,0.54],LL_Brass:[1,1,1],LL_Tar:[1,1,1],LL_Rock:[0.55,0.53,0.5]};
export function setBlenderProps(root){const mats=new Map();
  const fix=m=>{if(mats.has(m))return mats.get(m);const n=m.clone();n.envMapIntensity=0.3;const t=TINT[m.name];if(t)n.color.multiply(new THREE.Color(...t));
    if(m.name==='LL_Glass'){n.transparent=true;n.opacity=0.22;n.depthWrite=false;n.roughness=0.05;}
    if(m.name==='LL_Gauze'){n.alphaTest=0.5;n.transparent=false;n.side=THREE.DoubleSide;}
    patchLM(n);mats.set(m,n);return n;};
  root.updateMatrixWorld(true);
  for(const o of [...root.children]){if(!/^LL_/.test(o.name))continue;
    o.traverse(c=>{if(c.isMesh){c.material=Array.isArray(c.material)?c.material.map(fix):fix(c.material);c.castShadow=true;c.receiveShadow=true;if(c.geometry.attributes.color){(Array.isArray(c.material)?c.material:[c.material]).forEach(m=>m.vertexColors=true);}}});
    o.position.set(0,0,0);o.updateMatrixWorld(true);BP[o.name]=o;}}
const bp=(name)=>BP[name]?BP[name].clone():null;
// InstancedMesh per primitive of a (possibly multi-material) Blender prop
export function bpInstanced(name,mats4){const src=BP[name];if(!src)return null;const g=new THREE.Group();const parts=[];src.traverse(c=>{if(c.isMesh)parts.push(c);});
  for(const c of parts){const im=new THREE.InstancedMesh(c.geometry,c.material,mats4.length);mats4.forEach((m,i)=>im.setMatrixAt(i,m));im.castShadow=true;im.receiveShadow=true;g.add(im);}return g;}
// ---------- geometry helpers ----------
const log=(r,h)=>{const g=new THREE.CylinderGeometry(r*0.92,r,h,9,1);const p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setX(i,p.getX(i)*(1+0.06*Math.sin(y*7+i)));}g.computeVertexNormals();return g;};
const G={post:log(0.11,1),cap:log(0.12,1),box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(0.5,0.5,1,10)};
export function timberSet(floorY,h,{front=false,cracked=false,fresh=false}={}){
  const g=new THREE.Group();const m=fresh?MAT.timberNew:cracked?MAT.timberDark:MAT.timber;const capY=h-0.12;
  const zs=front?[-1.45,1.25]:[-1.45];
  const B=BP.LL_TimberPost&&!fresh;
  for(const z of zs){const p=B?bp('LL_TimberPost'):new THREE.Mesh(G.post,m);p.scale.set(1,B?capY/2.5:capY,1);if(B)p.rotation.y=Math.random()*6.28;p.position.set((Math.random()-0.5)*0.06,capY/2,z);p.rotation.z=(Math.random()-0.5)*0.05+(cracked?0.12:0);p.castShadow=true;g.add(p);}
  const c=B?bp('LL_TimberCap'):new THREE.Mesh(G.cap,m);if(B){c.scale.set(1,1,(front?3.0:1.6)/2.0);}else{c.rotation.x=Math.PI/2;c.scale.set(1,front?3.0:1.6,1);}c.position.set(0,capY,front?-0.1:-0.85);c.rotation.y=cracked?0.18:0;if(cracked){c.rotation.z=0.1;c.position.y-=0.12;}c.castShadow=true;g.add(c);
  if(!front){// lagging planks against the back
    for(let k=0;k<3;k++){const b=B?bp('LL_Plank'):new THREE.Mesh(G.box,m);if(!B)b.scale.set(0.9,0.06,0.25);b.position.set(0,capY+0.12,-1.6+k*0.3);g.add(b);}}
  g.position.y=floorY;return g;}
export function makePickaxe(){if(BP.LL_Pickaxe)return bp('LL_Pickaxe');const g=new THREE.Group();const h=new THREE.Mesh(G.cyl,MAT.timber);h.scale.set(0.035,0.8,0.035);h.position.y=0.4;g.add(h);
  for(const s of [-1,1]){const c=new THREE.Mesh(new THREE.ConeGeometry(0.035,0.34,7),MAT.iron);c.rotation.z=-s*(Math.PI/2+0.25);c.position.set(s*0.17,0.79-0.03,0);g.add(c);}
  const eye=new THREE.Mesh(G.box,MAT.iron);eye.scale.set(0.08,0.09,0.07);eye.position.y=0.8;g.add(eye);return g;}
export function makeMallet(){if(BP.LL_Mallet)return bp('LL_Mallet');const g=new THREE.Group();const h=new THREE.Mesh(G.cyl,MAT.timber);h.scale.set(0.03,0.5,0.03);h.position.y=0.25;g.add(h);const hd=new THREE.Mesh(G.cyl,MAT.timberDark);hd.scale.set(0.09,0.22,0.09);hd.rotation.z=Math.PI/2;hd.position.y=0.5;g.add(hd);return g;}
export function makeTorchProp(){const g=new THREE.Group();if(BP.LL_Torch)g.add(bp('LL_Torch'));else{const s=new THREE.Mesh(G.cyl,MAT.timberDark);s.scale.set(0.035,0.55,0.035);s.position.y=-0.22;g.add(s);
  const w=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.045,0.16,8),MAT.cloth);w.position.y=0.06;g.add(w);
  const b=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.04,8),MAT.iron);b.position.y=-0.04;g.add(b);}
  const f=makeFlame(0.42,[1,0.48,0.14]);f.position.y=0.3;g.add(f);g.userData.flame=f;const h=makeHalo(2.2,[1,0.5,0.2],0.35);h.position.y=0.25;g.add(h);g.userData.halo=h;return g;}
export function torchBracket(){const g=new THREE.Group();const a=new THREE.Mesh(G.box,MAT.ironDark);a.scale.set(0.05,0.05,0.4);a.position.set(0,-0.12,-0.2);g.add(a);const r=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.012,5,10),MAT.ironDark);r.rotation.x=Math.PI/2;r.position.y=-0.04;g.add(r);return g;}
export function torchStand(h){const g=new THREE.Group();for(let k=0;k<3;k++){const l=new THREE.Mesh(G.cyl,MAT.ironDark);l.scale.set(0.018,h,0.018);const a=k/3*Math.PI*2;l.position.set(Math.cos(a)*0.12,h/2,Math.sin(a)*0.12);l.rotation.set(Math.sin(a)*0.15,0,-Math.cos(a)*0.15);g.add(l);}return g;}
export function makeDavyLamp(scale=1,withLight=true){
  const g=new THREE.Group();
  if(BP.LL_DavyLamp){g.add(bp('LL_DavyLamp'));}else{
  const prof=(pts)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),16);
  const base=new THREE.Mesh(prof([[0,0],[0.07,0],[0.075,0.012],[0.072,0.06],[0.06,0.07],[0.05,0.075]]),MAT.brass);g.add(base);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.09,14,1,true),MAT.glass);glass.position.y=0.12;g.add(glass);
  const gz=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,0.13,12,1,true),MAT.gauze);gz.position.y=0.23;g.add(gz);
  for(let k=0;k<3;k++){const p=new THREE.Mesh(G.cyl,MAT.brass);p.scale.set(0.006,0.2,0.006);const a=k/3*Math.PI*2+0.5;p.position.set(Math.cos(a)*0.058,0.175,Math.sin(a)*0.058);g.add(p);}
  const top=new THREE.Mesh(prof([[0.05,0],[0.055,0.01],[0.04,0.03],[0.012,0.05],[0,0.055]]),MAT.brass);top.position.y=0.29;g.add(top);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.035,0.005,5,14),MAT.brass);ring.position.y=0.375;g.add(ring);}
  if(withLight){const f=makeFlame(0.07,[1,0.6,0.25],1.3);f.position.y=0.1;g.add(f);g.userData.flame=f;const h=makeHalo(1.0,[1,0.65,0.3],0.22);h.position.y=0.14;g.add(h);g.userData.halo=h;}
  g.scale.setScalar(scale);return g;}
export function makeFlareProp(){const g=new THREE.Group();const s=new THREE.Mesh(G.cyl,MAT.flareStick);s.scale.set(0.022,0.22,0.022);g.add(s);const f=makeFlame(0.28,[1,0.12,0.05],1.6);f.position.y=0.16;g.add(f);g.userData.flame=f;const h=makeHalo(2.6,[1,0.15,0.08],0.55);h.position.y=0.12;g.add(h);g.userData.halo=h;return g;}
export function makeLift(){// rusted cage lift with cables and a hanging lamp
  const g=new THREE.Group();const cage=new THREE.Group();g.add(cage);const W=1.7,H=2.5,D=1.7;
  if(BP.LL_LiftCage){cage.add(bp('LL_LiftCage'));const gate=bp('LL_LiftGate');cage.add(gate);g.userData.gate=gate;g.userData.cage=cage;
    for(const x of [-W/2-0.12,W/2+0.12]){const r=new THREE.Mesh(G.box,MAT.timberDark);r.scale.set(0.14,14,0.2);r.position.set(x,7,-D/2+0.1);g.add(r);}return g;}
  const bar=(x,y,z,sx,sy,sz,m=MAT.iron)=>{const b=new THREE.Mesh(G.box,m);b.scale.set(sx,sy,sz);b.position.set(x,y,z);b.castShadow=true;cage.add(b);return b;};
  for(const x of [-W/2,W/2])for(const z of [-D/2,D/2])bar(x,H/2,z,0.07,H,0.07);
  for(const y of [0.04,H])for(const z of [-D/2,D/2])bar(0,y,z,W,0.07,0.07);
  for(const y of [0.04,H])for(const x of [-W/2,W/2])bar(x,y,0,0.07,0.07,D);
  for(let k=1;k<6;k++){bar(-W/2+k*W/6,H/2,-D/2,0.025,H,0.025,MAT.ironDark);}
  for(let k=1;k<4;k++){bar(W/2,H/2,-D/2+k*D/4,0.025,H,0.025,MAT.ironDark);}
  const floor=bar(0,0.06,0,W,0.05,D,MAT.timberDark);
  for(const x of [-0.5,0.5]){const c=new THREE.Mesh(G.cyl,MAT.cable);c.scale.set(0.015,20,0.015);c.position.set(x,H+10,0);cage.add(c);}
  const gate=new THREE.Group();for(let k=0;k<5;k++){const b=new THREE.Mesh(G.box,MAT.ironDark);b.scale.set(0.02,H*0.9,0.02);b.position.set(-W/2+0.15+k*0.34,H*0.47,D/2);gate.add(b);}cage.add(gate);g.userData.gate=gate;g.userData.cage=cage;
  // rail guides
  for(const x of [-W/2-0.12,W/2+0.12]){const r=new THREE.Mesh(G.box,MAT.timberDark);r.scale.set(0.14,14,0.2);r.position.set(x,7,-D/2+0.1);g.add(r);}
  return g;}
export function makeRailRun(x0,x1,y){const g=new THREE.Group();const L=x1-x0;
  if(BP.LL_Rail2m){const n=Math.max(1,Math.round(L/2));const sx=L/(n*2);const ms=[];
    for(const z of [-0.62,0.38])for(let k=0;k<n;k++)ms.push(new THREE.Matrix4().compose(new THREE.Vector3(x0+k*2*sx,y+0.068,z),new THREE.Quaternion(),new THREE.Vector3(sx,1,1)));
    g.add(bpInstanced('LL_Rail2m',ms));const ns=Math.floor(L/0.7);const ss=[];
    for(let k=0;k<ns;k++)ss.push(new THREE.Matrix4().compose(new THREE.Vector3(x0+0.35+k*0.7,y+0.035,-0.12),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(Math.random()-0.5)*0.08),new THREE.Vector3(1,1,1)));
    g.add(bpInstanced('LL_Sleeper',ss));return g;}
  for(const z of [-0.62,0.38]){const r=new THREE.Mesh(G.box,MAT.iron);r.scale.set(L,0.05,0.045);r.position.set((x0+x1)/2,y+0.09,z);g.add(r);}
  const n=Math.floor(L/0.7);const sl=new THREE.InstancedMesh(G.box,MAT.timberDark,n);const m=new THREE.Matrix4();
  for(let k=0;k<n;k++){m.compose(new THREE.Vector3(x0+0.35+k*0.7,y+0.035,-0.12),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(Math.random()-0.5)*0.12),new THREE.Vector3(0.16,0.07,1.45));sl.setMatrixAt(k,m);}
  g.add(sl);return g;}
export function makeCart(){if(BP.LL_Cart){const g=new THREE.Group();g.add(bp('LL_Cart'));return g;}const g=new THREE.Group();const b=(x,y,z,sx,sy,sz,m)=>{const o=new THREE.Mesh(G.box,m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  b(0,0.5,0,1.3,0.06,0.95,MAT.iron);for(const s of [-1,1]){b(s*0.62,0.78,0,0.06,0.55,0.95,MAT.iron);b(0,0.78,s*0.46,1.3,0.55,0.05,MAT.iron);}
  for(const x of [-0.4,0.4])for(const z of [-0.5,0.5]){const w=new THREE.Mesh(G.cyl,MAT.ironDark);w.scale.set(0.34,0.06,0.34);w.rotation.x=Math.PI/2;w.position.set(x,0.22,z);g.add(w);}
  // ore heap
  const ore=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5,1),MAT.rubble);ore.scale.set(1.15,0.45,0.8);ore.position.y=1.02;g.add(ore);return g;}
export function rubbleHeap(w,h){const g=new THREE.Group();for(let k=0;k<Math.ceil(w*5);k++){const rk=BP.LL_RockA?bp('LL_Rock'+'ABC'[k%3]):null;if(rk)rk.scale.setScalar(0.12+Math.random()*0.22);const r=rk||new THREE.Mesh(new THREE.DodecahedronGeometry(0.12+Math.random()*0.22,0),MAT.rubble);r.position.set((Math.random()-0.5)*w,Math.random()*h*0.6,(Math.random()-0.5)*2.8);r.rotation.set(Math.random()*3,Math.random()*3,0);g.add(r);}return g;}
