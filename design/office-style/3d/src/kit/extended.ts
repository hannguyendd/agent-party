import * as T from 'three';import {Model,vertexAlpha} from '../primitives';
export const extraKitIds=['wall-door','glass-wall','glass-post','air-conditioner','picture-frame'];
export function extendedKit(id:string){const m=new Model(id),b=m.box.bind(m);
if(id==='wall-door'){for(const x of [-.43,.43])b(.14,3.3,.18,'wall',x,1.65,0);b(1,1.2,.18,'wall',0,2.7,0,m.root,'solid-header');b(.7,2.05,.1,'wood',0,1.025,0);b(.07,.07,.09,'white',.23,1.05,.09);}
if(id==='glass-wall'){for(const y of [.04,2.77])b(1,.06,.06,'aluminium',0,y,0,m.root,'slim-rail');for(const x of [-.48,.48])b(.04,2.8,.14,'aluminium',x,1.4,0,m.root,'light-frame');vertexAlpha(m,m.mesh(new T.PlaneGeometry(.92,2.38),'frost',[0,1.29,0],m.root,'frosted-pane'),.8);vertexAlpha(m,m.mesh(new T.PlaneGeometry(.92,.25),'glass',[0,2.605,0],m.root,'clear-strip'),.3);}
if(id==='glass-post')b(.18,2.8,.18,'aluminium',0,1.4,0);
if(id==='air-conditioner'){b(.95,.36,.09,'white',0,.18,.045);for(const y of [.1,.16])b(.8,.025,.015,'aluminium',0,y,.0975);}
if(id==='picture-frame'){b(.8,.66,.035,'wood',0,.33,.0175);b(.66,.52,.015,'cream',0,.33,.0425);b(.3,.15,.01,'mint',-.1,.28,.055);b(.2,.24,.01,'lavender',.15,.3,.055);}
return m;}
