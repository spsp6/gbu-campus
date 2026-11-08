import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAMPUS } from './campus-layout.js';

// Model-relative reconstruction. Geometry is purposefully independent of collision.
// IMG_5355 / IMG_5354 set adjacency; the photograph set sets the facade vocabulary.
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const provenance = 'Procedural reconstruction from IMG_5355 / IMG_5354 model views and campus photographs. Compressed relative dimensions; not a measured survey. Traversable rooms and story props are adaptations.';
const copy = value => JSON.parse(JSON.stringify(value));
const random = seed => () => {seed = (Math.imul(seed,1664525)+1013904223) >>> 0;return seed/4294967296;};

export function build(scene, renderer, {night = false, onProgress = () => {}} = {}) {
  const root = new THREE.Group(); root.name = 'GBU · model and photograph reconstruction'; scene.add(root);
  const rng = random(5355), batches = new Map(), colliders = [], memories = new Map(), flags = [], trackBeacons=[];
  const m = {};
  const material = (name, color, options={}) => (m[name] = new THREE.MeshStandardMaterial({name, color, roughness:.76, ...options}));
  material('porcelain',0xeeeae0,{roughness:.6,emissive:night?0x25313d:0x000000,emissiveIntensity:night?.2:0});
  material('whiteTrim',0xf5f5ed,{roughness:.48,metalness:.08});
  material('joint',0x77847f); material('concrete',0xb0b4aa); material('paving',0xc2c5bb);
  material('pavingLight',0xd6d7c9); material('asphalt',0x414d4b); material('stone',0x535c54);
  material('glass',night?0x263d47:0x52747f,{metalness:.3,roughness:.19,emissive:night?0x172a33:0x000000,emissiveIntensity:.38});
  material('litGlass',night?0xa4a58a:0x71939d,{roughness:.28,emissive:night?0xadb890:0x000000,emissiveIntensity:night?.46:0});
  material('darkFrame',0x354442,{metalness:.3,roughness:.38}); material('orange',0xb96536,{roughness:.76});
  material('lawn',0x688157); material('hill',0x67804b); material('leafDark',0x354f37,{roughness:.95});
  material('leaf',0x52754b,{roughness:.96}); material('leafLight',0x779264,{roughness:.96});
  material('bark',0x716854); material('wood',0xb38e5f); material('track',0x428fac,{roughness:.92});
  material('court',0x589a83); material('line',0xe1e4cf); material('soil',0x444b36);
  material('water',night?0x173844:0x3f7b86,{roughness:.15,metalness:.32,emissive:night?0x0e2530:0x000000,emissiveIntensity:.18});
  material('warmLight',0xf1ddb0,{emissive:0xffdda0,emissiveIntensity:night?1.1:.05});
  material('blueSign',0x154c82,{roughness:.65});
  const dynamicSignal = new THREE.MeshBasicMaterial({name:'Memory signal',color:0xb4e7df});
  const animatedTime = {value:0};
  let leafSprays=[m.leafDark,m.leaf,m.leafLight];
  if(typeof document!=='undefined'){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),leafRng=random(1204);
    // Transparent branching sprays have a broken leaf silhouette at walking distance.
    for(let branch=0;branch<10;branch++){
      const angle=branch*2.4,r=38+leafRng()*45,cx=128+Math.cos(angle)*r,cy=128+Math.sin(angle)*r;
      ctx.strokeStyle='#bbbda6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(128,232);ctx.quadraticCurveTo(125,155,cx,cy);ctx.stroke();
      for(let i=0;i<14;i++){const a=leafRng()*TAU,rr=Math.sqrt(leafRng())*37,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
        ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=['#e4eac9','#b5c49a','#d0deb3'][i%3];ctx.beginPath();ctx.ellipse(0,0,6+leafRng()*5,2.5+leafRng()*2,0,0,TAU);ctx.fill();ctx.restore();}
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;
    leafSprays=[0x719158,0x89a669,0xa1b681].map((color,i)=>new THREE.MeshStandardMaterial({name:'Cutout leaf sprays '+i,color,map:t,alphaTest:.42,side:THREE.DoubleSide,roughness:.96}));
  }
  // A small locally authored sky reflection map gives glass/water a highlight without
  // transmission or a second scene render. This is ambience, not a captured campus HDR.
  if(typeof document!=='undefined'&&renderer?.isWebGLRenderer&&!scene.environment){
    const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128);
    gradient.addColorStop(0,night?'#182c4b':'#87b5d3');gradient.addColorStop(.48,night?'#496074':'#d2e1e0');gradient.addColorStop(.52,night?'#293d3c':'#779477');gradient.addColorStop(1,night?'#152729':'#4c6453');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,128);
    ctx.fillStyle=night?'#adbacb':'#f6f2d7';ctx.fillRect(165,38,4,4);
    const sky=new THREE.CanvasTexture(c);sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(sky);scene.environment=env.texture;scene.environmentIntensity=night?.24:.48;sky.dispose();pmrem.dispose();
    root.userData.environmentTarget=env;
  }
  m.water.onBeforeCompile=shader=>{
    shader.uniforms.uCampusTime=animatedTime;
    shader.vertexShader='varying vec2 vCampusWater;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCampusWater = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader='uniform float uCampusTime;\nvarying vec2 vCampusWater;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal = normalize(normal + vec3(sin(vCampusWater.x * .42 + uCampusTime * .8) * .021, cos(vCampusWater.y * .51 + uCampusTime * .65) * .018, 0.0));');
  };
  m.water.customProgramCacheKey=()=> 'gbu-campus-water-r180-v1';

  function batch(g, mat, matrix = new THREE.Matrix4()) {
    let geometry = g.index ? g.toNonIndexed() : g.clone(); geometry.applyMatrix4(matrix);
    for (const attr of Object.keys(geometry.attributes)) if (!['position','normal','uv'].includes(attr)) geometry.deleteAttribute(attr);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    if (!batches.has(mat.uuid)) batches.set(mat.uuid,{material:mat,list:[]});
    batches.get(mat.uuid).list.push(geometry); g.dispose();
  }
  function mesh(g,mat,p=[0,0,0],r=[0,0,0],s=[1,1,1]) {
    const o=new THREE.Object3D();o.position.set(...p);o.rotation.set(...r);o.scale.set(...s);o.updateMatrix();batch(g,mat,o.matrix);
  }
  function box(x,y,z,w,h,d,mat,ry=0,rz=0) {mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],[0,ry,rz]);}
  function beam(a,b,r,mat,r2=r,n=6) {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av),o=new THREE.Object3D();
    o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(UP,dir.clone().normalize());o.updateMatrix();
    batch(new THREE.CylinderGeometry(r2,r,dir.length(),n),mat,o.matrix);
  }
  function obstacle(x,z,w,d,id='solid') {colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,id});}
  function strip(a,b,width,mat,y=.018) {const dx=b[0]-a[0],dz=b[1]-a[1];box((a[0]+b[0])/2,y,(a[1]+b[1])/2,width,.025,Math.hypot(dx,dz),mat,Math.atan2(dx,dz));}
  function curve(points,r,mat) {mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(16,points.length*3),r,5,false),mat);}
  function ellipse(x,z,rx,rz,mat,y=.01) {mesh(new THREE.CircleGeometry(1,80),mat,[x,y,z],[-Math.PI/2,0,0],[rx,rz,1]);}
  function ellipseCollider(x,z,rx,rz,id) {for(let dz=-rz;dz<rz;dz+=1.2){const half=rx*Math.sqrt(Math.max(0,1-Math.pow((dz+.6)/rz,2)));if(half>.1)obstacle(x,z+dz+.6,half*2,1.2,id);}}
  function blocked(x,z,r=.6) {return colliders.some(b=>x>b.minX-r&&x<b.maxX+r&&z>b.minZ-r&&z<b.maxZ+r);}
  function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
  function nearRoute(x,z,r=2.8){return (Math.abs(x-CAMPUS.track.x)<17&&Math.abs(z-CAMPUS.track.z)<16)||CAMPUS.paths.some(p=>p.some((a,i)=>i&&segmentDistance(x,z,p[i-1],a)<r))||CAMPUS.stations.some(s=>Math.hypot(x-s.position.x,z-s.position.z)<r+1)||CAMPUS.safeZones.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+1);}
  const signRows=['GREAT BAY UNIVERSITY','WATER COURT','WEST TEACHING BLOCK','SPORTS HALL','DORMITORY ARCADE','CAMPUS WALK','GBU','1','2','3','4'];
  let atlas=null;
  if(typeof document!=='undefined') {
    const c=document.createElement('canvas');c.width=1024;c.height=signRows.length*128;const ctx=c.getContext('2d');
    ctx.fillStyle='#1d4260';ctx.fillRect(0,0,c.width,c.height);ctx.textAlign='center';ctx.textBaseline='middle';
    signRows.forEach((s,i)=>{ctx.fillStyle='#f0eee0';ctx.font=i>=7?'600 108px Arial':'600 48px Arial';ctx.fillText(s,512,i*128+64,940);});
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);
    atlas=new THREE.MeshStandardMaterial({name:'Wayfinding atlas',map:t,roughness:.8,emissive:night?0x526a76:0x000000,emissiveIntensity:night?.3:0});
  }
  function sign(row,x,y,z,w=6,h=.75,rotation=0) {
    box(x,y,z-.065,w+.12,h+.12,.10,m.darkFrame,rotation);
    if(!atlas)return;const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,(signRows.length-1-row+uv.getY(i))/signRows.length);
    mesh(g,atlas,[x,y,z],[0,rotation,0]);
  }
  function windowGrid(x,z,w,h,bottom=0,depth=.12,spacing=2.4) {
    box(x,bottom+h/2,z,w,h,depth,m.glass);
    for(let xx=x-w/2;xx<=x+w/2+.01;xx+=spacing)box(xx,bottom+h/2,z+.09,.075,h,.075,m.darkFrame);
    for(let yy=bottom;yy<=bottom+h;yy+=2.7)box(x,yy,z+.1,w,.075,.07,m.darkFrame);
  }
  function parapet(x,z,w,d,y){box(x,y,z-d/2,w,.6,.2,m.porcelain);box(x,y,z+d/2,w,.6,.2,m.porcelain);for(const s of [-1,1])box(x+s*w/2,y,z,.2,.6,d,m.porcelain);}

  onProgress('Tracing the model paths',.08);
  box(0,-.17,0,316,.32,145,m.lawn);
  // A continuous ground plane keeps all gameplay at y=0; landscape rises only off the routes.
  box(0,-.008,57.8,296,.02,8,m.asphalt);box(-140,-.009,0,6,.02,120,m.asphalt);
  for(let x=-136;x<142;x+=9)box(x,.009,58,4.3,.018,.14,m.line);
  for(const route of CAMPUS.paths)for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i];strip(a,b,5.4,m.paving);const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
    for(let t=1;t<len;t+=2.7){const x=a[0]+dx*t,z=a[1]+dz*t;strip([x-dz*2.65,z+dx*2.65],[x+dz*2.65,z-dx*2.65],.025,m.joint,.036);}
    for(const s of [-1,1])strip([a[0]+dz*2.7*s,a[1]-dx*2.7*s],[b[0]+dz*2.7*s,b[1]-dx*2.7*s],.14,m.pavingLight,.025);
  }
  box(37,.025,39,31,.035,27,m.pavingLight);
  for(let z=28;z<51;z+=3)box(37,.048,z,30,.012,.035,m.joint);
  for(let x=23;x<53;x+=3)box(x,.049,39,.035,.012,26,m.joint);
  // Entry monument does not obstruct the central start/exit lane.
  box(24,.72,51.8,15,1.4,.9,m.porcelain);sign(0,24,.95,52.28,13,.58);
  for(const x of [27,30.4,33.8]){
    beam([x,0,31],[x,11.5,31],.055,m.whiteTrim,.035,8);box(x,.15,31,.8,.28,.8,m.concrete);
    const g=new THREE.PlaneGeometry(2.3,1.45,12,3),fm=new THREE.MeshStandardMaterial({color:x===30.4?0xd44539:0xe5e4d8,side:THREE.DoubleSide,roughness:.9});
    const flag=new THREE.Mesh(g,fm);flag.position.set(x+1.15,10.55,31);root.add(flag);flags.push({mesh:flag,original:Float32Array.from(g.attributes.position.array)});
    obstacle(x,31,.2,.2,'flagpole');
  }
  // Rectangular lawn terraces and a palm axis reproduce the flag court beside the ribbon tip.
  for(let i=0;i<5;i++){box(25,.02,-10+i*6.1,14,.04,4.9,m.lawn);box(25,.05,-12.6+i*6.1,14,.10,.30,m.pavingLight);}

  onProgress('Forming the curved ribbon and water court',.22);
  const cx=-21,cz=-9,start=-.72,end=3.64,steps=112;
  const rp=(t,inner=false,y=0)=>[cx+(inner?31.1:39.3)*Math.cos(t),y,cz-(inner?22.6:30.1)*Math.sin(t)];
  function arcBand(rInner,rOuter,yLow,yHigh,mat,t0=start,t1=end,n=steps){
    const vertices=[];const point=(t,r,y)=>[cx+(31.1+8.2*r)*Math.cos(t),typeof y==='function'?y(t):y,cz-(22.6+7.5*r)*Math.sin(t)];
    function quad(a,b,c,d){vertices.push(...a,...b,...d,...b,...c,...d);}
    for(let i=0;i<n;i++){const a=t0+(t1-t0)*i/n,b=t0+(t1-t0)*(i+1)/n;
      quad(point(a,rOuter,yLow),point(b,rOuter,yLow),point(b,rOuter,yHigh),point(a,rOuter,yHigh));
      quad(point(b,rInner,yLow),point(a,rInner,yLow),point(a,rInner,yHigh),point(b,rInner,yHigh));
      quad(point(a,rInner,yHigh),point(a,rOuter,yHigh),point(b,rOuter,yHigh),point(b,rInner,yHigh));
      quad(point(b,rInner,yLow),point(b,rOuter,yLow),point(a,rOuter,yLow),point(a,rInner,yLow));
    }
    for(const t of [t0,t1])quad(point(t,rInner,yLow),point(t,rOuter,yLow),point(t,rOuter,yHigh),point(t,rInner,yHigh));
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();batch(g,mat);
  }
  const top=t=>11.8+2.1*Math.cos(t*.85+.35), ribbon=t=>3.0+3.0*(.5+.5*Math.sin(t*1.65-.7));
  arcBand(.035,.96,.15,top,m.glass);arcBand(-.015,1.035,t=>top(t)-3.35,t=>top(t)+.32,m.porcelain);
  arcBand(-.005,1.025,t=>ribbon(t)-1.15,t=>ribbon(t)+.22,m.porcelain);
  arcBand(.01,1.03,.10,.55,m.porcelain);
  for(let row=0;row<7;row++)arcBand(-.025,1.055,t=>top(t)-3.65-row*.65,t=>top(t)-3.55-row*.65,m.whiteTrim);
  // Genuine horizontal cladding joints follow the curved crown rather than a cuboid proxy.
  for(let j=0;j<5;j++)arcBand(-.016,1.038,t=>top(t)-j*.66,t=>top(t)-j*.66+.025,m.joint);
  for(let i=0;i<=steps;i+=2){const t=start+(end-start)*i/steps;for(const inner of [true,false]){const p=rp(t,inner),height=top(t)-3.4;box(p[0],height/2,p[2],.07,height,.10,m.darkFrame,-t);}}
  // Short segment AABBs follow the occupied ring; they do not fill its open courtyard.
  for(let i=0;i<76;i++){const t=start+(end-start)*(i+.5)/76,pa=rp(t),pb=rp(t,true),x=(pa[0]+pb[0])/2,z=(pa[2]+pb[2])/2;
    obstacle(x,z,Math.abs(pa[0]-pb[0])+2.5,Math.abs(pa[2]-pb[2])+2.2,'crescent-shell');}
  // Lake is narrow along the front lip; the memory is reached from the front promenade.
  ellipse(-19,3.5,27.4,10.2,m.stone,.015);ellipse(-19,3.5,26.7,9.65,m.water,.07);
  ellipseCollider(-19,3.5,27.1,10,'water');
  const waterEdge=[];for(let i=0;i<=100;i++){const a=i/100*TAU;waterEdge.push([-19+Math.cos(a)*27.2,.15,3.5+Math.sin(a)*10.0]);}curve(waterEdge,.09,m.pavingLight);
  const islandX=-25,islandZ=-12,rx=22,rz=18;
  const hill=new THREE.SphereGeometry(1,48,18,0,TAU,0,Math.PI/2);mesh(hill,m.hill,[islandX,.02,islandZ],[0,0,0],[rx,3.1,rz]);ellipseCollider(islandX,islandZ,rx,rz,'landscaped-hill');
  function hillY(x,z){return .05+3.1*Math.sqrt(Math.max(0,1-((x-islandX)/rx)**2-((z-islandZ)/rz)**2));}
  // Visible contour seating and meandering path on the planted, non-playable hill.
  for(let row=0;row<4;row++){const z=1-row*3.3;for(const [x,w] of [[-39,9],[-23,10],[-9,6]]){const yy=hillY(x,z);box(x,yy+.04,z,w,.19,.45,m.pavingLight);}}
  const hp=[];for(let i=0;i<=34;i++){const z=-27+i*.82,x=-25+7*Math.sin(i*.16);hp.push([x,hillY(x,z)+.045,z]);}
  for(let i=1;i<hp.length;i++){const a=hp[i-1],b=hp[i];beam(a,b,.55,m.paving,.55,4);}
  ellipse(-20,17,4.0,3.1,m.pavingLight,.03);box(-20,.047,17,1,.015,6,m.pavingLight);
  sign(1,-25,1.15,18.9,4,.60);beam([-25,0,18.82],[-25,1.25,18.82],.06,m.darkFrame);

  onProgress('Opening teaching undercrofts and glass bridges',.40);
  function teaching(x,z,w,d,h,{open=false,stepped=false}={}){
    const front=z+d/2,back=z-d/2;
    box(x,.02,z,w,.035,d,m.pavingLight);
    if(open){
      box(x,2.4,back,w,4.8,.35,m.porcelain);obstacle(x,back,w,.5,'teaching-back');
      for(const s of [-1,1]){box(x+s*w/2,2.4,z,.32,4.8,d,m.porcelain);obstacle(x+s*w/2,z,.48,d,'teaching-side');}
      windowGrid(x,back+.2,w-2,3.5,.3);
    }else{box(x,2.4,z,w,4.8,d,m.glass);obstacle(x,z,w,d,'academic');}
    // Piers carry the elevated louvered volume and leave the central entry open.
    for(let dx=-w/2+1;dx<w/2;dx+=4.9){if(open&&Math.abs(dx)<3.2)continue;box(x+dx,2.8,front-.6,.55,5.6,.7,m.porcelain);if(open)obstacle(x+dx,front-.6,.65,.8,'teaching-pier');}
    box(x,(h+5.7)/2,z,w,h-5.7,d,m.glass);
    for(let y=5.65;y<h+.1;y+=.78){box(x,y,front+.32,w+.7,.19,.60,m.porcelain);box(x,y,back-.3,w+.7,.19,.56,m.porcelain);for(const s of [-1,1])box(x+s*(w/2+.30),y,z,.58,.19,d,m.porcelain);}
    for(let dx=-w/2+.4;dx<w/2;dx+=2.7)box(x+dx,(h+5.7)/2,front+.10,.075,h-5.5,.085,m.darkFrame);
    box(x,h+.22,z,w+.9,.5,d+.9,m.porcelain);parapet(x,z,w,d,h+.75);
    if(stepped){box(x-3,h+2.8,z-2,w*.61,4.7,d*.54,m.porcelain);windowGrid(x-3,z+d*.27-2+.05,w*.56,2.2,h+2);parapet(x-3,z-2,w*.61,d*.54,h+5.35);}
    return {front,back};
  }
  teaching(-77,1,37,24,13,{open:true});sign(2,-77,5.02,13.48,12,.75);
  // Interior learning gallery: open central axis, desks placed against the side walls.
  for(const side of [-1,1])for(const z of [-4,2,8]){
    const x=-77+side*13;box(x,.82,z,5,.14,1.1,m.wood);for(const dx of [-2,2])box(x+dx,.38,z,.075,.8,.65,m.darkFrame);
    box(x,1.65,z-.3,3.4,.50,.08,m.blueSign);obstacle(x,z,5,1.2,'gallery-table');
  }
  for(const x of [-89,-65])box(x,4.58,1,.1,.1,17,m.warmLight);
  teaching(69,4,33,29,15,{stepped:true});sign(5,69,4.0,18.6,12,.8);
  // Long rear block stays open below its upper floor, including the west route endpoint.
  box(43,6.8,-41,74,5.2,13,m.glass);box(43,4.10,-41,75,.42,14,m.porcelain);box(43,9.7,-41,75,.6,14,m.porcelain);
  for(let y=4.5;y<=9.4;y+=.85){box(43,y,-34.2,75,.18,.45,m.porcelain);box(43,y,-47.8,75,.18,.45,m.porcelain);}
  for(let x=8;x<80;x+=5.3)for(const z of [-35.8,-46.2]){box(x,2.1,z,.55,4.2,.55,m.porcelain);obstacle(x,z,.65,.65,'arcade-pier');}
  box(43,.02,-41,74,.04,13,m.pavingLight);
  // Glass pedestrian bridge to the east teaching block: all roadway clearance is below 5.3 m.
  box(65,5.5,-25,7,.5,22,m.porcelain);box(65,8.7,-25,7,.40,22,m.porcelain);
  for(const x of [61.6,68.4]){box(x,7.1,-25,.13,2.9,22,m.glass);for(let z=-35;z<-14;z+=2)box(x,7.05,z,.17,3,.1,m.porcelain);}
  // A transverse glass link carries the characteristic welcome-band elevation.
  box(-51,7.35,-9,14,3,4.8,m.glass);box(-51,5.7,-9,14,.4,5.2,m.porcelain);box(-51,9,-9,14,.3,5.2,m.porcelain);
  for(let x=-58;x<-44;x+=1.8)box(x,7.4,-6.52,.10,2.8,.13,m.porcelain);

  onProgress('Raising the stepped tower and balcony blocks',.57);
  // The left model landmark has a substantial stepped podium and a setback upper slab.
  const tx=-119,tz=11;
  for(const [y,w,d,h,dx,dz] of [[1.5,26,23,3,0,0],[7,23,20,8,0,-.2],[16,20,17,10,-1,-1.5],[30,16,14,18,-2,-2.5]]){
    box(tx+dx,y,tz+dz,w,h,d,m.glass);box(tx+dx,y-h/2,tz+dz,w+.8,.50,d+.8,m.porcelain);box(tx+dx,y+h/2,tz+dz,w+.7,.5,d+.7,m.porcelain);
    for(let x=tx+dx-w/2;x<=tx+dx+w/2;x+=1.05)box(x,y,tz+dz+d/2+.10,.24,h,.32,m.porcelain);
    for(let yy=y-h/2;yy<=y+h/2;yy+=2.3)box(tx+dx,yy,tz+dz+d/2+.23,w,.18,.18,m.concrete);
    for(const side of [-1,1]){for(let z=tz+dz-d/2;z<=tz+dz+d/2;z+=1.05)box(tx+dx+side*(w/2+.1),y,z,.32,h,.24,m.porcelain);for(let yy=y-h/2;yy<=y+h/2;yy+=2.3)box(tx+dx+side*(w/2+.22),yy,tz+dz,.18,.18,d,m.concrete);}
  }
  obstacle(tx,tz,26,23,'stepped-tower');parapet(tx-2,tz-2.5,16,14,39.4);
  for(const x of [-127,-117]){box(x,40.7,7,3.2,2,3.2,m.darkFrame);box(x,41.8,7,3.5,.2,3.5,m.porcelain);}
  function balconyTower(x,z,w,d,h){
    box(x,h/2,z,w,h,d,m.glass);obstacle(x,z,w+1.5,d+1.5,'balcony-tower');
    for(const side of [-1,1])box(x+side*(w/2-.4),h/2,z,1.15,h+.8,d+.35,m.porcelain);
    for(let y=2.2;y<h;y+=2.30){box(x,y,z+d/2+.65,w,.2,1.8,m.porcelain);box(x,y+.77,z+d/2+1.45,w,.70,.11,m.joint);box(x,y+1.15,z+d/2+1.48,w,.07,.09,m.whiteTrim);for(let dx=-w/2+.6;dx<w/2;dx+=2.6)box(x+dx,y+1.03,z+d/2+1.40,.07,1.75,.1,m.darkFrame);}
    for(let y=2;y<h;y+=2.30)box(x,y,z-d/2-.05,w,.27,.12,m.porcelain);
    box(x,h+.55,z,w+1.1,1.1,d+1.1,m.porcelain);parapet(x,z,w,d,h+1.45);
    box(x,h+1,z,w*.58,1.1,d*.48,m.darkFrame);
  }
  balconyTower(-128,-29,9,15,48);balconyTower(-114,-32,9,15,45);
  // Orange recesses are actual empty front bays behind a white structural grid.
  function dorm(x,z,h){
    const w=18,d=13,base=3.8,levels=10,fh=(h-base)/levels;
    box(x,(h+base)/2,z-.7,w,h-base,d-1.4,m.glass);obstacle(x,z-1.2,w,d-2.4,'dormitory');
    box(x,base,z,w+.4,.5,d+.7,m.porcelain);box(x,h,z,w+.6,.6,d+.9,m.porcelain);
    for(let dx=-9;dx<=9;dx+=3)box(x+dx,(h+base)/2,z+d/2+.16,.40,h-base,1.1,m.porcelain);
    for(let floor=0;floor<levels;floor++){
      const y=base+floor*fh;box(x,y,z+d/2+.25,w,.26,1.30,m.porcelain);
      for(let col=0;col<6;col++){
        const xx=x-7.5+col*3,isOrange=(col===3&&floor>=4)||(floor===2&&col<3);
        if(isOrange){box(xx,y+fh/2,z+d/2-.55,2.55,fh-.32,.12,m.orange);box(xx,y+.18,z+d/2-.04,2.58,.10,1.30,m.orange);}
        else {box(xx,y+.85,z+d/2+.77,2.58,.74,.12,m.joint);for(const off of [.53,.79,1.05])box(xx,y+off,z+d/2+.86,2.6,.045,.05,m.darkFrame);}
        if(night&&!isOrange&&(floor*7+col*5+x)%9<2)box(xx,y+fh*.66,z+d/2-.12,1.5,.74,.07,m.litGlass);
      }
    }
    for(const dx of [-8,-3,3,8]){box(x+dx,1.75,z+d/2-1,.40,3.5,.6,m.porcelain);obstacle(x+dx,z+d/2-1,.5,.7,'dorm-pier');}
    parapet(x,z,w,d,h+.75);box(x-3,h+1.4,z-1,6,1.4,5,m.porcelain);
  }
  dorm(81,-35.9,28);dorm(104,-35.9,31);dorm(127,-35.9,28.5);
  sign(4,103,3.1,-27.2,9,.72);

  onProgress('Marking the sports hall and blue track',.73);
  // Open front hall, tall sawtooth piers and internal badminton courts from IMG_5200 / 4037.
  const gx=107,gz=6,gw=28,gd=26;
  box(gx,.016,gz,gw,.028,gd,m.pavingLight);box(gx,.045,gz,23,.032,20,m.court);
  box(gx,5.5,gz-gd/2,gw,11,.45,m.porcelain);obstacle(gx,gz-gd/2,gw,.6,'sports-back');
  for(let x=95;x<=119;x+=3){box(x,6.4,-6.66,.24,8.8,.38,m.concrete);for(let y=2.8;y<=10;y+=1.4)box(x+1.4,y,-6.73,2.6,.025,.02,m.joint);}
  box(gx,4.3,-6.61,27,.68,.12,m.blueSign);sign(6,gx,7.15,-6.20,4.8,1.4);
  for(const s of [-1,1]){box(gx+s*gw/2,5.5,gz,.4,11,gd,m.porcelain);obstacle(gx+s*gw/2,gz,.55,gd,'sports-side');}
  for(let x=gx-12;x<=gx+12;x+=3){box(x,7.6,gz+gd/2+.15,.37,5.7,1.0,m.porcelain,.18);box(x+1.25,7.6,gz+gd/2-.42,2.1,5.4,.12,m.glass);}
  box(gx,4.6,gz+gd/2,gw+.5,.80,1.3,m.porcelain);box(gx,10.9,gz+gd/2,gw+.5,.8,1.2,m.porcelain);
  // Center opening is wider than the approach; front glass is confined to its wings.
  for(const side of [-1,1]){const x=gx+side*10;box(x,2,gz+gd/2,7.5,4,.16,m.glass);obstacle(x,gz+gd/2,7.6,.3,'sports-front-wing');}
  sign(3,gx,4.64,gz+gd/2+.71,11,.62);
  for(let i=0;i<7;i++){
    const x=gx-12+i*4;box(x,11.7,gz,4.25,.16,26,m.porcelain,0,-.22);box(x+1.94,11.37,gz,.16,1.0,26,m.glass);
    beam([x-1.8,10.6,gz-12],[x+1.8,10.6,gz+12],.055,m.darkFrame);beam([x-1.8,10.6,gz+12],[x+1.8,10.6,gz-12],.055,m.darkFrame);
  }
  for(const x of [100,114]){
    for(const z of [-1,12])box(x,.067,z,5.8,.018,.075,m.line);
    for(const dx of [-2.9,2.9])box(x+dx,.067,5.5,.075,.018,13,m.line);
    box(x,.067,5.5,5.8,.018,.065,m.line);box(x,.067,8.8,.05,.018,6.4,m.line);
    // Nets remain on outer courts, clear of the centre route and the memory.
    for(const dx of [-3,3])beam([x+dx,0,5.5],[x+dx,1.5,5.5],.028,m.darkFrame);
    box(x,1.48,5.5,6,.06,.05,m.whiteTrim);for(let i=0;i<12;i++)box(x-2.8+i*.5,1.15,5.5,.02,.62,.022,m.darkFrame);
  }
  for(let row=0;row<3;row++)for(let i=0;i<15;i++){box(96+i*1.5,.3+row*.32,-4.8-row*.7,1.05,.18,.55,row%2?m.orange:m.wood);}
  // Blue athletics loop is a full-width track with continuous white lane boundaries.
  const tr=CAMPUS.track;ellipse(tr.x,tr.z,14.3,13.4,m.track,.03);ellipse(tr.x,tr.z,8.4,7.4,m.court,.047);
  for(let lane=0;lane<5;lane++){
    const points=[];for(let i=0;i<=96;i++){const a=i/96*TAU;points.push([tr.x+Math.cos(a)*(9.1+lane*1.13),.065,tr.z+Math.sin(a)*(8.1+lane*1.13)]);}curve(points,.035,m.line);
  }
  box(126,.063,42,13.8,.02,11.5,m.court);for(const x of [119.1,132.9])box(x,.082,42,.06,.014,11.5,m.line);for(const z of [36.25,47.75])box(126,.082,z,13.8,.014,.06,m.line);
  box(126,.086,42,13.8,.016,.065,m.line);const centre=[];for(let i=0;i<=48;i++){const a=i/48*TAU;centre.push([126+Math.cos(a)*2,.10,42+Math.sin(a)*2]);}curve(centre,.035,m.line);
  for(const z of [36.25,47.75]){
    const dir=z<42?-1:1;for(const x of [124,128]){beam([x,0,z],[x,1.6,z],.055,m.whiteTrim);beam([x,1.6,z],[x,1.1,z+dir*1.1],.035,m.whiteTrim);beam([x,0,z+dir*1.1],[x,1.1,z+dir*1.1],.035,m.whiteTrim);}
    beam([124,1.6,z],[128,1.6,z],.055,m.whiteTrim);beam([124,1.1,z+dir*1.1],[128,1.1,z+dir*1.1],.025,m.line);
    for(let x=124.25;x<128;x+=.32)beam([x,.1,z+dir*1.1],[x,1.1,z+dir*1.1],.011,m.line, .011,4);
    for(let y=.15;y<1.1;y+=.24)beam([124,y,z+dir*1.1],[128,y,z+dir*1.1],.011,m.line,.011,4);
    box(126,.086,z-dir*1.25,6.3,.015,.06,m.line);for(const x of [122.85,129.15])box(x,.086,z-dir*.625,.06,.015,1.25,m.line);
  }
  for(const p of tr.checkpoints)ellipse(p.x,p.z,.40,.40,m.line,.084);
  for(const [i,p] of tr.checkpoints.entries()){
    const group=new THREE.Group();group.position.set(p.x,1.65,p.z);group.name='Track checkpoint '+(i+1);root.add(group);
    const mat=new THREE.MeshBasicMaterial({color:0x66c5f1,transparent:true,opacity:.72});
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.66,.055,6,36),mat);group.add(halo);
    if(atlas){const g=new THREE.PlaneGeometry(.75,.75),uv=g.attributes.uv;for(let n=0;n<uv.count;n++){uv.setY(n,(signRows.length-8-i+uv.getY(n))/signRows.length);uv.setX(n,.43+uv.getX(n)*.14);}const number=new THREE.Mesh(g,atlas);group.add(number);}
    const floor=new THREE.Mesh(new THREE.RingGeometry(.88,1.12,32),mat);floor.rotation.x=-Math.PI/2;floor.position.y=-1.56;group.add(floor);
    trackBeacons.push({group,mat,halo,index:i});
  }

  onProgress('Planting palms and the central hill',.86);
  function tree(x,z,h=7,base=0){
    beam([x,base,z],[x+.17,base+h*.72,z-.12],.17,m.bark,.07,7);
    for(let i=0;i<9;i++){
      const a=i*2.4,rr=.6+rng()*1.3,yy=base+h*(.57+rng()*.32),xx=x+Math.cos(a)*rr,zz=z+Math.sin(a)*rr;
      beam([x,base+h*.43,z],[xx,yy,zz],.055,m.bark,.02,5);
      for(let j=0;j<6;j++)mesh(new THREE.PlaneGeometry(1,1),leafSprays[i%3],[xx+(rng()-.5)*1.5,yy+(rng()-.5)*1.3,zz+(rng()-.5)*1.5],[(rng()-.5)*1.6,rng()*TAU,(rng()-.5)*.8],[1.65+rng()*.6,1.75+rng()*.6,1]);
    }
    if(base<.1)obstacle(x,z,.55,.55,'tree-trunk');
  }
  function palm(x,z,h=9){
    beam([x,0,z],[x+.25,h,z],.20,m.bark,.10,8);
    for(let i=0;i<12;i++)box(x,h*(i/12),z,.38,.025,.38,m.joint);
    for(let fr=0;fr<9;fr++){
      const a=fr/9*TAU,dx=Math.cos(a),dz=Math.sin(a),pts=[];
      for(let k=0;k<=8;k++){const t=k/8;pts.push([x+.25+dx*t*3.6,h+Math.sin(t*Math.PI)*.7-t*t*1.35,z+dz*t*3.6]);}
      for(let k=1;k<pts.length;k++)beam(pts[k-1],pts[k],.037,m.leafDark,.016,4);
      for(let k=1;k<=7;k++)for(const side of [-1,1]){
        const p=pts[k],len=(1-k/9)*1.6,tip=[p[0]-dz*len*side-dx*.22,p[1]-.35,p[2]+dx*len*side-dz*.22];
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...p,p[0]+dx*.40,p[1]-.04,p[2]+dz*.40,...tip,...tip,p[0]+dx*.40,p[1]-.04,p[2]+dz*.40,...p],3));g.computeVertexNormals();batch(g,fr%2?m.leaf:m.leafLight);
      }
    }
    obstacle(x,z,.6,.6,'palm-trunk');
  }
  // Plantings follow the model's perimeter rhythm; omit any object near a contracted route.
  for(let x=-132;x<=135;x+=10.5)for(const z of [48,-52])if(!nearRoute(x,z,4)&&!blocked(x,z,3))tree(x,z,6+rng()*2);
  for(let i=0;i<18;i++){const a=i*2.4,r=Math.sqrt(rng())*.85,x=islandX+Math.cos(a)*rx*r,z=islandZ+Math.sin(a)*rz*r;tree(x,z,3.8+rng()*1.6,hillY(x,z));}
  for(const x of [16,33])for(let z=-16;z<=18;z+=8.5)if(!nearRoute(x,z,3)&&!blocked(x,z,1))palm(x,z,8.5+rng());
  for(const [x,z] of [[-104,-8],[-102,38],[-84,39],[-67,39],[-50,40],[-8,38],[56,32],[71,32],[82,32],[134,3],[133,-11],[48,-30]])if(!nearRoute(x,z,3)&&!blocked(x,z,2))tree(x,z,7+rng()*2);
  const shrubObstacles=[];
  for(let i=0;i<90;i++){
    const x=-133+rng()*270,z=-48+rng()*94;if(nearRoute(x,z,3)||blocked(x,z,3)||(x>110&&z>27))continue;
    const yaw=rng()*TAU;
    mesh(new THREE.IcosahedronGeometry(1,1),m.leaf,[x,.45,z],[0,yaw,0],[1.6,.6,1.0]);
    // Project the rotated foliage ellipsoid onto X/Z for the shared AABB collision map.
    // Player movement already expands each collider by the player's radius.
    const halfX=Math.hypot(1.6*Math.cos(yaw),Math.sin(yaw));
    const halfZ=Math.hypot(1.6*Math.sin(yaw),Math.cos(yaw));
    shrubObstacles.push([x,z,halfX*2,halfZ*2,'shrub']);
  }
  // Bench, lighting and sign kit: all furniture sits beside the walking lanes.
  for(const [x,z] of [[-30,24],[-69,21],[47,34],[93,-15],[116,22],[46,-29]]){
    for(let i=0;i<5;i++)box(x,.60,z+(i-2)*.13,3.2,.09,.10,m.wood);
    for(const dx of [-1.1,1.1]){box(x+dx,.29,z,.07,.55,.62,m.darkFrame);box(x+dx,.88,z-.4,.07,1.05,.07,m.darkFrame);}
    for(let i=0;i<3;i++)box(x,.82+i*.18,z-.42,3.2,.13,.08,m.wood);obstacle(x,z,3.3,1.0,'bench');
  }
  for(const zone of CAMPUS.safeZones){
    ellipse(zone.x,zone.z,zone.r,zone.r,m.pavingLight,.043);
    for(const dx of [-zone.r+.8,zone.r-.8]){const x=zone.x+dx,z=zone.z+zone.r-.5;if(nearRoute(x,z,1.5)||blocked(x,z,.7))continue;box(x,.8,z,.19,1.6,.19,m.darkFrame);box(x,1.6,z,.25,.2,.25,m.warmLight);}
    if(night){const light=new THREE.PointLight(0xffd4a0,19,zone.r*3,2);light.position.set(zone.x,2.8,zone.z);root.add(light);}
  }
  for(let x=-126;x<130;x+=18){const z=30.5;if(nearRoute(x,z,1)||blocked(x,z,1)||(x>110&&z>27))continue;box(x,1.0,z,.13,2,.13,m.darkFrame);box(x,2.05,z,.6,.08,.25,m.warmLight);obstacle(x,z,.2,.2,'lamp');}
  // Memory representations share location between day and night; only signals change.
  for(const station of CAMPUS.stations){
    const {x,z}=station.position,group=new THREE.Group();group.position.set(x,1.65,z);group.name=station.id+' memory';root.add(group);
    const mat=dynamicSignal.clone(),core=new THREE.Mesh(new THREE.OctahedronGeometry(.19,0),mat);group.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.4,.019,5,32),mat);group.add(ring);group.visible=night;
    memories.set(station.id,{group,mat,ring,done:false});
    ellipse(x,z,.65,.65,night?m.litGlass:m.pavingLight,.078);
  }
  // Material batches keep facade bays, individual windows and foliage off the draw-call hot path.
  let triangles=0;
  for(const {material,list} of batches.values()){
    const geometry=mergeGeometries(list,false);if(!geometry)throw new Error('Failed to merge '+material.name);geometry.computeBoundingSphere();
    const object=new THREE.Mesh(geometry,material);object.name=material.name+' · campus batch';object.receiveShadow=true;object.castShadow=false;root.add(object);triangles+=geometry.attributes.position.count/3;list.forEach(g=>g.dispose());
  }
  // Register after placement so solid shrubs do not change seeded scenery or furniture layout.
  for(const args of shrubObstacles)obstacle(...args);
  // Validate the geometric contract at build time without silently cutting holes into solids.
  const routeConflicts=[];let routeSamples=0;
  for(const [ri,route] of CAMPUS.paths.entries())for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.4);
    for(let k=0;k<=count;k++){const t=k/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;routeSamples++;if(blocked(x,z,.65))routeConflicts.push({route:ri,x,z});}
  }
  const stationConflicts=CAMPUS.stations.filter(s=>blocked(s.position.x,s.position.z,.65)||blocked(s.approach.x,s.approach.z,.65)).map(s=>s.id);
  const trackConflicts=CAMPUS.track.checkpoints.filter(p=>blocked(p.x,p.z,.65));
  const diagnostics={provenance,triangles:Math.round(triangles),staticDrawCalls:batches.size,dynamicDrawCalls:23,materials:batches.size+11,geometries:batches.size+23,colliderCount:colliders.length,sourceMeshes:0,retainedMeshes:0,shadowPasses:0,reflectionPasses:0,routeSamples,routeConflicts,stationConflicts,trackConflicts,landmarks:CAMPUS.buildings.map(b=>b.id),coordinateConvention:'Model front is +Z. Ground y=0. Relative, compressed, not surveyed.'};
  onProgress('Campus ready',1);
  return {root,colliders,bounds:copy(CAMPUS.bounds),stations:copy(CAMPUS.stations),safeZones:copy(CAMPUS.safeZones),spawn:copy(CAMPUS.spawn),exit:copy(CAMPUS.exit),diagnostics,
    groundHeight(){return 0;},isWalkable(x,z,r=.6){const b=CAMPUS.bounds;return x>b.minX+r&&x<b.maxX-r&&z>b.minZ+r&&z<b.maxZ-r&&!blocked(x,z,r);},
    update(dt,time,state){animatedTime.value=time;for(const item of memories.values()){item.group.position.y=1.65+Math.sin(time*1.6)*.07;item.group.rotation.y=time*.35;item.group.scale.setScalar(item.done?.46:1);item.ring.rotation.z=time*.18;}
      for(const beacon of trackBeacons){const tr=state?.track,complete=tr?.done||tr?.active&&beacon.index<tr.next,next=tr?.active&&beacon.index===tr.next;beacon.group.visible=!night||!!tr?.active||!!tr?.done;beacon.mat.color.set(complete?0xd8ac69:next?0xa2ebff:0x458bab);beacon.mat.opacity=complete?.35:next?.96:.45;beacon.halo.scale.setScalar(next?1+Math.sin(time*3)*.12:1);if(state?.player)beacon.group.rotation.y=Math.atan2(state.player.x-beacon.group.position.x,state.player.z-beacon.group.position.z);}
      for(const {mesh:flag,original} of flags){const p=flag.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=original[i*3],y=original[i*3+1],u=(x+1.15)/2.3;p.setZ(i,Math.sin(u*5-time*1.7+y)*.17*u);}p.needsUpdate=true;flag.geometry.computeVertexNormals();}},
    setMemory(id,done){const item=memories.get(id);if(!item)return;item.done=!!done;item.mat.color.set(done?0xf1ce92:0xb4e7df);},
  };
}
