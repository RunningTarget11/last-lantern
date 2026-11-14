// Quaternius CC0 characters on the UAL skeleton, driven by UAL CC0 clips; light-field shaded; dark dissolve.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {patchLM} from './lm.js';
import {MAT,makeDavyLamp,makePickaxe,makeMallet,makeFlareProp,setBlenderProps} from './props.js';
export const MODELS={},CLIPS={};
function b64(s){const bin=atob(s);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;}
export async function loadModels(A){const L=new GLTFLoader();const parse=k=>new Promise((res,rej)=>L.parse(b64(A.glb[k]),'',res,rej));
  for(const k of ['ch_peasant_lo','ch_head_lo','ch_ranger_lo']){MODELS[k]=await parse(k);const b=new THREE.Box3().setFromObject(MODELS[k].scene);MODELS[k].h=b.max.y-b.min.y;}
  if(A.glb.ll_props){const g=await parse('ll_props');setBlenderProps(g.scene);}
  for(const k of ['wine_barrel_01','wooden_crate_01']){MODELS[k]=await parse(k);MODELS[k].scene.traverse(o=>{if(o.isMesh){o.material=patchLM(o.material.clone());o.material.envMapIntensity=0.3;o.castShadow=true;}});const b=new THREE.Box3().setFromObject(MODELS[k].scene);MODELS[k].size=b.getSize(new THREE.Vector3());MODELS[k].min=b.min.clone();}
  const an=await parse('ll_anims');for(const c of an.animations)CLIPS[c.name]=c;
  // foreman walk: legs/torso from Walk_Loop, lantern arm held from Idle_Lantern_Loop
  const ARM=/(clavicle_l|upperarm_l|lowerarm_l|hand_l)\./;const w=CLIPS.Walk_Loop.clone();const lan=CLIPS.Idle_Lantern_Loop;
  w.tracks=w.tracks.filter(t=>!ARM.test(t.name)).concat(lan.tracks.filter(t=>ARM.test(t.name)).map(t=>{const c=t.clone();return c;}));w.name='Walk_Lantern';
  w.tracks.forEach(t=>{if(ARM.test(t.name)){t.times=t.times.map(x=>x*(CLIPS.Walk_Loop.duration/lan.duration));}});CLIPS.Walk_Lantern=w;}
const dissolveChunk=(u)=>{const fn=(sh)=>{sh.uniforms.uDis=u.dis;sh.uniforms.uFear=u.fear;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vDisP;').replace('#include <project_vertex>','#include <project_vertex>\nvDisP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uDis,uFear;varying vec3 vDisP;\nfloat dh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nfloat dn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}')
   .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfloat dN=dn(vDisP*9.)*0.6+dn(vDisP*23.)*0.4;if(uDis>0.&&dN<uDis)discard;float dE=uDis>0.?smoothstep(uDis+0.09,uDis,dN):0.;')
   .replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.0),dE*0.95);gl_FragColor.rgb+=vec3(0.06,0.03,0.12)*dE;gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*vec3(0.55,0.6,0.8),uFear*0.6);');};fn.key='dis';return fn;};
function rebind(mesh,byName){const old=mesh.skeleton;mesh.bind(new THREE.Skeleton(old.bones.map(b=>byName[b.name]||b),old.boneInverses.map(m=>m.clone())),mesh.bindMatrix.clone());}
const TINTS=[[0.62,0.5,0.4],[0.42,0.44,0.48],[0.55,0.46,0.34],[0.36,0.36,0.38],[0.5,0.38,0.3],[0.3,0.33,0.4]];
export function makeChar(kind,id=0){
  const body=kind==='foreman'?'ch_ranger_lo':'ch_peasant_lo';
  const model=SkeletonUtils.clone(MODELS[body].scene);const head=SkeletonUtils.clone(MODELS.ch_head_lo.scene);
  const byName={};model.traverse(o=>{if(o.isBone)byName[o.name]=o;});const hm=[];head.traverse(o=>{if(o.isSkinnedMesh)hm.push(o);});for(const m of hm){rebind(m,byName);model.add(m);}
  const u={dis:{value:0},fear:{value:0}};const tint=kind==='foreman'?[0.72,0.58,0.44]:TINTS[id%TINTS.length];
  model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;const m=o.material.clone();const n=m.name||'';
    if(/Eye/.test(n)){m.color.setRGB(0.25,0.22,0.2);}
    else if(/Superhero|Regular/.test(n)){m.color.multiply(new THREE.Color(0.62,0.52,0.46));m.roughness=0.75;}// soot-dark skin
    else if(/Hair/.test(n)){m.color.multiplyScalar(0.35);}
    else{m.color.multiply(new THREE.Color(...tint));m.roughness=Math.max(m.roughness,0.8);}
    m.envMapIntensity=0.3;patchLM(m,dissolveChunk(u));o.material=m;});
  const s=(kind==='foreman'?1.8:1.62+((id*0.618)%1)*0.14)/MODELS[body].h;model.scale.setScalar(s);
  const root=new THREE.Group();root.add(model);
  const bones={head:byName.Head,handR:byName.hand_r,handL:byName.hand_l,spine:byName.spine_03};
  // miner's helmet: leather cap with a brass lamp bracket
  const hat=new THREE.Group();const dome=new THREE.Mesh(new THREE.SphereGeometry(0.125,14,8,0,Math.PI*2,0,Math.PI*0.52),kind==='foreman'?MAT.leather:MAT.leather);dome.scale.set(1,0.85,1.12);hat.add(dome);
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.135,0.14,0.014,16,1,false,-1.2,2.4),MAT.leather);brim.scale.set(1,1,1.25);brim.position.set(0,0.004,0.02);hat.add(brim);const band=new THREE.Mesh(new THREE.TorusGeometry(0.122,0.01,5,20),MAT.leather);band.rotation.x=Math.PI/2;band.scale.set(1,1.12,1);band.position.y=0.01;hat.add(band);
  const br=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.05,0.02),MAT.brass);br.position.set(0,0.05,0.135);hat.add(br);
  attach(bones.head,hat,[0,0.13,0.015],[0,0,0],1.0);
  const mixer=new THREE.AnimationMixer(model);
  const c={kind,id,root,model,mixer,bones,u,acts:{},cur:null,curName:'',yaw:0,lane:kind==='foreman'?0.3:((id*0.37)%1)*1.1-0.6,ph:(id*0.618)%1,tsk:0.9+((id*0.43)%1)*0.2,props:{}};
  if(kind==='foreman'){const lamp=makeDavyLamp(1.25,true);attach(bones.handL,lamp,[0,-0.4,0],[0,0,0],1);// hangs from the hand; kept upright each frame
    c.props.lamp=lamp;}
  play(c,kind==='foreman'?'Idle_Lantern_Loop':'Idle_Loop',0);
  return c;}
const _ws=new THREE.Vector3();
export function attach(bone,obj,pos,rot,worldScale){bone.updateWorldMatrix(true,false);bone.getWorldScale(_ws);const k=1/_ws.x;obj.position.set(pos[0]*k,pos[1]*k,pos[2]*k);obj.rotation.set(...rot);obj.scale.multiplyScalar(worldScale*k);bone.add(obj);return obj;}
export function play(c,name,fade=0.2,{ts=1,once=false}={}){if(c.curName===name){if(c.cur)c.cur.timeScale=ts*(c.tsk||1);return c.cur;}
  let a=c.acts[name];if(!a){a=c.mixer.clipAction(CLIPS[name]);c.acts[name]=a;}
  a.reset();a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);a.clampWhenFinished=once;if(!once)a.time=(c.ph||0)*a.getClip().duration;ts*=once?1:(c.tsk||1);a.timeScale=ts;a.enabled=true;a.setEffectiveWeight(1);a.play();
  if(c.cur&&fade>0)c.cur.crossFadeTo(a,fade,false);else if(c.cur)c.cur.stop();c.cur=a;c.curName=name;return a;}
export function propFor(c,kind){// tool in the right hand during an action
  for(const k of ['pick','mallet','flare'])if(c.props[k]&&k!==kind){c.props[k].visible=false;}
  if(!kind)return;if(!c.props[kind]){const o=kind==='pick'?makePickaxe():kind==='mallet'?makeMallet():makeFlareProp();
    attach(c.bones.handR,o,[0,0.02,0.02],kind==='flare'?[0,0,0]:[Math.PI/2,0,0],kind==='pick'?0.95:1);if(kind!=='flare')o.position.multiplyScalar(1);c.props[kind]=o;}
  c.props[kind].visible=true;}
