# Renders side-on sprites of the Blender mine props for the 2D Lemmings-style build.
import bpy,math,os,json
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/workspace/ll-blender/out/ll_props.blend')
sc=bpy.context.scene;OUT='/workspace/lem-src/assets/props/';os.makedirs(OUT,exist_ok=True)
PPM=64
O={o.name:o for o in bpy.data.objects}
for o in bpy.data.objects:o.hide_render=True
sc.render.engine='CYCLES';sc.cycles.samples=48;sc.cycles.use_denoising=True;sc.render.film_transparent=True
sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items] else 'None'
sc.world.use_nodes=True;bg=sc.world.node_tree.nodes['Background'];bg.inputs['Strength'].default_value=0.25;bg.inputs['Color'].default_value=(0.25,0.28,0.35,1)
# use AO vertex colours in materials (multiply into base colour)
for mt in bpy.data.materials:
    if not mt.use_nodes or mt.name.startswith('LL_Rock'):continue
    nt=mt.node_tree;b=nt.nodes.get('Principled BSDF')
    if not b:continue
    ca=nt.nodes.new('ShaderNodeVertexColor');ca.layer_name='Col';mix=nt.nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs['Factor'].default_value=1
    src=b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    if src:nt.links.new(src,mix.inputs['A'])
    else:mix.inputs['A'].default_value=b.inputs['Base Color'].default_value
    nt.links.new(ca.outputs['Color'],mix.inputs['B']);nt.links.new(mix.outputs['Result'],b.inputs['Base Color'])
cam=bpy.data.cameras.new('cam');cam.type='ORTHO';co=bpy.data.objects.new('cam',cam);sc.collection.objects.link(co);sc.camera=co
co.rotation_euler=(math.radians(90),0,0)  # looking along +Y
def light(name,loc,energy,col,size=0.5):
    l=bpy.data.lights.new(name,'AREA');l.energy=energy;l.color=col;l.size=size;o=bpy.data.objects.new(name,l);o.location=loc;sc.collection.objects.link(o)
    o.rotation_euler=(Vector((0,0,0))-Vector(loc)).to_track_quat('-Z','Y').to_euler();return o
L1=light('key',(-2.5,-4,3.5),900,(1,0.72,0.45),2);L2=light('rim',(3,3,2.5),700,(0.55,0.65,1),2);L3=light('fill',(2,-4,0.5),150,(1,0.6,0.35),3)
META={}
def shot(name,objs,pad=0.08,setup=None,zmax=99):
    for o in bpy.data.objects:
        if o.type=='MESH':o.hide_render=o not in objs
    bpy.context.view_layer.update()
    mn=Vector((1e9,1e9,1e9));mx=-mn
    for o in objs:
        for c in o.bound_box:
            w=o.matrix_world@Vector(c);mn=Vector(map(min,mn,w));mx=Vector(map(max,mx,w))
    mx.z=min(mx.z,zmax)
    w=mx.x-mn.x+pad*2;h=mx.z-mn.z+pad*2;cam.ortho_scale=max(w,h);co.location=((mn.x+mx.x)/2,mn.y-6,(mn.z+mx.z)/2)
    sc.render.resolution_x=max(8,int(round(cam.ortho_scale*PPM)));sc.render.resolution_y=sc.render.resolution_x
    sc.render.filepath=OUT+name+'.png';bpy.ops.render.render(write_still=True)
    # record where the origin (0,0) sits in the image (px from top-left), and px/m
    S=sc.render.resolution_x/cam.ortho_scale;cx=co.location.x;cz=co.location.z
    META[name]={'ppm':S,'ox':(0-cx)*S+sc.render.resolution_x/2,'oy':sc.render.resolution_y/2-(0-cz)*S,'w':sc.render.resolution_x,'h':sc.render.resolution_y}
def dup(name,loc=(0,0,0),rot=(0,0,0),scale=(1,1,1)):
    s=O[name];o=s.copy();o.data=s.data;sc.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;o.scale=scale;o.hide_render=False;return o
# --- exit: lift cage, raised gate, headframe timbers, hanging lamp ---
cage=dup('LL_LiftCage');gate=dup('LL_LiftGate',(0,0,1.9))
p1=dup('LL_TimberPost',(-1.2,0.3,1.25),(0,0,0),(1.1,1.1,1.0));p2=dup('LL_TimberPost',(1.2,0.3,1.25),(0,0,0),(1.1,1.1,1.0))
cp=dup('LL_TimberCap',(0,0.3,2.6),(0,0,math.pi/2),(1.1,1.1,1.3))
lamp=dup('LL_DavyLamp',(0.55,-0.5,1.55),(0,0,0),(1.3,1.3,1.3))
shot('exit',[cage,gate,p1,p2,cp,lamp],zmax=3.6)
for o in (cage,gate,p1,p2,cp,lamp):bpy.data.objects.remove(o)
# --- entrance hatch: timber collar with two plank doors (closed / open) ---
def hatch(open_):
    objs=[dup('LL_TimberCap',(0,0,0),(0,0,math.pi/2),(1.2,1.2,1.25))]
    for sx in (-1,1):
        for k in range(2):
            d=dup('LL_Plank',(0,0,0),(0,0,0),(1.15,1.6,1.4))
            ang=(math.radians(78) if open_ else math.radians(4))*sx
            hx=sx*1.05;d.rotation_euler=(0,ang,0);off=Vector((-sx*0.52,0,0));off.rotate(d.rotation_euler);d.location=Vector((hx,-0.05+k*0.0,-0.14))+off
            objs.append(d)
    objs.append(dup('LL_TimberPost',(-1.25,0,0.3),(0,0,0),(1,1,0.35)));objs.append(dup('LL_TimberPost',(1.25,0,0.3),(0,0,0),(1,1,0.35)))
    return objs
for st in (0,1):
    objs=hatch(st);shot('hatch'+('_open' if st else ''),objs,pad=0.25)
    for o in objs:bpy.data.objects.remove(o)
# --- single timbers for composing supports ---
o=dup('LL_TimberPost',(0,0,0));shot('post',[o]);bpy.data.objects.remove(o)
o=dup('LL_TimberCap',(0,0,0),(0,0,math.pi/2));shot('cap',[o]);bpy.data.objects.remove(o)
o=dup('LL_Plank',(0,0,0));shot('plank',[o],pad=0.02);bpy.data.objects.remove(o)
# --- lamps / torch / tools / cart / rocks ---
o=dup('LL_DavyLamp');shot('lamp',[o],pad=0.03);bpy.data.objects.remove(o)
o=dup('LL_Torch',(0,0,0),(0,math.radians(-8),0));shot('torch',[o],pad=0.03);bpy.data.objects.remove(o)
o=dup('LL_Cart');shot('cart',[o],pad=0.03);bpy.data.objects.remove(o)
for r in 'ABC':
    o=dup('LL_Rock'+r,(0,0,0),(0.4,0.3,0),(0.5,0.5,0.5));shot('rock'+r,[o],pad=0.03);bpy.data.objects.remove(o)
o=dup('LL_Pickaxe',(0,0,0),(0,math.radians(-30),0));shot('pickaxe',[o],pad=0.03);bpy.data.objects.remove(o)
json.dump(META,open(OUT+'meta.json','w'),indent=1)
