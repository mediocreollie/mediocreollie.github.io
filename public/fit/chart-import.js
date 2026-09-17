/* Conservative English chart parser. Ambiguous layouts stay manual. */
(function(root){
 const keys=['chest','waist','hip','shoulder','length','sleeve','inseam'];
 const labels={chest:/^(?:chest(?: width)?|bust)\b/i,waist:/^waist\b/i,hip:/^(?:hips?|seat)\b/i,shoulder:/^shoulder(?:s| width)?\b/i,length:/^(?:body length|garment length|length)\b/i,sleeve:/^(?:sleeve(?: length)?|arm length)\b/i,inseam:/^(?:inseam|inside leg)\b/i};
 function parse(text){
  const lines=String(text).slice(0,32000).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const header=lines.find(s=>/^size\b\s*:?\s*\d{1,3}(?:\s|\||$)/i.test(s)||/^(?:size\b[:\s]*)?(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL)(?:\s|\||$)/i.test(s));
  const sizes=header?header.replace(/^size\b\s*:?\s*/i,'').split(/[\s|]+/).filter(Boolean):[];
  if((sizes.some(s=>/^\d+$/.test(s))&&!/^size\b/i.test(header||""))||!sizes.length||sizes.length>12||sizes.some(s=>! /^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|\d{1,3})$/i.test(s))||new Set(sizes.map(s=>s.toUpperCase())).size!==sizes.length)return {sizes:[],rows:[],warnings:['Size columns were not clear. Add sizes manually and copy values from the image.']};
  const rows=sizes.map(size=>({size,values:Object.fromEntries(keys.map(k=>[k,'']))})),warnings=[];const seen=new Set();
  for(const line of lines){
   const key=keys.find(k=>labels[k].test(line));if(!key)continue;
   if(seen.has(key)){rows.forEach(r=>r.values[key]='');warnings.push('Repeated '+key+' rows need manual review.');continue;}seen.add(key);
   const rest=line.replace(labels[key],'').replace(/\([^)]*\)/g,'').replace(/\b(?:cm|inches|inch|in)\b/gi,'').replace(/^\s*[:|]\s*/,'').trim();
   const tokens=rest.split(/\s*\|\s*|\s+/).filter(Boolean);
   if(tokens.length!==sizes.length||tokens.some(t=>!/^\d+(?:\.\d+)?(?:[-–]\d+(?:\.\d+)?)?$/.test(t))){warnings.push('Check '+key+': values did not line up with the size columns.');continue;}
   tokens.forEach((v,i)=>rows[i].values[key]=v);
  }
  if(!seen.size)warnings.push('Measurement labels were not recognised. Enter the values below.');
  return {sizes,rows,warnings};
 }
 function validate(rows){
  if(!rows.length||rows.length>12)throw Error('Add between 1 and 12 sizes.');
  const names=rows.map(r=>r.size.trim());
  if(names.some(n=>!n)||new Set(names.map(n=>n.toUpperCase())).size!==names.length)throw Error('Give each size a unique name.');
  rows.forEach(r=>keys.forEach(k=>{if(r.values[k])root.FitMeasurements.parse(r.values[k],true)}));
  if(!rows.some(r=>keys.some(k=>r.values[k])))throw Error('Enter at least one measurement.');
  return true;
 }
 root.FitChart={keys,parse,validate};
})(globalThis);
