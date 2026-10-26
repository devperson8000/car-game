"""Rebuild the two licensed Stunt Rally sources as normalized self-contained GLBs.
Run: blender -b --python scripts/convert-additional-cars.py -- /tmp/apex-sports-candidates
Sources/attributions and pinned revisions: public/licenses/additional-cars.md.
Only the final named authored meshes are retained; no working duplicates exported.
"""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[sys.argv.index('--')+1])
OUT=ROOT/'public/models'

def material(name,texture=None,color=(1,1,1,1),metal=0,rough=.6,glass=False,normal=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');m.node_tree.links.new(p.outputs['BSDF'],out.inputs[0]);p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if texture:
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(texture),check_existing=True);m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
 if normal:
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(normal),check_existing=True);t.image.colorspace_settings.name='Non-Color';nm=n.new('ShaderNodeNormalMap');m.node_tree.links.new(t.outputs['Color'],nm.inputs[1]);m.node_tree.links.new(nm.outputs[0],p.inputs['Normal'])
 if glass:
  p.inputs['Transmission Weight'].default_value=.95;p.inputs['IOR'].default_value=1.45;p.inputs['Base Color'].default_value=(.72,.81,.86,1);m.use_backface_culling=False
 return m

def convert(code,id,filename,wheelfile,hubs,eye,transform):
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'cars'/code/filename))
 keep=[bpy.data.objects[code+'_'+part] for part in ('body','glass','interior')]
 scene=bpy.data.scenes.new('Normalized');bpy.context.window.scene=scene
 for o in keep:
  for c in list(o.users_collection):c.objects.unlink(o)
  scene.collection.objects.link(o);o.hide_render=False;o.hide_viewport=False;o.hide_set(False)
 for o in list(bpy.data.objects):
  if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
 for o in keep:
  o.animation_data_clear();o.data.transform(transform@o.matrix_world);o.matrix_world=Matrix.Identity(4);o.data.update()
 tex=SOURCE/'cars'/code/'textures'
 paint=material('Paint 1',tex/(code+'_body_red.png') if code=='SX' else None,metal=.65,rough=.28)
 paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.8
 glass=material('Glass',rough=.08,glass=True)
 interior=material('Interior',tex/(code+'_interior.png') if code=='SX' else None,rough=.72)
 exterior=material('Exterior details',tex/(code+'_exterior.png'),rough=.5) if code=='SX' else interior
 body,glazing,cabin=keep;body.data.materials.clear();body.data.materials.append(paint);glazing.data.materials.clear();glazing.data.materials.append(glass)
 # Preserve the authored material partition between exterior trim and cabin.
 oldnames=[m.name if m else '' for m in cabin.data.materials];indices=[p.material_index for p in cabin.data.polygons];cabin.data.materials.clear()
 for name in oldnames:cabin.data.materials.append(exterior if name.endswith('_exterior') else interior)
 for p,i in zip(cabin.data.polygons,indices):p.material_index=min(i,len(cabin.data.materials)-1)
 if code=='XZ':
  # Upstream specifically identifies uncertain photographic XZ atlases. Use
  # none of them, and replace the separately attributed CryHam cabin mesh.
  bpy.data.objects.remove(cabin,do_unlink=True);keep.remove(cabin)
  cabinmat=material('Original generated cabin',color=(.025,.03,.04,1),rough=.82)
  fabric=material('Seat fabric',color=(.035,.04,.045,1),rough=.95)
  trim=material('Cabin metal',color=(.2,.22,.24,1),metal=.7,rough=.35)
  red=material('Brakelight',color=(.5,.005,.003,1),rough=.2)
  rp=next(n for n in red.node_tree.nodes if n.type=='BSDF_PRINCIPLED');rp.inputs['Emission Color'].default_value=(.8,.005,.002,1);rp.inputs['Emission Strength'].default_value=.3
  def box(name,loc,size,mat,bevel=.02):
   bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
   if bevel:
    mod=o.modifiers.new('Rounded edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
   return o
  box('GeneratedFloor',(0,-.08,.1),(1.45,.08,1.85),cabinmat)
  box('GeneratedDashboard',(0,.46,-.62),(1.45,.23,.32),cabinmat,.07)
  box('GeneratedConsole',(0,.13,.06),(.24,.28,.85),cabinmat)
  for side in [-1,1]:
   x=side*.35
   box('GeneratedBucketSeatBase',(x,.10,.50),(.44,.16,.47),fabric,.05)
   seat=box('GeneratedBucketSeatBack',(x,.40,.73),(.44,.62,.13),fabric,.06);seat.rotation_euler.x=-.12
   box('GeneratedSeatHeadrest',(x,.77,.78),(.28,.18,.11),fabric,.04)
   box('GeneratedDoorPanel',(side*.74,.28,.13),(.06,.43,1.30),cabinmat)
   box('GeneratedWingPylon',(side*.58,.91,1.94),(.05,.48,.17),trim)
   # Generated curved lens strip follows the rear quarter-panel curvature.
  xs=[.32,.38,.46,.55,.65,.74];zs=[2.304,2.295,2.27,2.23,2.16,2.03];tops=[.425,.51,.54,.54,.54,.49];bottoms=[.412,.412,.385,.375,.375,.375]
  for side in [-1,1]:
   vertices=[(side*x,y,z) for x,z,top,bottom in zip(xs,zs,tops,bottoms) for y in (bottom,top)]
   faces=[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(xs)-1)]
   mesh=bpy.data.meshes.new('GeneratedCurvedTailLens');mesh.from_pydata(vertices,[],faces);mesh.materials.append(red);lamp=bpy.data.objects.new('GeneratedRearLamp',mesh);scene.collection.objects.link(lamp)
   red.use_backface_culling=False

  headlights=material('Generated headlight',color=(.65,.74,.8,1),metal=.1,rough=.15)
  for side in [-1,1]:box('GeneratedHeadlamp',(side*.64,.25,-2.10),(.40,.115,.045),headlights,.04)
  box('GeneratedFrontRadiator',(0,.04,-2.10),(1.28,.24,.04),cabinmat)
  box('GeneratedRearWing',(0,1.17,1.98),(1.90,.065,.35),trim,.015)
  for side in [-1,1]:box('GeneratedWingEndplate',(side*.95,1.16,1.98),(.035,.20,.38),trim)
  bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,location=(-.34,.56,-.16),major_radius=.145,minor_radius=.018);bpy.context.object.name='GeneratedSteeringWheel';bpy.context.object.data.materials.append(cabinmat)
  box('GeneratedSteeringHub',(-.34,.56,-.16),(.08,.08,.05),trim)
  for dx,dy in [(-.075,0),(.075,0),(0,-.075)]:box('GeneratedSteeringSpoke',(-.34+dx,.56+dy,-.16),(.13 if dx else .025,.025 if dx else .13,.025),trim,.005)
  box('GeneratedShiftLever',(0,.39,.12),(.025,.24,.025),trim,.005)
  box('GeneratedShiftKnob',(0,.52,.12),(.065,.065,.065),cabinmat,.025)
  for x in [-.47,-.29]:
   bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.065,depth=.008,location=(x,.51,-.448));o=bpy.context.object;o.name='GeneratedGauge';o.data.materials.append(trim)
 # Load authored wheel once, repeat the same mesh four times at hub pivots.
 with bpy.data.libraries.load(str(SOURCE/'cars'/code/wheelfile),link=False) as (src,dst):dst.objects=[n for n in src.objects if n in (code+'_wheel',code+'_brake')]
 wheelmat=material('Wheel alloy and tire',tex/'SX_wheel.png' if code=='SX' else None,color=(.32,.34,.36,1),metal=.55,rough=.38)
 tiremat=material('Tire rubber',color=(.018,.02,.022,1),rough=.9)
 brakepad=material('Brake caliper',color=(.45,.018,.008,1),metal=.45,rough=.35)
 prototypes=dst.objects
 for proto in prototypes:scene.collection.objects.link(proto)
 bpy.context.view_layer.update()
 radius=0
 for proto in prototypes:
  proto.data.transform(proto.matrix_world);proto.matrix_world=Matrix.Identity(4)
  proto.data.materials.clear();proto.data.materials.append(wheelmat if proto.name==code+'_wheel' else brakepad)
  for p in proto.data.polygons:p.material_index=0
  if code=='XZ' and proto.name==code+'_wheel':
   proto.data.materials.append(tiremat)
   for face in proto.data.polygons:
    if sum(math.hypot(proto.data.vertices[i].co.y,proto.data.vertices[i].co.z) for i in face.vertices)/len(face.vertices)>.27:face.material_index=1
  if proto.name==code+'_wheel':radius=max(math.hypot(v.co.y,v.co.z) for v in proto.data.vertices)
 for name,hub in zip(['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR'],hubs):
  pivot=bpy.data.objects.new(name,None);scene.collection.objects.link(pivot)
  # Blender internal coordinates are Z up; conversion to glTF Y up is baked
  # explicitly below, so export_yup=False retains the normalized coordinates.
  pivot.location=hub
  for proto in prototypes:
   o=bpy.data.objects.new(('BrakePad' if proto.name.endswith('brake') else 'WheelMesh')+name,proto.data);scene.collection.objects.link(o);o.parent=pivot
   # The wheel sources already use X as their axle. Mirror the assembly via
   # a proper rotation so the outer spoke face faces outward on both sides.
   if hub[0]>0:o.rotation_euler.z=math.pi
 for o in prototypes:bpy.data.objects.remove(o,do_unlink=True)
 for o in scene.objects:
  if o.type=='MESH':
   o.data.calc_loop_triangles()
   for p in o.data.polygons:p.use_smooth=True
 bpy.context.view_layer.update()
 bounds=[o.matrix_world@v.co for o in scene.objects if o.type=='MESH' and not o.parent for v in o.data.vertices]
 lo=[min(v[i] for v in bounds) for i in range(3)];hi=[max(v[i] for v in bounds) for i in range(3)]
 # Blender glTF's exporter will leave the coordinates unchanged with yup=False.
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',export_yup=False,export_cameras=False,export_lights=False,export_extras=True,export_animations=False,use_active_scene=True)
 # Remote cars retain the same hubs/materials and detailed silhouette with
 # a reduced cabin/body/wheel triangle budget. Only main assets show cockpit.
 remote_mods=[]
 for o in scene.objects:
  if o.type=='MESH' and len(o.data.polygons)>200:
   mod=o.modifiers.new('Remote simplification','DECIMATE');mod.ratio=.25 if code=='SX' else .60;remote_mods.append((o,mod))
 bpy.context.view_layer.update()
 dg=bpy.context.evaluated_depsgraph_get();remote_triangles=0
 for o in scene.objects:
  if o.type=='MESH':
   evaluated=o.evaluated_get(dg);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();remote_triangles+=len(mesh.loop_triangles);evaluated.to_mesh_clear()
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'-remote.glb')),export_format='GLB',export_yup=False,export_apply=True,export_cameras=False,export_lights=False,export_animations=False,use_active_scene=True)
 for o,mod in remote_mods:o.modifiers.remove(mod)
 dims={'coordinateSystem':'+x right, +y up, -z forward; meters; authored chassis/COM origin','bodyBounds':{'min':lo,'max':hi},'bodyDimensions':[hi[i]-lo[i] for i in range(3)],'wheelOrder':['FL','FR','RL','RR'],'wheelHubs':hubs,'wheelRadius':round(radius,6),'wheelbase':hubs[2][2]-hubs[0][2],'frontTrack':hubs[1][0]-hubs[0][0],'rearTrack':hubs[3][0]-hubs[2][0],'cockpitEye':eye,'remoteTriangles':remote_triangles,'triangles':sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH'),'notes':'Origin follows authored chassis frame, an approximate COM rather than a manufacturer measurement. Wheel centers follow the upstream model fit; handling is calibrated separately.'}
 (OUT/(id+'-dimensions.json')).write_text(json.dumps(dims,indent=2)+'\n')
 # A renderable copy in conventional Blender axes for repeatable visual review.
 for o in list(scene.objects):
  if not o.parent:o.matrix_world=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))@o.matrix_world
 scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=False;scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.5,.5,1)
 camdat=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camdat);scene.collection.objects.link(cam);cam.location=(5,-7,3);cam.rotation_euler=((Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler());camdat.type='ORTHO';camdat.ortho_scale=6;scene.camera=cam
 lightdat=bpy.data.lights.new('Softbox','AREA');lightdat.energy=1600;lightdat.shape='DISK';lightdat.size=7;light=bpy.data.objects.new('Softbox',lightdat);scene.collection.objects.link(light);light.location=(2,-3,6)
 scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath='/tmp/'+id+'-review.png';bpy.ops.render.render(write_still=True)

convert('SX','brz','sx.blend','wheel.blend',[[-.79,-.07,-1.275],[.79,-.07,-1.275],[-.82,-.05,1.275],[.82,-.05,1.275]],[-.32,.78,.22],Matrix(((0,-1,0,0),(0,0,-1,.35),(1,0,0,0),(0,0,0,1))))
convert('XZ','m3','bmw_m3_gt3.blend','bmw_m3_gt3_wheel.blend',[[-.80,-.075,-1.345],[.80,-.075,-1.345],[-.80,-.065,1.345],[.80,-.065,1.345]],[-.34,.73,.375],Matrix(((0,1,0,0),(0,0,1,.495),(1,0,0,.195),(0,0,0,1))))
