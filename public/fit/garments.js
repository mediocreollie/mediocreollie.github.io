/* Owned garment edits are additive and never rewrite comparison snapshots. */
(function(root){
 const keys=['chest','waist','hip','shoulder','length','sleeve','inseam'];
 function category(g){return g.category==='Trousers'?'trousers':['Top','Shirt','T-shirt'].includes(g.category)?'tee':null;}
 function hasMeasurements(g){
  const relevant=category(g)==='trousers'?['waist','hip','inseam']:category(g)==='tee'?['chest','shoulder','length','sleeve']:[];
  return relevant.some(k=>Number.isFinite(g.measurements?.[k])&&g.measurements[k]>0);
 }
 function update(profile,id,fields,newId){
  const previous=id?profile.garments.find(g=>g.id===id):null;
  if(id&&!previous)throw Error('This item is no longer available. Reopen My clothes.');
  if(!fields.name.trim())throw Error('Enter an item name.');
  const measurements={...previous?.measurements};
  keys.forEach(k=>{const value=fields.measurements[k];measurements[k]=root.FitMeasurements.parse(value)?.low??null;});
  const item={...previous,...fields,id:previous?.id||newId,unit:previous?.unit||profile.unit,measurementVersion:2,measurements,updatedAt:new Date().toISOString()};
  if(previous&&!previous.measurementVersion&&previous.category==='Trousers'&&previous.measurements.sleeve!=null)item.legacySleeveOrInseam=previous.measurements.sleeve;
  profile.garments=id?profile.garments.map(g=>g.id===id?item:g):[...profile.garments,item];
  return item;
 }
 root.FitGarments={keys,category,hasMeasurements,update};
})(globalThis);
