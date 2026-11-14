import {run,SOL} from './solve.mjs';
const id=+process.argv[2],T=+process.argv[3];const s=run(id,SOL[id],{maxT:T});
for(const m of s.miners)console.log(m.id,m.state,m.role||'',m.x.toFixed(1),m.y.toFixed(1),'dir',m.dir,'fear',m.fear.toFixed(2),'lum',(m.lum||0).toFixed(2),m.following?'F':'');
console.log('fm',s.foreman.x.toFixed(1),s.foreman.y.toFixed(1),s.foreman.state,'saved',s.saved,'lost',s.lost,'t',s.t.toFixed(1),'tools',JSON.stringify(s.tools));
console.log('zones',s.zones.map(z=>[z.shored,z.fallen,z.t]));
