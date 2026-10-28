import * as T from 'three';
import {Model} from '../primitives';
// A close-fitting cap with a higher front hairline and a lower nape.
export function hairCap(m:Model,parent:any,color='hair',name='hair'){
const positions=[],indices=[];const around=18,rings=7;
for(let j=0;j<=rings;j++)for(let i=0;i<=around;i++){const phi=i/around*Math.PI*2,front=(Math.cos(phi)+1)/2,theta=(1.9-.65*front+.035*Math.sin(phi*3)*front)*j/rings;positions.push(Math.sin(phi)*Math.sin(theta)*.337,.285+Math.cos(theta)*.318,Math.cos(phi)*Math.sin(theta)*.306-.004);}
for(let j=0;j<rings;j++)for(let i=0;i<around;i++){const a=j*(around+1)+i,b=a+around+1;indices.push(a,b,a+1,a+1,b,b+1);}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();m.mesh(g,color,[0,0,0],parent,name);

}
export function eyeSpark(m:Model,eye:any){const p=eye.getTranslation();const g=new T.SphereGeometry(1,6,4);g.scale(.010,.013,.006);m.mesh(g,'white',[p[0]-.012,p[1]+.021,p[2]+.023],eye.getParentNode(),'eye-glint');}
export function smile(m:Model,parent:any,y=.16,z=.28){const curve=new T.QuadraticBezierCurve3(new T.Vector3(-.047,y+.012,z),new T.Vector3(0,y-.018,z+.004),new T.Vector3(.047,y+.012,z));m.mesh(new T.TubeGeometry(curve,6,.009,3,false),'soil',[0,0,0],parent,'smile');}
