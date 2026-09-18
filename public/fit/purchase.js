/* Purchase outcomes add observed fit without changing the saved comparison snapshot. */
(function(root){
 const fits=['Just right','Too tight','Too loose','Not sure yet','Relaxed','Close fitting'];
 function record(profile,checkId,fields,newGarmentId,now){
  const check=profile.comparisons.find(c=>c.id===checkId);
  if(!check||check.measurementVersion!==2||!check.result)throw Error('Only a saved measurement comparison can become a purchased item.');
  if(!fields.name.trim())throw Error('Enter an item name.');
  if(!fits.includes(fields.fit))throw Error('Choose how the item fits.');
  const linkedId=check.purchase?.garmentId;
  const existing=linkedId?profile.garments.find(g=>g.id===linkedId):null;
  const measurements=Object.fromEntries(root.FitGarments.keys.map(k=>[k,existing?.measurements?.[k]??'']));
  const garment=root.FitGarments.update(profile,existing?.id||null,{name:fields.name.trim(),brand:fields.brand.trim(),category:check.category==='trousers'?'Trousers':'T-shirt',size:fields.size.trim(),fit:fields.fit,notes:fields.notes.trim(),sourceComparisonId:check.id,measurements},newGarmentId);
  check.purchase={status:'bought',fit:fields.fit,notes:fields.notes.trim(),garmentId:garment.id,recordedAt:now};
  return {check,garment};
 }
 root.FitPurchase={fits,record};
})(globalThis);
