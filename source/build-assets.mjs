import fs from 'fs';
const b64=(f,m)=>`data:${m};base64,`+fs.readFileSync(f).toString('base64');
const A={img:{miner:b64('assets/miner.png','image/png'),props:b64('assets/props.png','image/png'),rock:b64('tex/rock.jpg','image/jpeg'),granite:b64('tex/granite.jpg','image/jpeg'),back:b64('tex/back.jpg','image/jpeg'),wood:b64('tex/wood.jpg','image/jpeg')},
 data:{miner:JSON.parse(fs.readFileSync('assets/miner.json')),props:JSON.parse(fs.readFileSync('assets/props.json'))},
 font:{cinzel:b64('/workspace/ll-src/Cinzel.ttf','font/ttf'),cinzelDeco:b64('/workspace/ll-src/CinzelDecorative.ttf','font/ttf')}};
fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/assets.js','window.LL_A='+JSON.stringify(A)+';');console.log(fs.statSync('dist/assets.js').size);
