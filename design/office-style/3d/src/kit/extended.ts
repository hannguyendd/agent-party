import {Model} from '../primitives';
export const extraKitIds=['wall-door','glass-wall','glass-post','air-conditioner','picture-frame'];
export function extendedKit(id:string){const m=new Model(id),b=m.box.bind(m);
if(id==='wall-door'){for(const x of [-.43,.43])b(.14,2.7,.18,'wall',x,1.35,0);b(1,.14,.18,'wall',0,2.63,0);b(.7,2.5,.1,'wood',0,1.25,0);b(.07,.07,.09,'white',.23,1.15,.09);}
if(id==='glass-wall'){for(const y of [.07,2.63])b(1,.14,.14,'pants',0,y,0);for(const x of [-.45,.45])b(.1,2.7,.14,'frame',x,1.35,0);const pane=b(.8,2.42,.04,'glass',0,1.35,0,m.root,'glass-pane');const prim=pane.getMesh()!.listPrimitives()[0];const count=prim.getAttribute('POSITION')!.getCount();const rgba=new Float32Array(count*4);for(let i=0;i<count;i++)rgba.set([1,1,1,.22],i*4);prim.setAttribute('COLOR_0',m.d.createAccessor().setType('VEC4').setArray(rgba).setBuffer(m.b));m.mat.setAlphaMode('BLEND');}
if(id==='glass-post')b(.18,2.7,.18,'frame',0,1.35,0);
if(id==='air-conditioner'){b(.95,.36,.3,'white',0,.18,0);for(const y of [.1,.16])b(.8,.035,.03,'frame',0,y,.16);}
if(id==='picture-frame'){b(.8,.66,.09,'wood',0,.33,0);b(.66,.52,.04,'cream',0,.33,.05);b(.3,.15,.03,'mint',-.1,.28,.08);b(.2,.24,.03,'lavender',.15,.3,.08);}
return m;}
