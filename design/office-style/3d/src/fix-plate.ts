// Native-pixel source sprite and floor reuse for the Part D plate correction.
import {PNG} from 'pngjs';
export function fixPlate(original:any,originalFg:any,bg:any,fg:any){
const put=(x:number,y:number,sx:number,sy:number,foreground=false)=>{const i=(y*1792+x)*4,j=(sy*1792+sx)*4;bg.data.set(original.data.subarray(j,j+4),i);fg.data.set(foreground?originalFg.data.subarray(j,j+4):[0,0,0,0],i);};
// Tile the existing peach floor, including its grain, rather than the mint rug interior.
for(let y=894;y<1096;y++)for(let x=1312;x<1728;x++){
put(x,y,y<928?1392+x%80:x,y<928?832+y%48:y);
// The hall outside the old room used a cooler base. Match the upper room floor.
const i=(y*1792+x)*4,key=[...bg.data.subarray(i,i+3)].join(',');
if(['248,224,208','253,230,206','253,228,210','253,233,215','253,230,212'].includes(key))bg.data.set([253,224,194],i);
}
// A second lounge rug repeats the original mint rug and its two-pixel rounded border.
const l=1388,r=1712,t=922,b=1090;
for(let y=t;y<b;y++)for(let x=l;x<r;x++){const inset=(y<t+4||y>=b-4)?8:(y<t+8||y>=b-8)?4:0;if(x<l+inset||x>=r-inset)continue;const edge=x<l+2||x>=r-2||y<t+2||y>=b-2;put(x,y,edge?1382:1400,edge?790:790);}
function sprite(sx:number,sy:number,w:number,h:number,dx:number,dy:number,polygon:number[][]){for(let y=0;y<h;y++)for(let x=0;x<w;x++){let inside=false;for(let a=0,b=polygon.length-1;a<polygon.length;b=a++){const [ax,ay]=polygon[a],[bx,by]=polygon[b];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}if(inside)put(dx+x,dy+y,sx+x,sy+y,true);}}
sprite(1426,572,162,106,1470,980,[[12,8],[124,8],[132,22],[132,40],[148,44],[148,94],[140,104],[8,104],[0,94],[0,36],[10,30]]);
sprite(1416,678,128,64,1484,922,[[40,0],[78,0],[80,10],[110,22],[118,38],[110,54],[88,64],[28,64],[14,52],[6,40],[14,24],[38,10]]);
sprite(1328,558,78,100,1644,986,[[20,12],[58,12],[70,30],[72,62],[62,90],[50,98],[24,98],[14,82],[8,60],[8,30]]);
}
