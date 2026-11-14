import bpy,math
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/workspace/ll-blender/out/ll_props.blend')
sc=bpy.context.scene
names=['LL_Cart','LL_LiftCage','LL_DavyLamp','LL_Torch','LL_Pickaxe','LL_Mallet','LL_TimberPost','LL_RockA','LL_RockB','LL_RockC','LL_Sleeper','LL_Rail2m','LL_Plank','LL_TimberCap','LL_LiftGate']
lay={'LL_Cart':(0,0,0,1),'LL_LiftCage':(2.3,0.5,0,0.75),'LL_LiftGate':(2.3,0.5,0,0.75),'LL_DavyLamp':(-1.0,-0.6,0,2.2),'LL_Torch':(-1.5,-0.6,0.55,1.6),'LL_Pickaxe':(-2.2,-0.4,0,1.2),'LL_Mallet':(-2.7,-0.4,0,1.2),
 'LL_TimberPost':(4.1,0.4,1.0,0.8),'LL_TimberCap':(4.1,0.0,2.05,0.8),'LL_RockA':(1.2,-1.1,0.25,0.35),'LL_RockB':(0.5,-1.3,0.15,0.22),'LL_RockC':(-0.3,-1.4,0.12,0.2),'LL_Sleeper':(0,0,0.035,1),'LL_Rail2m':(-1.0,0.5,0.07,1),'LL_Plank':(4.1,-0.6,0.03,1)}
for o in bpy.data.objects:
    if o.name in lay: x,y,z,s=lay[o.name]; o.location=(x,y,z); o.scale=(s,s,s); o.hide_render=False
    elif o.type=='MESH': o.hide_render=True
# second rail
r=bpy.data.objects['LL_Rail2m']; r2=r.copy(); sc.collection.objects.link(r2); r2.location=(-1.0,-0.5,0.07)
bpy.ops.mesh.primitive_plane_add(size=30); fl=bpy.context.active_object; m=bpy.data.materials['LL_Rock'] if False else bpy.data.materials.new('floor'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.05,0.045,0.04,1); fl.data.materials.append(m)
cam=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co; co.location=(0.8,-7.5,3.2); co.rotation_euler=(math.radians(70),0,0); cam.lens=32
for (loc,e,col) in (((-1.2,-1.6,1.4),120,(1,0.6,0.3)),((3.0,-1.5,1.8),90,(1,0.65,0.35)),((0,3,4),60,(0.5,0.6,0.9))):
    l=bpy.data.lights.new('l','POINT'); l.energy=e; l.color=col; l.shadow_soft_size=0.1; lo=bpy.data.objects.new('l',l); lo.location=loc; sc.collection.objects.link(lo)
sc.world.use_nodes=True; sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.02
sc.render.engine='CYCLES'; sc.cycles.samples=48; sc.cycles.use_denoising=True; sc.render.resolution_x=1280; sc.render.resolution_y=720
sc.view_settings.view_transform='AgX'
# show AO vertex colours: multiply into base colour for the preview render
for mt in bpy.data.materials:
    if not mt.use_nodes or mt.name.startswith('LL_Rock') or mt.name=='floor': continue
    nt=mt.node_tree; b=nt.nodes.get('Principled BSDF'); 
    if not b: continue
    ca=nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name='Col'; mix=nt.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'; mix.inputs['Factor'].default_value=1
    src=b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    if src: nt.links.new(src,mix.inputs['A'])
    else: mix.inputs['A'].default_value=b.inputs['Base Color'].default_value
    nt.links.new(ca.outputs['Color'],mix.inputs['B']); nt.links.new(mix.outputs['Result'],b.inputs['Base Color'])
sc.render.filepath='/workspace/ll-blender/out/preview.png'; bpy.ops.render.render(write_still=True)
