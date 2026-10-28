import * as T from 'three';import {Model} from '../primitives';import {create as officeChair} from './office-chair';import {create as smallPlant} from './desk-plant';
export const extraPropIds=['desk-long','cable-tray','monitor-single','mouse','monitor-riser','desk-shelf','power-strip','gaming-chair','stool','photo-frame','water-bottle','figurine','reception-desk','door-mat','cabinet','fridge','counter','sink','coffee-machine','jar','round-table','bench','shelf','sofa','armchair','coffee-table','whiteboard','floor-lamp','bookshelf','printer','plant-large','plant-small','rug-lavender','rug-mint','folding-table','folding-chair','card-mat','ludo-mat'];
export const smallItems=['monitor-arm','keyboard','desk-plant','mug','cable-tray','monitor-single','mouse','monitor-riser','desk-shelf','power-strip','photo-frame','water-bottle','figurine','sink','coffee-machine','jar'];
export function extended(id:string){let m:Model;if(id==='gaming-chair'){m=officeChair();m.id=id;m.root.setName(id);for(const mesh of m.d.getRoot().listMeshes())for(const p of mesh.listPrimitives()){const uv=p.getAttribute('TEXCOORD_0')!;const k=15;for(let i=0;i<uv.getCount();i++)uv.setElement(i,[(k%8+.5)/8,(Math.floor(k/8)+.5)/8]);}return m;}if(id==='plant-large'||id==='plant-small'){m=smallPlant();m.id=id;m.root.setName(id);const factor=id==='plant-large'?3:1.8;for(const n of m.root.listChildren()){const p=n.getTranslation();n.setTranslation(p.map(v=>v*factor) as any);n.setScale([factor,factor,factor]);}return m;}m=new Model(id);const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
const legs=(w:number,d:number,h:number,color='frame')=>{for(const x of [-w/2+.09,w/2-.09])for(const z of [-d/2+.09,d/2-.09])b(.12,h,.12,color,x,h/2,z);};
if(id==='desk-long'){b(2.3,.12,1.8,'wood',0,.68,0,m.root,'desktop',.06);for(const x of [-.97,.97])for(const z of [-.77,.77])b(.1,.62,.1,'frame',x,.31,z);for(const x of [-.97,.97])b(.1,.1,1.6,'frame',x,.1,0);b(1.9,.11,.09,'frame',0,.55,0);}
if(id==='cable-tray')b(1.8,.08,.18,'pants',0,.04,0);
if(id==='monitor-single'){b(.78,.48,.09,'dark',0,.47,0);m.mesh(new T.PlaneGeometry(.69,.38),'screen',[0,.47,.047],m.root,'screen',true);c(.04,.24,'dark',0,.17,0);b(.38,.06,.25,'dark',0,.03,.02);}
if(id==='mouse')s(.13,.07,.2,'dark',0,.035,0);
if(id==='monitor-riser'){b(.85,.08,.4,'wood',0,.2,0);for(const x of [-.34,.34])b(.08,.18,.35,'wood',x,.09,0);}
if(id==='desk-shelf'){b(1.1,.08,.3,'wood',0,.28,0);for(const x of [-.46,.46])b(.08,.24,.28,'frame',x,.12,0);}
if(id==='power-strip'){b(.55,.07,.13,'white',0,.035,0);for(const x of [-.17,0,.17])b(.055,.015,.065,'pants',x,.074,0);}
if(id==='stool'){c(.31,.12,'lavender',0,.44,0);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;b(.1,.38,.1,'frame',Math.sin(a)*.2,.19,Math.cos(a)*.2);}}
if(id==='photo-frame'){b(.27,.33,.045,'wood',0,.165,0);m.mesh(new T.PlaneGeometry(.21,.25),'mint',[0,.165,.024],m.root,'photo');b(.1,.12,.1,'frame',0,.06,-.06);}
if(id==='water-bottle'){c(.065,.28,'screen',0,.14,0);c(.043,.08,'screen',0,.31,0);c(.05,.045,'white',0,.367,0);}
if(id==='figurine'){m.mesh(new T.IcosahedronGeometry(.09,1),'peach',[0,.21,0]);m.mesh(new T.IcosahedronGeometry(.085,1),'lavender',[0,.09,0]);b(.21,.03,.19,'wood',0,.015,0);}
if(id==='reception-desk'){b(3.2,.18,.88,'wood',0,.79,0);b(2.9,.7,.64,'peach',0,.35,-.02);b(2.9,.08,.68,'frame',0,.04,-.02);}
if(id==='door-mat'||id==='rug-lavender'||id==='rug-mint'){b(id==='door-mat'?1.8:4,.025,id==='door-mat'?.8:3,id==='rug-lavender'?'lavender':'mint',0,.0125,0);}
if(id==='cabinet'){b(1.8,1.2,.8,'wood',0,.6,0);for(const y of [.25,.65,1.02]){b(1.65,.04,.05,'peach',0,y,.42);b(.3,.055,.07,'white',0,y+.08,.46);}}
if(id==='fridge'){b(1.6,2.4,1.5,'mint',0,1.2,0);b(1.46,.055,.05,'sage',0,1.55,.77);for(const y of [.95,1.9])b(.065,.38,.09,'white',.55,y,.81);}
if(id==='counter'){b(2,.12,.95,'wood',0,.92,0);b(1.94,.86,.85,'peach',0,.43,0);for(const x of [-.47,.47])b(.22,.05,.06,'white',x,.7,.46);}
if(id==='sink'){b(.7,.08,.55,'frame',0,.04,0);b(.54,.025,.39,'screen',0,.083,0);const n=m.mesh(new T.TorusGeometry(.12,.025,4,8,Math.PI),'white',[0,.19,-.16],m.root,'faucet');}
if(id==='coffee-machine'){b(.48,.6,.4,'dark',0,.3,0);b(.28,.16,.035,'screen',0,.43,.22);b(.2,.07,.16,'frame',0,.29,.23);c(.075,.15,'white',0,.13,.19);}
if(id==='jar'){c(.1,.22,'cream',0,.11,0);c(.105,.05,'wood',0,.245,0);}
if(id==='round-table'){c(1.2,.13,'wood',0,.68,0);c(.16,.55,'frame',0,.275,0);c(.55,.09,'frame',0,.045,0);}
if(id==='bench'){b(2.1,.16,.65,'mint',0,.43,0);legs(1.9,.52,.35);}
if(id==='shelf'||id==='bookshelf'){const w=id==='bookshelf'?1.8:1.2;for(const x of [-w/2+.07,w/2-.07])b(.14,1.9,.5,'wood',x,.95,0);for(const y of [.08,.65,1.25,1.85])b(w,.1,.5,'wood',0,y,0);if(id==='bookshelf')for(let row=0;row<2;row++)for(let i=0;i<5;i++)b(.17,.4,.3,['mint','lavender','peach'][i%3],-.6+i*.28,.9+row*.6,0);}
if(id==='sofa'||id==='armchair'){const w=id==='sofa'?2.7:1.15;b(w,.3,1.1,'mint',0,.28,0);b(w,.65,.23,'mint',0,.69,-.44);for(const x of [-w/2+.13,w/2-.13])b(.27,.49,1.1,'mint',x,.55,0);b(w-.56,.16,.8,'lavender',0,.5,.1);legs(w-.2,.9,.15,'wood');}
if(id==='coffee-table'){b(1.65,.11,1,'wood',0,.43,0);legs(1.45,.8,.38);}
if(id==='whiteboard'){b(2.3,1.3,.12,'frame',0,1.3,0);b(2.1,1.1,.06,'white',0,1.3,.08);for(const x of [-.9,.9]){b(.09,.7,.09,'frame',x,.35,0);b(.4,.07,.6,'frame',x,.035,0);}b(.8,.06,.14,'mint',-.4,1.48,.13);b(.55,.06,.14,'lavender',-.52,1.18,.13);}
if(id==='floor-lamp'){c(.3,.08,'pants',0,.04,0);c(.04,1.6,'frame',0,.86,0);const g=new T.ConeGeometry(.35,.4,10,1,true);m.mesh(g,'cream',[0,1.75,0],m.root,'lamp-shade',true);}
if(id==='printer'){b(.85,.42,.65,'frame',0,.21,0);b(.6,.06,.49,'dark',0,.44,-.03);b(.45,.06,.2,'white',0,.07,.39);b(.18,.06,.03,'screen',.23,.3,.34);}
if(id==='folding-table'){b(2.5,.1,1.4,'white',0,.69,0);for(const x of [-.9,.9]){const a=b(.1,.65,.1,'frame',x,.325,0);a.setRotation(new T.Quaternion().setFromEuler(new T.Euler(.45,0,0)).toArray());const b1=b(.1,.65,.1,'frame',x,.325,0);b1.setRotation(new T.Quaternion().setFromEuler(new T.Euler(-.45,0,0)).toArray());}}
if(id==='folding-chair'){b(.58,.09,.58,'white',0,.455,0);b(.58,.46,.09,'white',0,.78,-.24);legs(.5,.5,.41);}
if(id==='card-mat'){b(3,.025,2,'sage',0,.0125,0);for(let i=0;i<5;i++)c(.09,.02,['cream','lavender','peach'][i%3],-.7+i*.35,.037,0);}
if(id==='ludo-mat'){b(4,.025,4,'cream',0,.0125,0);for(let i=0;i<4;i++){const x=i%2?1:-1,z=i<2?-1:1;b(1.65,.014,1.65,['mint','lavender','peach','screen'][i],x,.032,z);for(const dx of [-.35,.35])for(const dz of [-.35,.35])c(.13,.015,'white',x+dx,.046,z+dz);}b(.55,.015,.55,'orange',0,.032,0);}
if(['card-mat','ludo-mat'].includes(id))for(const n of m.root.listChildren()){const t=n.getTranslation();n.setTranslation([t[0],t[1]*.5,t[2]]).setScale([1,.5,1]);}return m;}
