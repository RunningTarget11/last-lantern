// Pre-renders the Quaternius CC0 miner (UAL CC0 clips) into a side-view sprite atlas.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
const FW=96,FH=96;            // frame size (px)
const PPM=34;                 // px per metre
const L=new GLTFLoader();const load=u=>new Promise((r,j)=>L.load(u,r,undefined,j));
window.bake=async function(){
  const base='/';
  const [peasant,head,u1,u2,props]=await Promise.all([load(base+'ll-src/glb/ch_peasant_lo.glb'),load(base+'ll-src/glb/ch_head_lo.glb'),
    load(base+'anim/ual1/Universal%20Animation%20Library%5BStandard%5D/Unreal-Godot/UAL1_Standard.glb'),
    load(base+'anim/ual2/Universal%20Animation%20Library%202%5BStandard%5D/Unreal-Godot/UAL2_Standard.glb'),
    load(base+'ll-blender/out/ll_props.glb')]);
  const CL={};for(const a of [...u1.animations,...u2.animations])CL[a.name]=a;
  // strip root motion / translation except pelvis height
  for(const k in CL){const c=CL[k].clone();c.tracks=c.tracks.filter(t=>!/\.position$/.test(t.name)||/pelvis/.test(t.name));
    for(const t of c.tracks)if(/pelvis\.position/.test(t.name)){for(let i=0;i<t.values.length;i+=3){t.values[i]=0;t.values[i+2]=0;}}CL[k]=c;}
  {const ARM=/(clavicle_l|upperarm_l|lowerarm_l|hand_l)\./;const w=CL.Walk_Loop.clone();const lan=CL.Idle_Lantern_Loop;
   w.tracks=w.tracks.filter(t=>!ARM.test(t.name)).concat(lan.tracks.filter(t=>ARM.test(t.name)).map(t=>{const c=t.clone();c.times=c.times.map(x=>x*(CL.Walk_Loop.duration/lan.duration));return c;}));CL.Walk_Lantern=w;}
  const P={};props.scene.traverse(o=>{if(/^LL_/.test(o.name)&&o.parent===props.scene)P[o.name]=o;});
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(FW*2,FH*2);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;renderer.setClearColor(0,0);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0x8090a8,0x2a1f16,0.9));
  const key=new THREE.DirectionalLight(0xffc890,3.2);key.position.set(1.5,2.2,3);scene.add(key);
  const rim=new THREE.DirectionalLight(0x9fb6ff,2.0);rim.position.set(-2,1.5,-2.5);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffa060,0.8);fill.position.set(-1,0.5,2);scene.add(fill);
  const cam=new THREE.OrthographicCamera(-FW/2/PPM,FW/2/PPM,FH/PPM*0.84,-FH/PPM*0.16,0.1,20);cam.position.set(0,0,8);cam.lookAt(0,0,0);
  // character
  const model=SkeletonUtils.clone(peasant.scene);const hd=SkeletonUtils.clone(head.scene);const byName={};model.traverse(o=>{if(o.isBone)byName[o.name]=o;});
  const hm=[];hd.traverse(o=>{if(o.isSkinnedMesh)hm.push(o);});for(const m of hm){const old=m.skeleton;m.bind(new THREE.Skeleton(old.bones.map(b=>byName[b.name]||b),old.boneInverses.map(x=>x.clone())),m.bindMatrix.clone());model.add(m);}
  model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;const m=o.material.clone();const n=m.name||'';
    if(/Eye/.test(n))m.color.setRGB(0.2,0.18,0.16);else if(/Superhero|Regular/.test(n)){m.color.multiply(new THREE.Color(0.66,0.53,0.45));m.roughness=0.7;}
    else if(/Hair/.test(n))m.color.multiplyScalar(0.3);else{m.color.multiply(new THREE.Color(0.5,0.44,0.38));m.roughness=0.85;}o.material=m;});
  const box=new THREE.Box3().setFromObject(model);const s=1.68/(box.max.y-box.min.y);model.scale.setScalar(s);
  const root=new THREE.Group();root.add(model);scene.add(root);
  const leather=new THREE.MeshStandardMaterial({color:0x3a2a1c,roughness:0.6,metalness:0.1}),brass=new THREE.MeshStandardMaterial({color:0xb08040,roughness:0.35,metalness:1});
  const hat=new THREE.Group();const dome=new THREE.Mesh(new THREE.SphereGeometry(0.13,18,10,0,Math.PI*2,0,Math.PI*0.52),leather);dome.scale.set(1,0.85,1.12);hat.add(dome);
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.145,0.016,18),leather);brim.scale.set(1,1,1.2);hat.add(brim);
  const lampB=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.035,0.05,10),brass);lampB.rotation.x=Math.PI/2;lampB.position.set(0,0.06,0.15);hat.add(lampB);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(0.026,12),new THREE.MeshBasicMaterial({color:0xffe0a0}));lens.position.set(0,0.06,0.176);hat.add(lens);
  const attach=(bone,obj,pos,rot,sc=1)=>{bone.updateWorldMatrix(true,false);const ws=new THREE.Vector3();bone.getWorldScale(ws);const k=1/ws.x;obj.position.set(pos[0]*k,pos[1]*k,pos[2]*k);obj.rotation.set(...rot);obj.scale.multiplyScalar(sc*k);bone.add(obj);return obj;};
  attach(byName.Head,hat,[0,0.135,0.015],[0,0,0]);
  const pick=P.LL_Pickaxe.clone();attach(byName.hand_r,pick,[0,0.02,0.03],[Math.PI/2,0,0],1);
  const mallet=P.LL_Mallet.clone();attach(byName.hand_r,mallet,[0,0.02,0.02],[Math.PI/2,0,0],1);
  const lamp=P.LL_DavyLamp.clone();const lampG=new THREE.Group();lampG.add(lamp);lamp.position.y=-0.36;lamp.scale.setScalar(1.15);attach(byName.hand_l,lampG,[0,0,0],[0,0,0],1);
  const lampGlow=new THREE.Mesh(new THREE.SphereGeometry(0.035,10,8),new THREE.MeshBasicMaterial({color:0xffd080}));lampGlow.position.y=-0.24;lampG.add(lampGlow);
  const mixer=new THREE.AnimationMixer(model);
  // floater's canvas sack canopy with ropes
  const canopy=new THREE.Group();const clothM=new THREE.MeshStandardMaterial({color:0x8c7a58,roughness:0.95,side:THREE.DoubleSide});
  const cg=new THREE.SphereGeometry(0.62,24,10,0,Math.PI*2,0,Math.PI*0.42);const cp=cg.attributes.position;for(let i=0;i<cp.count;i++){const x=cp.getX(i),z=cp.getZ(i),a=Math.atan2(z,x);const r=1+0.06*Math.sin(a*8);cp.setX(i,x*r);cp.setZ(i,z*r);cp.setY(i,cp.getY(i)*0.8);}cg.computeVertexNormals();
  const cm=new THREE.Mesh(cg,clothM);canopy.add(cm);canopy.position.set(0,1.8,0);canopy.scale.setScalar(0.85);scene.add(canopy);
  const ropeM=new THREE.LineBasicMaterial({color:0x2a2018});const ropeG=new THREE.BufferGeometry();ropeG.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(8*3),3));const ropes=new THREE.LineSegments(ropeG,ropeM);scene.add(ropes);
  // animation table: name, clip, frames, yaw, tool, t0..t1 (fraction), extra
  const A=[
    ['walk','Walk_Loop',12,1,null],['lamp','Walk_Lantern',12,-1,'lamp'],['fall','Jump_Loop',6,1,null],['float','Jump_Loop',6,1,null,0.35,0.6],
    ['climb','ClimbUp_1m',10,1,null,0.05,0.6],['hoist','ClimbUp_1m',6,1,null,0.6,0.98],['block','Idle_Loop',8,0,null],
    ['build','Farm_PlantSeed',12,1,'mallet'],['bash','TreeChopping_Loop',12,1,'pick'],['mine','Farm_Harvest',12,1,'pick'],
    ['dig','Fixing_Kneeling',10,0.5,null],['shrug','Idle_No_Loop',8,1,null],['splat','Death01',10,1,null,0,0.9],
    ['exit','Yes',10,0,null],['taken','Hit_Knockback',8,1,null,0,0.95],['idle','Idle_Loop',8,0.5,null]];
  const cv=document.createElement('canvas');const cols=12;cv.width=FW*cols;cv.height=FH*A.length;const ctx=cv.getContext('2d');
  const meta={fw:FW,fh:FH,ppm:PPM,baseY:Math.round(FH*0.84),anims:{}};
  for(let r=0;r<A.length;r++){const [name,clipName,n,yaw,tool,t0=0,t1=1,ts]=A[r];const clip=CL[clipName];if(!clip)throw new Error('no clip '+clipName);
    canopy.visible=ropes.visible=name==='float';pick.visible=tool==='pick';mallet.visible=tool==='mallet';lampG.visible=tool==='lamp';
    root.rotation.y=yaw*Math.PI/2;mixer.stopAllAction();const act=mixer.clipAction(clip);act.reset();act.play();act.setEffectiveWeight(1);
    let tp=null;if(name==='block'){tp=mixer.clipAction(CL.A_TPose);tp.reset();tp.play();tp.setEffectiveWeight(0.7);act.setEffectiveWeight(0.3);}
    for(let f=0;f<n;f++){const loop=/Loop/.test(clipName)&&t0===0&&t1===1;const tt=(t0+(t1-t0)*(loop?f/n:f/(n-1)))*clip.duration;act.time=tt;mixer.update(0);
      model.updateMatrixWorld(true);
      if(name==='float'){const hl=new THREE.Vector3(),hr=new THREE.Vector3();byName.hand_l.getWorldPosition(hl);byName.hand_r.getWorldPosition(hr);const a=ropeG.attributes.position;
        const rim=[[-0.47,1.4,0.17],[0.47,1.4,0.17],[-0.47,1.4,-0.17],[0.47,1.4,-0.17]];const hs=[hl,hr,hl,hr];
        rim.forEach((p,i)=>{a.setXYZ(i*2,p[0],p[1]+0.43,p[2]);a.setXYZ(i*2+1,hs[i].x,hs[i].y,hs[i].z);});a.needsUpdate=true;}
      model.updateMatrixWorld(true);if(lampG.visible){lampG.updateMatrixWorld(true);const q=new THREE.Quaternion();lampG.parent.getWorldQuaternion(q);lampG.quaternion.copy(q.invert());}
      renderer.render(scene,cam);ctx.drawImage(renderer.domElement,f*FW,r*FH,FW,FH);}
    meta.anims[name]={row:r,n};}
  return {png:cv.toDataURL('image/png'),meta};};
