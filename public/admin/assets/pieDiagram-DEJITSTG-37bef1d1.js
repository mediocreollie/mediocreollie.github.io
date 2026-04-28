import{E as J,n as Q,o as Y,s as tt,g as et,c as at,b as it,_ as s,l as w,v as rt,d as st,F as nt,K as ot,L as lt,M as L,N as ct,k as dt,O as pt}from"./index-0b3beec8.js";import{p as gt}from"./chunk-4BX2VUAB-e61ddd69.js";import{p as ht}from"./mermaid-parser.core-3dc71061.js";import"./min-b106f300.js";import"./_baseUniq-8014dbce.js";var G=J.pie,C={sections:new Map,showData:!1,config:G},u=C.sections,D=C.showData,ut=structuredClone(G),ft=s(()=>structuredClone(ut),"getConfig"),mt=s(()=>{u=new Map,D=C.showData,rt()},"clear"),vt=s(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);u.has(t)||(u.set(t,a),w.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),xt=s(()=>u,"getSections"),St=s(t=>{D=t},"setShowData"),wt=s(()=>D,"getShowData"),O={getConfig:ft,clear:mt,setDiagramTitle:Q,getDiagramTitle:Y,setAccTitle:tt,getAccTitle:et,setAccDescription:at,getAccDescription:it,addSection:vt,getSections:xt,setShowData:St,getShowData:wt},Ct=s((t,a)=>{gt(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),Dt={parse:s(async t=>{const a=await ht("pie",t);w.debug(a),Ct(a,O)},"parse")},$t=s(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),yt=$t,Tt=s(t=>{const a=[...t.values()].reduce((r,o)=>r+o,0),$=[...t.entries()].map(([r,o])=>({label:r,value:o})).filter(r=>r.value/a*100>=1);return pt().value(r=>r.value).sort(null)($)},"createPieArcs"),At=s((t,a,$,y)=>{var W;w.debug(`rendering pie chart
`+t);const r=y.db,o=st(),T=nt(r.getConfig(),o.pie),A=40,n=18,p=4,l=450,d=l,f=ot(a),c=f.append("g");c.attr("transform","translate("+d/2+","+l/2+")");const{themeVariables:i}=o;let[b]=lt(i.pieOuterStrokeWidth);b??(b=2);const E=T.textPosition,g=Math.min(d,l)/2-A,B=L().innerRadius(0).outerRadius(g),N=L().innerRadius(g*E).outerRadius(g*E);c.append("circle").attr("cx",0).attr("cy",0).attr("r",g+b/2).attr("class","pieOuterCircle");const h=r.getSections(),P=Tt(h),I=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let m=0;h.forEach(e=>{m+=e});const _=P.filter(e=>(e.data.value/m*100).toFixed(0)!=="0"),v=ct(I).domain([...h.keys()]);c.selectAll("mySlices").data(_).enter().append("path").attr("d",B).attr("fill",e=>v(e.data.label)).attr("class","pieCircle"),c.selectAll("mySlices").data(_).enter().append("text").text(e=>(e.data.value/m*100).toFixed(0)+"%").attr("transform",e=>"translate("+N.centroid(e)+")").style("text-anchor","middle").attr("class","slice");const U=c.append("text").text(r.getDiagramTitle()).attr("x",0).attr("y",-(l-50)/2).attr("class","pieTitleText"),k=[...h.entries()].map(([e,S])=>({label:e,value:S})),x=c.selectAll(".legend").data(k).enter().append("g").attr("class","legend").attr("transform",(e,S)=>{const z=n+p,j=z*k.length/2,q=12*n,H=S*z-j;return"translate("+q+","+H+")"});x.append("rect").attr("width",n).attr("height",n).style("fill",e=>v(e.label)).style("stroke",e=>v(e.label)),x.append("text").attr("x",n+p).attr("y",n-p).text(e=>r.getShowData()?`${e.label} [${e.value}]`:e.label);const K=Math.max(...x.selectAll("text").nodes().map(e=>(e==null?void 0:e.getBoundingClientRect().width)??0)),V=d+A+n+p+K,R=((W=U.node())==null?void 0:W.getBoundingClientRect().width)??0,X=d/2-R/2,Z=d/2+R/2,F=Math.min(0,X),M=Math.max(V,Z)-F;f.attr("viewBox",`${F} 0 ${M} ${l}`),dt(f,l,M,T.useMaxWidth)},"draw"),bt={draw:At},Wt={parser:Dt,db:O,renderer:bt,styles:yt};export{Wt as diagram};
