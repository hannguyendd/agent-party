import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('desk');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(2.3,.12,1.1,'wood',0,.68,0,m.root,'desktop',.06);for(const x of [-.97,.97])for(const z of [-.39,.39])b(.1,.62,.1,'frame',x,.31,z);for(const x of [-.97,.97])b(.1,.1,.86,'frame',x,.1,0);b(1.9,.11,.09,'frame',0,.55,-.4);
return m;}
