import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('wall-column');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(.7,3.3,.7,'wall',0,1.65,0);
return m;}
