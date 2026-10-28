import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('wall-straight');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(1,2.7,.6,'wall',0,1.35,0);
return m;}
