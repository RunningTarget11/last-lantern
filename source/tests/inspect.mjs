import {Sim,CELL} from '../src/sim.js';import {LEVELS} from '../src/levels.js';
const id=+process.argv[2]||1;const s=new Sim(LEVELS[id-1]);
// print fine grid downsampled 2x (0.5m) as ascii
let out='';for(let j=s.gh-1;j>=0;j-=2){let r='';for(let i=0;i<s.gw;i+=2){const v=s.solid(i,j);r+=v===0?' ':v===1?'#':v===2?'=':'r';}out+=r+'\n';}
console.log(out);console.log('entry',s.entry,'exit',s.exit,'foreman',s.foreman.x,s.foreman.y,'zones',s.zones.map(z=>[z.x0,z.x1,z.y0,z.y1,z.t]),'gas',s.gas.map(g=>[g.x0,g.x1,g.y0,g.y1]));
