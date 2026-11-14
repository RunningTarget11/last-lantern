// Builds glb/ll_anims.glb: Quaternius UAL1+UAL2 (CC0) skeleton + the clips Last Lantern uses.
import {NodeIO} from '@gltf-transform/core';
import {resample,prune,dedup} from '@gltf-transform/functions';
const io=new NodeIO();
const U1='/workspace/anim/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';
const U2='/workspace/anim/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb';
const KEEP1=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Jump_Loop','Jump_Land','Crouch_Idle_Loop','Death01','Fixing_Kneeling','Hit_Knockback','Idle_Torch_Loop','Interact','Spell_Simple_Shoot'];
const KEEP2=['Idle_Lantern_Loop','OverhandThrow','TreeChopping_Loop','Farm_Harvest','Idle_No_Loop','Idle_FoldArms_Loop','Hit_Knockback','Yes','Idle_Rail_Call'];
const doc=await io.read(U1);const src=await io.read(U2);
const root=doc.getRoot();const buf=root.listBuffers()[0];
for(const a of root.listAnimations())if(!KEEP1.includes(a.getName()))a.dispose();
for(const m of root.listMeshes()){for(const n of root.listNodes())if(n.getMesh()===m)n.setMesh(null);m.dispose();}
const byName=new Map(root.listNodes().map(n=>[n.getName(),n]));
for(const a of src.getRoot().listAnimations()){
  if(!KEEP2.includes(a.getName())||root.listAnimations().some(b=>b.getName()===a.getName()))continue;
  const na=doc.createAnimation(a.getName());const cache=new Map();
  const acc=(x)=>{if(cache.has(x))return cache.get(x);const y=doc.createAccessor().setType(x.getType()).setArray(x.getArray().slice()).setBuffer(buf);cache.set(x,y);return y;};
  for(const ch of a.listChannels()){const s=ch.getSampler();const tn=byName.get(ch.getTargetNode().getName());if(!tn)continue;
    const ns=doc.createAnimationSampler().setInput(acc(s.getInput())).setOutput(acc(s.getOutput())).setInterpolation(s.getInterpolation());
    na.addSampler(ns).addChannel(doc.createAnimationChannel().setSampler(ns).setTargetNode(tn).setTargetPath(ch.getTargetPath()));}
}
const FING=/^(index|middle|pinky|ring|thumb)_/;
for(const a of root.listAnimations())for(const ch of a.listChannels()){const n=ch.getTargetNode().getName(),p=ch.getTargetPath();
  const keep=p==='rotation'?!FING.test(n):p==='translation'?(n==='pelvis'||n==='root'):false;
  if(!keep){ch.getSampler().dispose();ch.dispose();}}
await doc.transform(resample({tolerance:5e-4}),dedup(),prune());
const live=new Set();for(const a of root.listAnimations())for(const sm of a.listSamplers()){live.add(sm.getInput());live.add(sm.getOutput());}
for(const a of root.listAccessors()){const ps=a.listParents().filter(p=>p!==root);if(ps.length&&ps.every(p=>p.propertyType==='AnimationSampler')&&!live.has(a))a.dispose();else if(!ps.length)a.dispose();}
console.log(root.listAnimations().map(a=>a.getName()).join(', '));
await io.write('glb/ll_anims.glb',doc);
