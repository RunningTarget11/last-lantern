import fs from 'fs';import sharp from 'sharp';
const out={tex:{},glb:{},font:{}};
const T={dark_rock_diff:1024,dark_rock_nor:1024,rock_ground_diff:1024,rock_ground_nor:1024,medieval_wood_diff:512,medieval_wood_nor:512,rusty_metal_02_diff:512,rusty_metal_02_nor:512};
for(const [k,sz] of Object.entries(T)){const buf=await sharp('tex/'+k+'.jpg').resize(sz,sz).jpeg({quality:k.includes('nor')?86:80}).toBuffer();out.tex[k]='data:image/jpeg;base64,'+buf.toString('base64');}
for(const k of ['ll_anims','ch_peasant_lo','ch_head_lo','ch_ranger_lo','wine_barrel_01','wooden_crate_01'])out.glb[k]=fs.readFileSync('glb/'+k+'.glb').toString('base64');
out.font.cinzel='data:font/ttf;base64,'+fs.readFileSync('Cinzel.ttf').toString('base64');
out.font.cinzelDeco='data:font/ttf;base64,'+fs.readFileSync('CinzelDecorative.ttf').toString('base64');
fs.writeFileSync('/workspace/last-lantern/assets.js','window.__ASSETS='+JSON.stringify(out)+';');
console.log(fs.statSync('/workspace/last-lantern/assets.js').size);
