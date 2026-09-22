/** Sutherland–Hodgman clipping. Attributes after XYZ interpolate with position. */
export function clipPolygon(vertices: readonly number[][], distance: (vertex: number[]) => number): number[][] {
  const result: number[][] = [];
  for (let i=0;i<vertices.length;i++) {
    const a=vertices[i]!, b=vertices[(i+1)%vertices.length]!;
    const da=distance(a), db=distance(b), insideA=da<=1e-9, insideB=db<=1e-9;
    if (insideA) result.push(a);
    if (insideA!==insideB) {
      const t=da/(da-db);
      result.push(a.map((value,j)=>value+(b[j]!-value)*t));
    }
  }
  return result;
}

export function triangulatePolygon(vertices: readonly number[][]): number[] {
  const result:number[]=[];
  for(let i=1;i<vertices.length-1;i++) {
    const a=vertices[0]!,b=vertices[i]!,c=vertices[i+1]!;
    if(Math.abs((b[0]!-a[0]!)*(c[2]!-a[2]!)-(c[0]!-a[0]!)*(b[2]!-a[2]!))<1e-9) continue;
    result.push(...a.slice(0,3),...b.slice(0,3),...c.slice(0,3));
  }
  return result;
}
