# Last Lantern - Blender asset pass. Run: blender -b --factory-startup -P build_props.py
# Models mine props procedurally, bakes AO (vertex colours) and, for rocks, a high->low
# normal map + albedo/AO atlas with Cycles (CPU), then exports one optimized GLB.
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, noise
import numpy as np
random.seed(7)
TEX='/workspace/ll-src/tex/'; T5='/workspace/ll-blender/tex512/'; OUT='/workspace/ll-blender/out/'
sc=bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=24
if sc.world is None: sc.world=bpy.data.worlds.new('W')
sc.world.light_settings.distance=0.25

# ---------------- materials ----------------
def img(name,path,size=512,noncolor=False):
    if name in bpy.data.images: return bpy.data.images[name]
    im=bpy.data.images.load(path); im.name=name
    if im.size[0]>size: im.scale(size,size)
    if noncolor: im.colorspace_settings.name='Non-Color'
    return im
def mat(name,base=None,nor=None,color=(0.5,0.5,0.5,1),metal=0.0,rough=0.8,alpha_img=None,transmit=False,nstr=1.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=color; b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
    if base:
        t=nt.nodes.new('ShaderNodeTexImage'); t.image=base; nt.links.new(t.outputs['Color'],b.inputs['Base Color'])
        if alpha_img is True: nt.links.new(t.outputs['Alpha'],b.inputs['Alpha']); m.blend_method='CLIP' if hasattr(m,'blend_method') else None
    if nor:
        t=nt.nodes.new('ShaderNodeTexImage'); t.image=nor; n=nt.nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value=nstr
        nt.links.new(t.outputs['Color'],n.inputs['Color']); nt.links.new(n.outputs['Normal'],b.inputs['Normal'])
    if transmit:
        b.inputs['Alpha'].default_value=0.25
        try: m.surface_render_method='BLENDED'
        except Exception: pass
    return m
woodD=img('wood_diff',T5+'medieval_wood_diff.jpg'); woodN=img('wood_nor',T5+'medieval_wood_nor.jpg',noncolor=True)
rustD=img('rust_diff',T5+'rusty_metal_02_diff.jpg'); rustN=img('rust_nor',T5+'rusty_metal_02_nor.jpg',noncolor=True)
# gauze: fine woven wire mesh with alpha
G=128; a=np.zeros((G,G,4),np.float32); yy,xx=np.mgrid[0:G,0:G]
wire=((xx%8)<2)|((yy%8)<2); a[...,0]=0.42;a[...,1]=0.33;a[...,2]=0.2;a[...,3]=np.where(wire,1.0,0.0)
gz=bpy.data.images.new('gauze',G,G,alpha=True); gz.pixels=a.ravel(); gz.file_format='PNG'; gz.pack()
M={
 'Wood':mat('LL_Wood',woodD,woodN,rough=0.85),
 'Iron':mat('LL_Iron',rustD,rustN,metal=0.55,rough=0.75),
 'Brass':mat('LL_Brass',None,rustN,color=(0.62,0.43,0.2,1),metal=1.0,rough=0.38,nstr=0.25),
 'Glass':mat('LL_Glass',None,None,color=(0.75,0.7,0.6,1),rough=0.05,transmit=True),
 'Gauze':mat('LL_Gauze',gz,None,metal=0.8,rough=0.5,alpha_img=True),
 'Cloth':mat('LL_Tar',None,woodN,color=(0.07,0.05,0.035,1),rough=0.92,nstr=0.6),
 'Cable':mat('LL_Cable',None,None,color=(0.08,0.07,0.06,1),metal=0.7,rough=0.55),
}

# ---------------- helpers ----------------
def obj_from_bm(bm,name,mats):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); sc.collection.objects.link(o)
    for m in mats: me.materials.append(m)
    return o
def box_uv(o,scale=1.0,length_axis=None,seed=0):
    """World-scale box projection; along a timber's length axis the grain runs along U."""
    me=o.data; uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap'); off=random.Random(seed).random()*7
    for p in me.polygons:
        n=p.normal; ax=max(range(3),key=lambda i:abs(n[i]))
        for li in p.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co; others=[i for i in range(3) if i!=ax]
            if length_axis is not None and length_axis in others: v_i=length_axis; u_i=[i for i in others if i!=length_axis][0]
            else: u_i,v_i=others
            uv.data[li].uv=(co[u_i]*scale+off, co[v_i]*scale+off*0.37)
def cyl_uv(o,axis=2,scale=0.5,circ=0.7):
    me=o.data; uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        us=[]
        for li in p.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co; o2=[i for i in range(3) if i!=axis]
            ang=math.atan2(co[o2[1]],co[o2[0]]); us.append(ang)
        # unwrap seam fix
        if max(us)-min(us)>math.pi: us=[u+2*math.pi if u<0 else u for u in us]
        for k,li in enumerate(p.loop_indices):
            co=me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv=(us[k]/(2*math.pi)*circ*0.3+0.31, co[axis]*scale)
def apply_mods(o):
    bpy.context.view_layer.objects.active=o
    for o2 in bpy.context.selected_objects: o2.select_set(False)
    o.select_set(True)
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def bevel(o,w=0.008,seg=2,angle=40):
    md=o.modifiers.new('bev','BEVEL'); md.width=w; md.segments=seg; md.limit_method='ANGLE'; md.angle_limit=math.radians(angle); md.harden_normals=False
def smooth(o,angle=35):
    for p in o.data.polygons: p.use_smooth=True
    try: o.data.set_sharp_from_angle(angle=math.radians(angle))
    except Exception:
        try: bpy.context.view_layer.objects.active=o; bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        except Exception: pass
def join(objs,name):
    for o2 in bpy.context.selected_objects: o2.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); o=bpy.context.active_object; o.name=name; o.data.name=name; return o
def mat_index(o,m):
    if m.name not in [x.name for x in o.data.materials]: o.data.materials.append(m)
    return [x.name for x in o.data.materials].index(m.name)
def set_all_mat(o,m):
    o.data.materials.clear(); o.data.materials.append(m)

# Timber log: hewn, irregular, with an axe-cut notch near the top, end checks; along Z, centred.
def log(name,r,L,seed,notch=True):
    rr=random.Random(seed); bm=bmesh.new(); segs=12; rings=int(L/0.12)+1
    verts=[]
    for i in range(rings):
        z=-L/2+L*i/(rings-1); ring=[]
        for k in range(segs):
            a=2*math.pi*k/segs; hew=1.0-0.12*abs(math.cos(2*a))  # squared-off by an adze
            n=noise.noise(Vector((math.cos(a)*2,math.sin(a)*2,z*1.7+seed)))*0.07+noise.noise(Vector((k*0.9,z*9,seed)))*0.025
            rad=r*(hew+n)*(0.97+0.03*math.sin(z*3+seed))
            if notch and z>L/2-0.22 and math.cos(a)>0.5: rad*=0.82
            ring.append(bm.verts.new((math.cos(a)*rad,math.sin(a)*rad,z)))
        verts.append(ring)
    for i in range(rings-1):
        for k in range(segs):
            bm.faces.new((verts[i][k],verts[i][(k+1)%segs],verts[i+1][(k+1)%segs],verts[i+1][k]))
    for ring,rev in ((verts[0],True),(verts[-1],False)):
        f=bm.faces.new(ring[::-1] if rev else ring)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    o=obj_from_bm(bm,name,[M['Wood']]); bevel(o,0.01,2,30); apply_mods(o); cyl_uv(o,2,0.55,0.5); smooth(o,50); return o

def plank(name,sx,sy,sz,seed):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0)
    for v in bm.verts: v.co=Vector((v.co.x*sx,v.co.y*sy,v.co.z*sz))
    bmesh.ops.subdivide_edges(bm,edges=[e for e in bm.edges if abs((e.verts[0].co-e.verts[1].co).x)>0.1],cuts=max(1,int(sx/0.12)),use_grid_fill=True)
    rr=random.Random(seed)
    for v in bm.verts: v.co.z+=noise.noise(Vector((v.co.x*3,v.co.y*3,seed)))*sz*0.25; v.co.y+=noise.noise(Vector((v.co.x*2,seed,1)))*0.01
    o=obj_from_bm(bm,name,[M['Wood']]); bevel(o,min(0.012,sz*0.25),2); apply_mods(o); box_uv(o,0.6,0 if sx>=sy else 1,seed); smooth(o,40); return o

def lathe(name,prof,segs,m,axis='Z'):
    bm=bmesh.new(); rings=[]
    for (r,z) in prof:
        ring=[]
        for k in range(segs):
            a=2*math.pi*k/segs; ring.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r,z)))
        rings.append(ring)
    for i in range(len(rings)-1):
        for k in range(segs):
            q=(rings[i][k],rings[i][(k+1)%segs],rings[i+1][(k+1)%segs],rings[i+1][k])
            if len(set(v.co.to_tuple(5) for v in q))>=3: bm.faces.new(q)
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    o=obj_from_bm(bm,name,[m]); cyl_uv(o,2,1.5,0.6); smooth(o,60); return o
def tube(name,r,p0,p1,m,segs=8):
    d=Vector(p1)-Vector(p0); L=d.length; o=lathe(name,[(0,0),(r,0),(r,L),(0,L)],segs,m)
    o.matrix_world=Matrix.Translation(Vector(p0))@d.to_track_quat('Z','Y').to_matrix().to_4x4(); return o
def cube(name,size,loc,m,bev=0.004,uvscale=1.0,seed=0,length_axis=None):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0)
    for v in bm.verts: v.co=Vector((v.co.x*size[0],v.co.y*size[1],v.co.z*size[2]))
    o=obj_from_bm(bm,name,[m]); o.location=loc
    if bev>0: bevel(o,bev,1 if bev<0.006 else 2,60); apply_mods(o)
    box_uv(o,uvscale,length_axis,seed); smooth(o,40); return o
def bake_xform(o):
    bpy.context.view_layer.objects.active=o
    for o2 in bpy.context.selected_objects: o2.select_set(False)
    o.select_set(True); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

ASSETS=[]
def place(o,slot): o.location=Vector((slot*4.0,0,0)); ASSETS.append(o); return o
def finish(parts,name,slot):
    for p in parts: bake_xform(p)
    o=join(parts,name); place(o,slot); return o

# ---------------- timbers ----------------
post=log('LL_TimberPost',0.11,2.5,3); place(post,0)
cap=log('LL_TimberCap',0.12,2.0,5,notch=False); cap.rotation_euler=(math.pi/2,0,0); bake_xform(cap); place(cap,1)   # three: along Z
plk=plank('LL_Plank',0.9,0.25,0.06,9); place(plk,2)
# ---------------- rails & sleeper ----------------
def rail_seg():
    prof=[(-0.03,0),(0.03,0),(0.03,0.008),(0.007,0.014),(0.006,0.034),(0.016,0.038),(0.016,0.05),(-0.016,0.05),(-0.016,0.038),(-0.006,0.034),(-0.007,0.014),(-0.03,0.008)]
    bm=bmesh.new(); n=len(prof); steps=8; L=2.0; rings=[]
    for i in range(steps+1):
        x=L*i/steps; rings.append([bm.verts.new((x,p[0],p[1])) for p in prof])
    for i in range(steps):
        for k in range(n): bm.faces.new((rings[i][k],rings[i][(k+1)%n],rings[i+1][(k+1)%n],rings[i+1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    o=obj_from_bm(bm,'LL_Rail2m',[M['Iron']]); box_uv(o,1.0,0,4); smooth(o,30); return o
rl=rail_seg(); place(rl,3)
sl=plank('LL_Sleeper',0.16,1.45,0.07,11)
# spikes holding the rails (three z -0.62 and 0.38 relative to sleeper centre -0.12 -> blender y = 0.5 and -0.5)
spikes=[]
for y in (0.5,-0.5):
    for dx in (-0.045,0.045): spikes.append(cube('spk',(0.018,0.018,0.03),(dx,y,0.04),M['Iron'],bev=0.003))
sl=finish([sl]+spikes,'LL_Sleeper',4)

# ---------------- mine cart ----------------
def cart():
    parts=[]
    bm=bmesh.new()
    b0,b1=(0.6,0.42),(0.66,0.48); z0,z1=0.47,1.04
    vs=[bm.verts.new((sx*b0[0],sy*b0[1],z0)) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]+[bm.verts.new((sx*b1[0],sy*b1[1],z1)) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]
    bm.faces.new(vs[0:4][::-1])
    for k in range(4): bm.faces.new((vs[k],vs[(k+1)%4],vs[4+(k+1)%4],vs[4+k]))
    bmesh.ops.subdivide_edges(bm,edges=bm.edges[:],cuts=3,use_grid_fill=True)
    # dents
    for v in bm.verts: v.co+= v.co.normalized()*0.0*0
    o=obj_from_bm(bm,'tub',[M['Iron']])
    md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=0.025; md.offset=-1
    bevel(o,0.006,2,50); apply_mods(o)
    for v in o.data.vertices:
        v.co+=Vector((0,0,0))+v.normal*noise.noise(v.co*6)*0.008
    box_uv(o,1.0,None,2); smooth(o,40); parts.append(o)
    # riveted bands
    for z in (0.62,0.9):
        t=(z-z0)/(z1-z0); hx=b0[0]+(b1[0]-b0[0])*t+0.012; hy=b0[1]+(b1[1]-b0[1])*t+0.012
        for (cx,cy,sx,sy) in ((0,hy,2*hx+0.03,0.012),(0,-hy,2*hx+0.03,0.012),(hx,0,0.012,2*hy+0.03),(-hx,0,0.012,2*hy+0.03)):
            parts.append(cube('band',(sx,sy,0.05),(cx,cy,z),M['Iron'],bev=0.003,seed=int(z*10)))
        for side in (1,-1):
            for k in range(7):
                x=-hx+0.06+k*(2*hx-0.12)/6
                r=lathe('rv',[(0,0),(0.011,0),(0.009,0.006),(0,0.009)],6,M['Iron']); r.rotation_euler=(-side*math.pi/2,0,0); r.location=(x,side*(hy+0.006),z); parts.append(r)
            for k in range(5):
                y=-hy+0.06+k*(2*hy-0.12)/4
                r=lathe('rv',[(0,0),(0.011,0),(0.009,0.006),(0,0.009)],6,M['Iron']); r.rotation_euler=(0,side*math.pi/2,0); r.location=(side*(hx+0.006),y,z); parts.append(r)
    # lip
    for (cx,cy,sx,sy) in ((0,b1[1],2*b1[0]+0.05,0.04),(0,-b1[1],2*b1[0]+0.05,0.04),(b1[0],0,0.04,2*b1[1]+0.05),(-b1[0],0,0.04,2*b1[1]+0.05)):
        parts.append(cube('lip',(sx,sy,0.03),(cx,cy,z1),M['Iron'],bev=0.006))
    # wooden chassis + iron axles + flanged spoked wheels (three: wheels at z=+-0.5 -> blender y)
    for y in (0.3,-0.3): parts.append(cube('beam',(1.45,0.11,0.12),(0,y,0.4),M['Wood'],bev=0.01,uvscale=0.7,seed=int(y*10)+5,length_axis=0))
    for x in (-0.42,0.42):
        parts.append(cube('bumper',(0.06,0.9,0.1),(x*1.62,0,0.44),M['Wood'],bev=0.01,uvscale=0.7,seed=8,length_axis=1))
        a=tube('axle',0.03,(x,-0.55,0.2),(x,0.55,0.2),M['Iron'],10); parts.append(a)
        for y in (0.5,-0.5):
            w=lathe('wheel',[(0.0,-0.035),(0.05,-0.035),(0.05,-0.02),(0.125,-0.012),(0.135,-0.03),(0.15,-0.03),(0.15,0.02),(0.172,0.03),(0.172,0.04),(0.135,0.04),(0.125,0.012),(0.05,0.02),(0.05,0.035),(0,0.035)],20,M['Iron'])
            w.rotation_euler=(math.pi/2 if y>0 else -math.pi/2,0,0); w.location=(x,y,0.2); parts.append(w)
            for k in range(6):
                ang=k*math.pi/3; s=cube('spoke',(0.02,0.012,0.08),(0,0,0),M['Iron'],bev=0.002)
                s.rotation_euler=(0,ang,0); s.location=(x+math.sin(ang)*0.087,y,0.2+math.cos(ang)*0.087); parts.append(s)
    return parts
cart_parts=cart()

# ---------------- Davy lamp (flame/glass glow added in-game) ----------------
def davy():
    p=[]
    p.append(lathe('base',[(0,0),(0.07,0),(0.076,0.006),(0.076,0.03),(0.07,0.034),(0.074,0.05),(0.074,0.062),(0.06,0.07),(0.05,0.075),(0.05,0.08),(0,0.08)],32,M['Brass']))
    g=lathe('glass',[(0.046,0.075),(0.046,0.17)],24,M['Glass']); p.append(g)
    p.append(lathe('ringL',[(0.05,0.165),(0.056,0.17),(0.056,0.18),(0.05,0.185)],32,M['Brass']))
    gzc=lathe('gauze',[(0.045,0.18),(0.035,0.31)],24,M['Gauze']); p.append(gzc)
    for k in range(3):
        a=k/3*2*math.pi+0.5; p.append(tube('pillar',0.0055,(math.cos(a)*0.06,math.sin(a)*0.06,0.075),(math.cos(a)*0.06,math.sin(a)*0.06,0.3),M['Brass'],8))
    p.append(lathe('bonnet',[(0.064,0.29),(0.066,0.3),(0.05,0.33),(0.02,0.35),(0.012,0.36),(0,0.362)],32,M['Brass']))
    ring=bmesh.new(); bmesh.ops.create_circle(ring,cap_ends=False,radius=0.035,segments=20)
    o=obj_from_bm(ring,'hookpath',[M['Brass']]); bpy.ops.object.select_all(action='DESELECT')
    # hook ring as a torus
    bpy.ops.mesh.primitive_torus_add(major_radius=0.033,minor_radius=0.0045,major_segments=20,minor_segments=6,location=(0,0,0.395),rotation=(math.pi/2,0,0))
    t=bpy.context.active_object; set_all_mat(t,M['Brass']); smooth(t,60); box_uv(t); p.append(t)
    bpy.data.objects.remove(o,do_unlink=True)
    return p
davy_parts=davy()

# ---------------- torch: tar-soaked rag wrapped on a split stave ----------------
def torch():
    p=[]
    st=log('stave',0.03,0.55,13,notch=False); st.location=(0,0,-0.22); p.append(st)
    bm=bmesh.new(); segs=14; rings=10; vs=[]
    for i in range(rings):
        z=-0.02+0.16*i/(rings-1); ring=[]
        for k in range(segs):
            a=2*math.pi*k/segs; wrap=0.012*math.sin(a*1+z*60)  # spiral bulges
            r=0.047+0.008*math.sin(math.pi*i/(rings-1))+wrap+noise.noise(Vector((k,z*30,1)))*0.004
            ring.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r,z)))
        vs.append(ring)
    for i in range(rings-1):
        for k in range(segs): bm.faces.new((vs[i][k],vs[i][(k+1)%segs],vs[i+1][(k+1)%segs],vs[i+1][k]))
    bm.faces.new(vs[0][::-1]); bm.faces.new(vs[-1])
    w=obj_from_bm(bm,'rag',[M['Cloth']]); cyl_uv(w,2,2.0,0.5); smooth(w,70); p.append(w)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.034,minor_radius=0.006,major_segments=16,minor_segments=6,location=(0,0,-0.035))
    t=bpy.context.active_object; set_all_mat(t,M['Iron']); box_uv(t); p.append(t)
    return p
torch_parts=torch()

# ---------------- pickaxe & mallet ----------------
def pick():
    p=[]; h=log('haft',0.022,0.86,17,notch=False); h.location=(0,0,0.43); p.append(h)
    # forged, curved double-ended head along X, bending down
    bm=bmesh.new(); segs=8; n=14; rings=[]
    for i in range(n):
        t=i/(n-1)*2-1; x=t*0.32; z=0.8-0.06*t*t; th=0.034*(1-0.8*abs(t))+0.006
        tw=1.6 if t>0 else 1.0
        ring=[bm.verts.new((x, math.cos(2*math.pi*k/segs)*th*0.8, z+math.sin(2*math.pi*k/segs)*th*tw)) for k in range(segs)]
        rings.append(ring)
    for i in range(n-1):
        for k in range(segs): bm.faces.new((rings[i][k],rings[i][(k+1)%segs],rings[i+1][(k+1)%segs],rings[i+1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    hd=obj_from_bm(bm,'phead',[M['Iron']]); box_uv(hd,3.0); smooth(hd,60); p.append(hd)
    p.append(cube('eye',(0.07,0.06,0.09),(0,0,0.8),M['Iron'],bev=0.008))
    return p
def mallet():
    p=[]; h=log('mh',0.017,0.5,19,notch=False); h.location=(0,0,0.25); p.append(h)
    hd=log('mhead',0.07,0.22,23,notch=False); hd.rotation_euler=(0,math.pi/2,0); hd.location=(0,0,0.5); p.append(hd)
    for x in (-0.1,0.1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.07,minor_radius=0.008,major_segments=18,minor_segments=6,location=(x,0,0.5),rotation=(0,math.pi/2,0))
        t=bpy.context.active_object; set_all_mat(t,M['Iron']); box_uv(t); p.append(t)
    return p
pick_parts=pick(); mallet_parts=mallet()

# ---------------- exit lift cage ----------------
def angle_iron(name,L,axis,loc,rot=0):
    s=0.06; t=0.008
    prof=[(0,0),(s,0),(s,t),(t,t),(t,s),(0,s)]
    bm=bmesh.new(); r0=[bm.verts.new((p[0]-s/2,p[1]-s/2,-L/2)) for p in prof]; r1=[bm.verts.new((p[0]-s/2,p[1]-s/2,L/2)) for p in prof]
    n=len(prof)
    for k in range(n): bm.faces.new((r0[k],r0[(k+1)%n],r1[(k+1)%n],r1[k]))
    bm.faces.new(r0[::-1]); bm.faces.new(r1)
    bmesh.ops.subdivide_edges(bm,edges=[e for e in bm.edges if abs((e.verts[0].co-e.verts[1].co).z)>0.3],cuts=int(L/0.3))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    o=obj_from_bm(bm,name,[M['Iron']]); bevel(o,0.002,1,50); apply_mods(o); box_uv(o,1.0,2,int(L*10)); smooth(o,40)
    if axis=='X': o.rotation_euler=(0,math.pi/2,rot)
    elif axis=='Y': o.rotation_euler=(math.pi/2,rot,0)
    else: o.rotation_euler=(0,0,rot)
    o.location=loc; return o
def lift():
    W,H,D=1.7,2.5,1.7; p=[]
    for i,(x,y) in enumerate(((-1,-1),(1,-1),(1,1),(-1,1))): p.append(angle_iron('post',H,'Z',(x*W/2,y*D/2,H/2),rot=i*math.pi/2))
    for z in (0.05,H-0.03,H*0.5):
        for y in (-D/2,D/2): p.append(angle_iron('rx',W,'X',(0,y,z)))
        for x in (-W/2,W/2): p.append(angle_iron('ry',D,'Y',(x,0,z)))
    # back (three -z -> blender +y) and side bars
    for k in range(1,6): p.append(tube('bar',0.011,(-W/2+k*W/6,D/2,0.05),(-W/2+k*W/6,D/2,H),M['Iron'],6))
    for k in range(1,4): p.append(tube('bar',0.011,(W/2,-D/2+k*D/4,0.05),(W/2,-D/2+k*D/4,H),M['Iron'],6))
    for k in range(7): p.append(plank('floor',0.24,D-0.04,0.045,30+k)); p[-1].location=(-W/2+0.13+k*0.24,0,0.06)
    # crosshead with sheave and chains
    p.append(cube('cross',(W+0.1,0.14,0.16),(0,0,H+0.12),M['Iron'],bev=0.01))
    sh=lathe('sheave',[(0,-0.03),(0.2,-0.03),(0.2,-0.015),(0.17,0),(0.2,0.015),(0.2,0.03),(0,0.03)],28,M['Iron']); sh.rotation_euler=(math.pi/2,0,0); sh.location=(0,0,H+0.42); p.append(sh)
    for x in (-0.6,0.6): p.append(tube('chain',0.012,(x,0,H+0.05),(0,0,H+0.4),M['Cable'],6))
    p.append(tube('rope',0.016,(0,0,H+0.6),(0,0,H+20),M['Cable'],8))
    gate=[]
    for k in range(5): gate.append(tube('g',0.011,(-W/2+0.15+k*0.34,-D/2,0.1),(-W/2+0.15+k*0.34,-D/2,H*0.92),M['Iron'],6))
    for z in (0.15,H*0.9): gate.append(angle_iron('gr',W-0.2,'X',(0,-D/2,z)))
    return p,gate
lift_parts,gate_parts=lift()

# ---------------- rocks: high-poly sculpt -> low-poly + baked normal/albedo/AO atlas ----------------
rock_tex=img('rock_src',TEX+'rock_ground_diff.jpg',1024)
rmat_hi=bpy.data.materials.new('rock_hi'); rmat_hi.use_nodes=True; nt=rmat_hi.node_tree; b=nt.nodes['Principled BSDF']
tc=nt.nodes.new('ShaderNodeTexCoord'); ti=nt.nodes.new('ShaderNodeTexImage'); ti.image=rock_tex; ti.projection='BOX'; ti.projection_blend=0.35
mp=nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(0.6,0.6,0.6); nt.links.new(tc.outputs['Object'],mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'],ti.inputs['Vector'])
hsv=nt.nodes.new('ShaderNodeHueSaturation'); hsv.inputs['Saturation'].default_value=0.55; hsv.inputs['Value'].default_value=0.8
nt.links.new(ti.outputs['Color'],hsv.inputs['Color']); nt.links.new(hsv.outputs['Color'],b.inputs['Base Color'])
highs=[];lows=[]
for i in range(3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6,radius=1.0,location=(i*3.0,20,0))
    hi=bpy.context.active_object; hi.name='rock_hi%d'%i
    sq=(1.0+0.2*i,0.85,0.8-0.06*i); 
    for v in hi.data.vertices:
        c=v.co.copy(); n=c.normalized()
        d=noise.fractal(c*1.3+Vector((i*5,0,0)),0.6,2.1,6)*0.22 + abs(noise.noise(c*4.0+Vector((0,i,0))))*-0.08
        # planar fracture faces
        for ax in (Vector((0.6,0.3,0.74)),Vector((-0.5,0.8,0.2)),Vector((0.1,-0.4,-0.9))):
            ax=ax.normalized(); k=n.dot(ax)
            if k>0.8: d-= (k-0.8)*0.7
        v.co=Vector((n.x*sq[0],n.y*sq[1],n.z*sq[2]))*(1+d)+Vector((i*3.0,20,0))-hi.location
    set_all_mat(hi,rmat_hi); smooth(hi,180)
    lo=hi.copy(); lo.data=hi.data.copy(); lo.name='LL_Rock%s'%'ABC'[i]; lo.data.name=lo.name; sc.collection.objects.link(lo)
    md=lo.modifiers.new('dec','DECIMATE'); md.ratio=(520 if i==0 else 420)/len(lo.data.polygons); apply_mods(lo); smooth(lo,180)
    highs.append(hi); lows.append(lo)
    print('rock',i,'low tris',sum(len(p.vertices)-2 for p in lo.data.polygons))
# one atlas for all three rocks
for o2 in bpy.context.selected_objects: o2.select_set(False)
for lo in lows: lo.select_set(True)
bpy.context.view_layer.objects.active=lows[0]
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=0.01)
bpy.ops.object.mode_set(mode='OBJECT')
# pack islands of all three into a shared 0-1 space
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.select_all(action='SELECT')
try: bpy.ops.uv.pack_islands(margin=0.008)
except Exception as e: print('pack',e)
bpy.ops.object.mode_set(mode='OBJECT')
RS=512
bake_imgs={}
for kind in ('albedo','normal','ao'):
    im=bpy.data.images.new('rock_'+kind,RS,RS,alpha=False); 
    if kind!='albedo': im.colorspace_settings.name='Non-Color'
    bake_imgs[kind]=im
rmat_lo=bpy.data.materials.new('LL_Rock'); rmat_lo.use_nodes=True; nt=rmat_lo.node_tree; bl=nt.nodes['Principled BSDF']; bl.inputs['Roughness'].default_value=0.9
tnode=nt.nodes.new('ShaderNodeTexImage'); nt.nodes.active=tnode
for lo in lows: set_all_mat(lo,rmat_lo)
def do_bake(kind,typ,s2a,**kw):
    tnode.image=bake_imgs[kind]; nt.nodes.active=tnode
    for o2 in bpy.context.selected_objects: o2.select_set(False)
    for i in range(3):
        if s2a: highs[i].select_set(True)
    for lo in lows: lo.select_set(True)
    # bake each rock (selected-to-active pairs)
    for i in range(3):
        for o2 in bpy.context.selected_objects: o2.select_set(False)
        lows[i].select_set(True)
        if s2a: highs[i].select_set(True)
        bpy.context.view_layer.objects.active=lows[i]
        bpy.ops.object.bake(type=typ,use_selected_to_active=s2a,cage_extrusion=0.12,margin=6,use_clear=(i==0),target='IMAGE_TEXTURES',**kw)
sc.cycles.samples=16
do_bake('albedo','DIFFUSE',True,pass_filter={'COLOR'})
do_bake('normal','NORMAL',True)
for h in highs: h.hide_render=False
sc.cycles.samples=48
do_bake('ao','AO',True)
A=np.array(bake_imgs['albedo'].pixels[:]).reshape(RS,RS,4); O=np.array(bake_imgs['ao'].pixels[:]).reshape(RS,RS,4)
C=A.copy(); C[...,:3]=A[...,:3]*(0.35+0.65*O[...,:3]); C[...,3]=1
fin=bpy.data.images.new('LL_Rock_basecolor',RS,RS); fin.pixels=C.ravel()
nrm=bake_imgs['normal']; nrm.name='LL_Rock_normal'
for im in (fin,nrm): im.pack()
# final rock material: baked albedo*AO + baked normal
nt.nodes.remove(tnode)
t1=nt.nodes.new('ShaderNodeTexImage'); t1.image=fin; nt.links.new(t1.outputs['Color'],bl.inputs['Base Color'])
t2=nt.nodes.new('ShaderNodeTexImage'); t2.image=nrm; nm=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t2.outputs['Color'],nm.inputs['Color']); nt.links.new(nm.outputs['Normal'],bl.inputs['Normal'])
for h in highs: bpy.data.objects.remove(h,do_unlink=True)
for i,lo in enumerate(lows):
    for o2 in bpy.context.selected_objects: o2.select_set(False)
    lo.select_set(True); bpy.context.view_layer.objects.active=lo
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS'); place(lo,20+i)
# ore heap for the cart: rock instances joined, sharing the rock atlas
ore=[]
for k in range(8):
    src=lows[1+k%2]; o=src.copy(); o.data=src.data.copy(); sc.collection.objects.link(o)
    a=random.random()*6.28; r=random.random()**0.5
    o.location=(math.cos(a)*r*0.5,math.sin(a)*r*0.33,0.98+(1-r)*0.14+random.random()*0.04); o.rotation_euler=(random.random()*6,random.random()*6,random.random()*6); s=0.07+random.random()*0.06; o.scale=(s,s,s)
    ore.append(o)
cart_obj=finish(cart_parts+ore,'LL_Cart',5)
davy_obj=finish(davy_parts,'LL_DavyLamp',6)
torch_obj=finish(torch_parts,'LL_Torch',7)
pick_obj=finish(pick_parts,'LL_Pickaxe',8)
mallet_obj=finish(mallet_parts,'LL_Mallet',9)
lift_obj=finish(lift_parts,'LL_LiftCage',10)
gate_obj=finish(gate_parts,'LL_LiftGate',10)
# rocks were placed above; remove them from ASSETS duplicates and re-place
# ---------------- AO bake into vertex colours (all non-rock assets) ----------------
for o2 in bpy.context.selected_objects: o2.select_set(False)
ao_targets=[o for o in ASSETS if not o.name.startswith('LL_Rock')]
for o in ao_targets:
    # densify long flat faces so per-vertex AO has resolution
    ca=o.data.color_attributes.new('Col','BYTE_COLOR','POINT'); o.data.color_attributes.active_color=ca
    try: o.data.color_attributes.render_color_index=o.data.color_attributes.active_color_index
    except Exception: pass
sc.cycles.samples=64
for o in ao_targets:
    for o2 in bpy.context.selected_objects: o2.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active=o
    # isolate: hide other assets from render so AO is self-occlusion only
    for o3 in ASSETS: o3.hide_render=(o3 is not o)
    bpy.ops.object.bake(type='AO',target='VERTEX_COLORS')
for o3 in ASSETS: o3.hide_render=False
# lift AO toward 1 a little (soft contact darkening rather than black)
for o in ao_targets:
    ca=o.data.color_attributes['Col']
    for d in ca.data:
        c=d.color; v=0.3+0.7*c[0]; d.color=(v,v,v,1)
# ---------------- export ----------------
for o2 in bpy.context.selected_objects: o2.select_set(False)
for o in ASSETS: o.location=(0,0,0); o.select_set(True)
for o in bpy.data.objects:
    if o not in ASSETS: o.select_set(False)
bpy.ops.export_scene.gltf(filepath=OUT+'ll_props.glb',export_format='GLB',use_selection=True,export_apply=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_image_format='JPEG',export_jpeg_quality=85,export_image_quality=85)
tot=0
for o in ASSETS:
    t=sum(len(p.vertices)-2 for p in o.data.polygons); tot+=t; print('ASSET',o.name,'tris',t)
print('TOTAL tris',tot)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'ll_props.blend')

for nm in ('LL_Rock_basecolor','LL_Rock_normal'):
    im=bpy.data.images[nm]; im.filepath_raw=OUT+nm+'.png'; im.file_format='PNG'; im.save()
