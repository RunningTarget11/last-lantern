import {chromium} from 'playwright';import fs from 'fs';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await (await browser.newContext({viewport:{width:900,height:600}})).newPage();
await page.goto('file:///workspace/last-lantern/index.html?level=1');await page.waitForFunction(()=>window.__LL,null,{timeout:180000});
const icons=await page.evaluate(()=>[...document.querySelectorAll('#tools img')].map(i=>i.src));
// contact sheet via canvas in page
const sheet=await page.evaluate(async(icons)=>{const c=document.createElement('canvas');c.width=icons.length*120;c.height=120;const g=c.getContext('2d');g.fillStyle='#222';g.fillRect(0,0,c.width,120);
  for(let i=0;i<icons.length;i++){const im=new Image();im.src=icons[i];await im.decode().catch(()=>{});g.drawImage(im,i*120+4,4,112,112);}return c.toDataURL('image/png');},icons);
fs.writeFileSync('/tmp/icons.png',Buffer.from(sheet.split(',')[1],'base64'));await browser.close();
