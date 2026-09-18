/* Comparison history helpers. Saved snapshots are copied and never recalculated in place. */
(function(root){
  function save(profile,draft,id,now){
    if(!draft||draft.measurementVersion!==2)throw Error('Run a measurement comparison before saving.');
    const record=structuredClone(draft);
    record.id=id;
    record.date=now;
    profile.comparisons.push(record);
    return record;
  }
  function find(profile,id){return profile.comparisons.find(c=>c.id===id)||null;}
  function replay(check,profile){
    if(!check||check.measurementVersion!==2||!check.result)throw Error('This older check can be viewed as a summary, but cannot be rebuilt automatically.');
    const available=check.reference==='body'||profile.garments.some(g=>g.id===check.reference);
    return {category:check.category,brand:check.brand||'',item:check.item||'',size:check.size||'',url:check.url||'',chartType:check.chartType||'',unit:check.sourceUnit||'',girthMethod:check.girthMethod||'',values:structuredClone(check.measurements||{}),reference:available?check.reference:'body',referenceMissing:!available};
  }
  root.FitHistory={save,find,replay};
})(globalThis);
