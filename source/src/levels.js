// Five "Fun"-style levels. Coordinates in mask pixels (miner = 15 px tall).
// Each level: full rock, carved air chambers (rough edges), granite (steel) inserts.
const air=(pts,o={})=>({pts,mat:'air',...o}), rock=(pts,o={})=>({pts,mat:'rock',...o}), steel=(rect,o={})=>({rect,mat:'steel',rough:1.5,...o});
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export const LEVELS=[
 { id:1,name:'Into the Dark',tag:'Dig down to the lift.',w:640,h:240,total:20,quota:10,stars:[10,16,20],rate:50,time:240,
   hint:'They only walk. Give one a pickaxe and let him DIG straight down.',
   skills:{digger:8},
   shapes:[{rect:[0,0,640,240],mat:'rock',rough:0},
     air([[70,28],[330,22],[575,30],[580,110],[66,110]]),
     air([[30,148],[610,146],[612,200],[28,200]],{seed:9}),
     {rect:[586,26,60,90],mat:'steel',rough:1.5},{rect:[0,20,64,96],mat:'steel',rough:1.5}],
   hatch:{x:150,y:36,dir:1},exit:{x:478,y:200},
   decor:[{k:'timber',x:200},{k:'timber',x:420},{k:'lampHang',x:300,y:40},{k:'rails',x0:60,x1:600,floor:'low'},{k:'cart',x:120,floor:'low'}],
   lights:[{x:300,y:52,r:120,kind:'lamp'},{x:520,y:180,r:120,kind:'lamp'}] },
 { id:2,name:'Sack and Rope',tag:'Float down, climb out.',w:760,h:240,total:20,quota:14,stars:[14,18,20],rate:50,time:240,
   hint:'The drop kills. A FLOATER opens his canvas sack; a CLIMBER scales the far wall.',
   skills:{floater:20,climber:20},
   shapes:[{rect:[0,0,760,240],mat:'rock',rough:0},
     air([[40,24],[300,20],[300,70],[40,70]]),                      // starting gallery
     air([[300,20],[730,26],[735,214],[300,214],[296,72]],{seed:4}),  // great hall
     rock([[470,214],[470,150],[478,140],[500,138],[506,150],[506,214]],{seed:3}), // rock rib before the exit
     {rect:[0,0,40,240],mat:'steel',rough:1.5},{rect:[736,0,30,240],mat:'steel',rough:1.5}],
   hatch:{x:100,y:30,dir:1},exit:{x:640,y:214},
   decor:[{k:'timber',x:120},{k:'timber',x:240},{k:'lampHang',x:560,y:40},{k:'rails',x0:520,x1:730,floor:'low'}],
   lights:[{x:180,y:40,r:110,kind:'lamp'},{x:600,y:150,r:150,kind:'lamp'}] },
 { id:3,name:'Mind the Gap',tag:'Bridge the shaft.',w:720,h:240,total:25,quota:18,stars:[18,22,25],rate:45,time:300,
   hint:'Hold the crowd with a BLOCKER, then BUILD a timber stair across the shaft.',
   skills:{blocker:2,builder:6},
   shapes:[{rect:[0,0,720,240],mat:'rock',rough:0},
     air([[40,60],[690,50],[692,150],[405,150],[405,240],[332,240],[332,160],[40,160]],{seed:11}),
     {rect:[0,40,40,140],mat:'steel',rough:1.5},{rect:[692,40,30,130],mat:'steel',rough:1.5}],
   hatch:{x:90,y:70,dir:1},exit:{x:620,y:150},
   decor:[{k:'timber',x:150},{k:'timber',x:260},{k:'timber',x:500},{k:'lampHang',x:380,y:62},{k:'rails',x0:50,x1:320,floor:'low'},{k:'rails',x0:430,x1:680,floor:'low'}],
   lights:[{x:180,y:100,r:120,kind:'lamp'},{x:560,y:100,r:120,kind:'lamp'}] },
 { id:4,name:'Hard Rock',tag:'Bash through, mine under the granite.',w:880,h:240,total:30,quota:22,stars:[22,27,30],rate:45,time:330,
   hint:'BASH through the pillars. Granite will not break: MINE diagonally beneath it.',
   skills:{basher:6,miner:3,blocker:1},
   shapes:[{rect:[0,0,880,240],mat:'rock',rough:0},
     air([[40,50],[600,46],[600,124],[40,124]],{seed:21}),
     rock(box(190,40,28,90),{seed:5}),rock(box(330,40,34,90),{seed:6}),rock(box(450,40,26,90),{seed:8}),
     air([[470,176],[850,170],[852,214],[470,216]],{seed:23}),
     {rect:[560,30,60,96],mat:'steel',rough:1.5},{rect:[0,30,40,120],mat:'steel',rough:1.5},{rect:[852,150,30,90],mat:'steel',rough:1.5}],
   hatch:{x:80,y:58,dir:1},exit:{x:780,y:214},
   decor:[{k:'timber',x:110},{k:'timber',x:270},{k:'timber',x:400},{k:'lampHang',x:520,y:58},{k:'rails',x0:500,x1:840,floor:'low'},{k:'cart',x:700,floor:'low'}],
   lights:[{x:120,y:80,r:110,kind:'lamp'},{x:700,y:190,r:130,kind:'lamp'}] },
 { id:5,name:'The Dark Seam',tag:'Light the way through the seam.',w:960,h:240,total:40,quota:28,stars:[28,34,40],rate:40,time:420,
   hint:'Something lives in the seam. Unlit miners are taken: give one a LAMP or plant TORCHES, then bash, build and dig to the lift.',
   skills:{lamp:2,torch:3,basher:3,builder:4,digger:2,blocker:2,blaster:1,climber:4},
   shapes:[{rect:[0,0,960,240],mat:'rock',rough:0},
     air([[40,40],[250,36],[250,110],[40,110]],{seed:31}),                 // landing gallery
     air([[282,40],[700,34],[702,112],[282,110]],{seed:33}),               // the dark seam (wall 250-282 between)
     air([[700,34],[760,30],[760,240],[700,240]],{seed:35}),                // open shaft (void)
     air([[760,40],[930,40],[930,112],[760,112]],{seed:37}),               // far ledge
     air([[600,150],[930,148],[930,202],[600,202]],{seed:39}),             // lift chamber below far ledge? (reached by digging)
     {rect:[0,20,40,120],mat:'steel',rough:1.5},{rect:[930,20,40,220],mat:'steel',rough:1.5},
     {rect:[760,112,30,60],mat:'steel',rough:1.5}],
   hatch:{x:90,y:48,dir:1},exit:{x:870,y:202},
   dark:[[282,20,420,100]],
   decor:[{k:'timber',x:150},{k:'timber',x:840},{k:'lampHang',x:200,y:50},{k:'rails',x0:610,x1:920,floor:'low'},{k:'cart',x:660,floor:'low'}],
   lights:[{x:150,y:80,r:110,kind:'lamp'},{x:860,y:80,r:110,kind:'lamp'},{x:780,y:190,r:120,kind:'lamp'}] },
];
