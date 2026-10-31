/** Clip-local raster deformations, shared by browser preview/export and MCP.
 * Inverse mapping avoids holes; premultiplied-alpha bilinear sampling avoids
 * dark fringes. A convex corner pin uses a projective homography. */
export type WarpPoint = { x: number; y: number }
export type WarpQuad = [WarpPoint, WarpPoint, WarpPoint, WarpPoint]
export type LiquifyMode = 'push' | 'bulge' | 'pinch' | 'twirl'
export interface LiquifyDab extends WarpPoint { dx: number; dy: number; radius: number; strength: number; mode: LiquifyMode }
export interface DeformationSpec { corners?: WarpQuad; dabs?: LiquifyDab[] }
export const UNIT_QUAD: WarpQuad = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]
export function validWarpQuad(q: WarpQuad): boolean {
  if (!Array.isArray(q) || q.length!==4 || !q.every(p=>p && Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=2&&Math.abs(p.y)<=2)) return false
  return q.every((p,i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return (b.x-p.x)*(c.y-b.y)-(b.y-p.y)*(c.x-b.x)>1e-5})
}
/** Solve destination quad -> source unit square, using partial pivoting. */
export function inverseCornerPin(q: WarpQuad): number[] | null {
  if(!validWarpQuad(q))return null
  const a:number[][]=[]
  q.forEach((p,i)=>{const t=UNIT_QUAD[i];a.push([p.x,p.y,1,0,0,0,-t.x*p.x,-t.x*p.y,t.x],[0,0,0,p.x,p.y,1,-t.y*p.x,-t.y*p.y,t.y])})
  for(let k=0;k<8;k++){
    let pivot=k;for(let r=k+1;r<8;r++)if(Math.abs(a[r][k])>Math.abs(a[pivot][k]))pivot=r
    if(Math.abs(a[pivot][k])<1e-10)return null
    ;[a[k],a[pivot]]=[a[pivot],a[k]]
    const divisor=a[k][k];for(let c=k;c<9;c++)a[k][c]/=divisor
    for(let r=0;r<8;r++)if(r!==k){const factor=a[r][k];for(let c=k;c<9;c++)a[r][c]-=factor*a[k][c]}
  }
  return [...a.map(row=>row[8]),1]
}
export function hasDeformation(spec?: DeformationSpec): boolean {
  return !!spec && ((Array.isArray(spec.dabs)&&spec.dabs.length>0) || (Array.isArray(spec.corners)&&spec.corners.some((p,i)=>!p||!UNIT_QUAD[i]||Math.abs(p.x-UNIT_QUAD[i].x)>1e-8||Math.abs(p.y-UNIT_QUAD[i].y)>1e-8)))
}
const fieldCache=new WeakMap<DeformationSpec,{key:string;field:Float32Array}>()
const FIELD_SIZE=96
function displacementField(spec:DeformationSpec,w:number,h:number,dabs:LiquifyDab[]):Float32Array {
  const key=JSON.stringify([w/h,dabs]),cached=fieldCache.get(spec);if(cached?.key===key)return cached.field
  const field=new Float32Array((FIELD_SIZE+1)**2*2),minimum=Math.min(w,h)
  for(let gy=0;gy<=FIELD_SIZE;gy++)for(let gx=0;gx<=FIELD_SIZE;gx++){
    const ox=gx/FIELD_SIZE,oy=gy/FIELD_SIZE;let x=ox,y=oy
    for(let j=dabs.length-1;j>=0;j--){
      const d=dabs[j],cx=(x-d.x)*w/minimum,cy=(y-d.y)*h/minimum,r=Math.hypot(cx,cy),radius=Math.min(.8,d.radius)
      if(r>=radius)continue
      const falloff=(1-(r/radius)**2)**2,amount=Math.min(1,d.strength)*falloff
      if(d.mode==='push'){x-=Math.max(-.5,Math.min(.5,d.dx))*amount;y-=Math.max(-.5,Math.min(.5,d.dy))*amount}
      else if(d.mode==='twirl'){const angle=-amount*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle);x=d.x+(cx*cos-cy*sin)*minimum/w;y=d.y+(cx*sin+cy*cos)*minimum/h}
      else {const scale=d.mode==='pinch'?1+amount*.75:1-amount*.6;x=d.x+cx*scale*minimum/w;y=d.y+cy*scale*minimum/h}
    }
    const i=(gy*(FIELD_SIZE+1)+gx)*2;field[i]=x-ox;field[i+1]=y-oy
  }
  fieldCache.set(spec,{key,field});return field
}
export function deformRGBA(input: Uint8ClampedArray,w:number,h:number,spec:DeformationSpec): Uint8ClampedArray {
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||input.length!==w*h*4)throw new Error('Invalid deformation raster dimensions')
  if(spec.corners&&!validWarpQuad(spec.corners))throw new Error('Invalid corner pin')
  if(!hasDeformation(spec))return new Uint8ClampedArray(input)
  const matrix=inverseCornerPin(spec.corners||UNIT_QUAD)
  if(!matrix)throw new Error('Corner pin must be a non-folded convex quadrilateral')
  const dabs=(Array.isArray(spec.dabs)?spec.dabs:[]).slice(-256).filter(d=>d&&[d.x,d.y,d.dx,d.dy,d.radius,d.strength].every(Number.isFinite)&&d.radius>0&&d.strength>0)
  const out=new Uint8ClampedArray(input.length),field=dabs.length?displacementField(spec,w,h,dabs):null
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    const u=(px+.5)/w,v=(py+.5)/h,z=matrix[6]*u+matrix[7]*v+1
    if(Math.abs(z)<1e-9)continue
    let x=(matrix[0]*u+matrix[1]*v+matrix[2])/z,y=(matrix[3]*u+matrix[4]*v+matrix[5])/z
    if(x<0||y<0||x>1||y>1)continue
    if(field){
      const gx=x*FIELD_SIZE,gy=y*FIELD_SIZE,ix=Math.min(FIELD_SIZE-1,Math.floor(gx)),iy=Math.min(FIELD_SIZE-1,Math.floor(gy)),fx=gx-ix,fy=gy-iy,i=(iy*(FIELD_SIZE+1)+ix)*2,row=(FIELD_SIZE+1)*2
      const dx=(field[i]*(1-fx)+field[i+2]*fx)*(1-fy)+(field[i+row]*(1-fx)+field[i+row+2]*fx)*fy
      const dy=(field[i+1]*(1-fx)+field[i+3]*fx)*(1-fy)+(field[i+row+1]*(1-fx)+field[i+row+3]*fx)*fy
      x+=dx;y+=dy
    }
    if(x<0||y<0||x>1||y>1)continue
    if(Math.abs(x-u)<1e-12&&Math.abs(y-v)<1e-12){const i=(py*w+px)*4;out.set(input.subarray(i,i+4),i);continue}
    const sx=Math.max(0,Math.min(w-1,x*w-.5)),sy=Math.max(0,Math.min(h-1,y*h-.5)),ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy
    const indices=[(iy*w+ix)*4,(iy*w+Math.min(w-1,ix+1))*4,(Math.min(h-1,iy+1)*w+ix)*4,(Math.min(h-1,iy+1)*w+Math.min(w-1,ix+1))*4]
    const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy],i=(py*w+px)*4
    let alpha=0,red=0,green=0,blue=0
    for(let k=0;k<4;k++){const a=input[indices[k]+3]*weights[k];alpha+=a;red+=input[indices[k]]*a;green+=input[indices[k]+1]*a;blue+=input[indices[k]+2]*a}
    if(alpha>0){out[i]=red/alpha;out[i+1]=green/alpha;out[i+2]=blue/alpha;out[i+3]=alpha}
  }
  return out
}
export function applyCanvasDeformation(canvas: HTMLCanvasElement,spec: DeformationSpec): void {
  if(!hasDeformation(spec)||(spec.corners&&!validWarpQuad(spec.corners)))return
  const ctx=canvas.getContext('2d')!;const image=ctx.getImageData(0,0,canvas.width,canvas.height)
  image.data.set(deformRGBA(image.data,canvas.width,canvas.height,spec));ctx.putImageData(image,0,0)
}

export function validateDeformation(value: DeformationSpec | null): DeformationSpec | undefined {
  if(value===null)return undefined
  if(!value||typeof value!=='object')throw new Error('Deformation must be an object or null')
  if(value.corners&&!validWarpQuad(value.corners))throw new Error('Invalid corner pin')
  if(value.dabs&&(!Array.isArray(value.dabs)||value.dabs.length>256||value.dabs.some(d=>!d||![d.x,d.y,d.dx,d.dy,d.radius,d.strength].every(Number.isFinite)||d.radius<=0||d.radius>.8||d.strength<0||d.strength>1||!['push','pinch','bulge','twirl'].includes(d.mode))))throw new Error('Invalid liquify dabs')
  return structuredClone(value)
}

export function mapWarpPoint(m: number[],p:WarpPoint): WarpPoint {
  const z=m[6]*p.x+m[7]*p.y+m[8]
  return Math.abs(z)>1e-10?{x:(m[0]*p.x+m[1]*p.y+m[2])/z,y:(m[3]*p.x+m[4]*p.y+m[5])/z}:{x:NaN,y:NaN}
}
export function invertWarpMatrix(m:number[]): number[] {
  const [a,b,c,d,e,f,g,h,i]=m
  const out=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d]
  const det=a*out[0]+b*out[3]+c*out[6]
  if(Math.abs(det)<1e-10)throw new Error('Singular warp matrix')
  return out.map(value=>value/det)
}
