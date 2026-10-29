import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('monitor-arm');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(.18,.07,.22,'dark',0,.035,0);c(.045,.48,'dark',0,.3,0);for(const side of [-1,1]){const n=b(.37,.075,.08,'dark',side*.17,.48,.03);n.setRotation(new T.Quaternion().setFromEuler(new T.Euler(0,side*.45,side*.25)).toArray());m.mesh(new T.IcosahedronGeometry(.06,0),'frame',[side*.32,.52,.1]);}
return m;}
