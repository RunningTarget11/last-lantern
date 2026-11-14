import {chromium} from 'playwright';import fs from 'fs';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage();page.on('console',m=>console.log('console',m.type(),m.text()));page.on('pageerror',e=>console.log('ERR',e.message));
await page.goto('http://localhost:8123/lem-src/bake/index.html');
const r=await page.evaluate(()=>window.bake());fs.writeFileSync('/workspace/lem-src/assets/miner.png',Buffer.from(r.png.split(',')[1],'base64'));fs.writeFileSync('/workspace/lem-src/assets/miner.json',JSON.stringify(r.meta));
console.log(JSON.stringify(r.meta));await browser.close();
