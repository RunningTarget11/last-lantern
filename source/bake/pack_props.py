# Crops the Blender prop renders and packs them into one atlas + JSON (origin in px, px/m).
from PIL import Image
import json,glob,os
D='/workspace/lem-src/assets/props/';meta=json.load(open(D+'meta.json'))
items=[]
for n,m in meta.items():
    im=Image.open(D+n+'.png').convert('RGBA');bb=im.getbbox()
    if not bb:continue
    im=im.crop(bb);items.append((n,im,m['ox']-bb[0],m['oy']-bb[1],m['ppm']))
items.sort(key=lambda t:-t[1].height)
W=512;x=y=rowh=0;pos={}
for n,im,ox,oy,ppm in items:
    if x+im.width>W:x=0;y+=rowh+2;rowh=0
    pos[n]=(x,y);x+=im.width+2;rowh=max(rowh,im.height)
H=y+rowh;atlas=Image.new('RGBA',(W,H))
out={}
for n,im,ox,oy,ppm in items:
    px,py=pos[n];atlas.paste(im,(px,py));out[n]={'x':px,'y':py,'w':im.width,'h':im.height,'ox':round(ox,1),'oy':round(oy,1),'ppm':round(ppm,2)}
atlas.save('/workspace/lem-src/assets/props.png',optimize=True);json.dump(out,open('/workspace/lem-src/assets/props.json','w'))
print(W,H,os.path.getsize('/workspace/lem-src/assets/props.png'))
