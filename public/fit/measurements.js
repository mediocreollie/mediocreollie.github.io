/* Measurement contract v2. Pure functions shared by the UI and fixture tests. */
(function(root){
  const dimensions={tee:['chest','shoulder','length','sleeve'],trousers:['waist','hip','inseam']};
  const girths=new Set(['chest','waist','hip']);
  function parse(value,allowRange=false){
    if(value==null||String(value).trim()==='')return null;
    const text=String(value).trim();
    const match=text.match(allowRange?/^(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?$/:/^(\d+(?:\.\d+)?)$/);
    if(!match)throw Error('Use a positive number'+(allowRange?' or a range such as 96-102':'')+'.');
    const low=Number(match[1]),high=Number(match[2]??match[1]);
    if(!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<low)throw Error('Measurements must be positive and ranges must run from smaller to larger.');
    return {low,high};
  }
  function normalise(value,unit,key,flat=false,allowRange=false){
    if(!['cm','in'].includes(unit))throw Error('Confirm the measurement unit.');
    const parsed=parse(value,allowRange);if(!parsed)return null;
    const factor=(unit==='in'?2.54:1)*(flat&&girths.has(key)?2:1);
    return {low:parsed.low*factor,high:parsed.high*factor};
  }
  function compare({category,chartType,unit,flat,values,reference,confirmed}){
    if(!dimensions[category])throw Error('Choose T-shirt or trousers.');
    if(!['garment','body'].includes(chartType))throw Error('Confirm whether this is a body size chart or garment measurements.');
    if(!confirmed)throw Error('Confirm the chart labels, units and measurement methods before comparing.');
    if(chartType==='body'&&reference.kind!=='body')throw Error('Compare a body size chart with your body measurements, not an owned garment.');
    const rows=dimensions[category].map(key=>{
      const target=normalise(values[key],unit,key,chartType==='garment'&&flat,chartType==='body');
      // A body sleeve is not a garment sleeve; torso length has no saved body equivalent.
      const incompatible=chartType==='garment'&&reference.kind==='body'&&!girths.has(key);
      const base=incompatible?null:normalise(reference.values[key],reference.unit,key);
      if(!target||!base)return {key,status:'unknown',target,reference:base};
      if(chartType==='body')return {key,status:base.low<target.low?'below':base.low>target.high?'above':'within',target,reference:base,difference:base.low<target.low?base.low-target.low:base.low>target.high?base.low-target.high:0};
      return {key,status:reference.kind==='body'?'ease':'difference',target,reference:base,difference:target.low-base.low};
    });
    if(!rows.some(r=>r.status!=='unknown'))throw Error('No compatible measurements yet. Add a matching reference measurement or choose another reference.');
    return {version:2,category,chartType,rows};
  }
  root.FitMeasurements={parse,normalise,compare,dimensions};
})(globalThis);
