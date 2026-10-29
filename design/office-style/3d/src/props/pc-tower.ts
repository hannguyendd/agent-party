import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('pc-tower');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
b(.28,.52,.48,'dark',0,.26,0);b(.21,.42,.035,'chair',0,.27,.245);b(.04,.04,.035,'mint',.06,.43,.266);for(const y of [.14,.2,.26])b(.15,.03,.035,'gap',0,y,.266);
return m;}
