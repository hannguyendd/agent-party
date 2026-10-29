import * as T from 'three';
import {Model} from '../primitives';
export function create(){const m=new Model('monitor-dual');const b=m.box.bind(m),c=m.cyl.bind(m),s=m.sphere.bind(m);
for(const x of [-.39,.39]){b(.72,.44,.09,'dark',x,.46,0);m.mesh(new T.PlaneGeometry(.64,.35),'screen',[x,.46,.047],m.root,'screen',true);b(.075,.26,.075,'dark',x,.16,0);b(.36,.06,.25,'dark',x,.03,.04);} 
return m;}
