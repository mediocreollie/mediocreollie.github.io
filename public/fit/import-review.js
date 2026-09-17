/* Image bytes stay in this browser tab; only confirmed structured chart data is saved. */
(function(){
 const $=id=>document.getElementById(id);let job=0,worker=null,imageUrl=null,rows=[],applied=null;
 const empty=()=>({size:'',values:Object.fromEntries(FitChart.keys.map(k=>[k,'']))});
 function message(text){$('ocrStatus').textContent=text;}
 function stop(){job++;const w=worker;worker=null;if(w)w.terminate().catch(()=>{});$('cancelImport').hidden=true;}
 function releaseImage(){if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;$('uploadImage').removeAttribute('src');$('uploadPreview').classList.remove('show');}
 function reset(){stop();releaseImage();rows=[];applied=null;$('reviewPanel').hidden=true;$('sourceText').value='';$('reviewRows').replaceChildren();$('reviewSize').replaceChildren();$('reviewConfirmed').checked=false;$('sizeImage').value='';message('Choose an image or enter a table manually.');}
 function invalidate(){applied=null;$('reviewConfirmed').checked=false;$('confirmChart').checked=false;clearComparison();}
 function renderRows(){
  const body=$('reviewRows');body.replaceChildren();
  rows.forEach((row,i)=>{
   const tr=document.createElement('tr');
   ['size',...FitChart.keys].forEach(key=>{
    const td=document.createElement('td'),input=document.createElement('input');input.value=key==='size'?row.size:row.values[key];input.type='text';input.maxLength=key==='size'?30:30;input.setAttribute('aria-label',(key==='size'?'Size name':dimensionNames[key])+' for row '+(i+1));
    input.addEventListener('input',()=>{if(key==='size')row.size=input.value;else row.values[key]=input.value;invalidate();refreshSizes();});td.append(input);tr.append(td);
   });
   const td=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Remove';button.setAttribute('aria-label','Remove row '+(i+1));button.onclick=()=>{rows.splice(i,1);invalidate();renderRows();};td.append(button);tr.append(td);body.append(tr);
  });refreshSizes();
 }
 function refreshSizes(){const selected=$('reviewSize').value;$('reviewSize').replaceChildren();const prompt=document.createElement('option');prompt.value='';prompt.textContent='Choose a size';$('reviewSize').append(prompt);rows.forEach((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=r.size||'Unnamed row '+(i+1);$('reviewSize').append(o)});if(rows[Number(selected)]&&selected!=='')$('reviewSize').value=selected;}
 function parseText(){invalidate();const parsed=FitChart.parse($('sourceText').value);rows=parsed.rows.length?parsed.rows:[empty()];$('reviewWarnings').textContent=parsed.warnings.join(' ')||'All extracted cells are unverified. Check every size and measurement against the source.';renderRows();$('reviewPanel').hidden=false;}
 async function read(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){message('Choose a PNG, JPEG or WebP image under 10 MB. Your current draft has been kept.');return;}
  reset();invalidate();const token=job;imageUrl=URL.createObjectURL(file);$('uploadImage').src=imageUrl;$('uploadPreview').classList.add('show');$('cancelImport').hidden=false;message('Reading image in this browser…');
  let localWorker;
  try{
   // Reject decompressed images that would use excessive memory in the OCR worker.
   await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.width*img.height>20000000?reject(Error('Image is too large. Crop the size chart and try again.')):resolve();img.onerror=()=>reject(Error('This image could not be opened.'));img.src=imageUrl;});
   const T=await loadOcrLibrary();if(token!==job)return;
   localWorker=await T.createWorker('eng',1,{logger:m=>{if(token===job&&m.status==='recognizing text')message('Reading image: '+Math.round(m.progress*100)+'%');}});
   if(token!==job){await localWorker.terminate();return;}worker=localWorker;
   const result=await localWorker.recognize(file);if(token!==job)return;
   $('sourceText').value=(result.data.text||'').slice(0,32000);parseText();message('Reading finished. Review the table before using any measurements.');
  }catch(err){if(token===job){rows=[empty()];renderRows();$('reviewPanel').hidden=false;$('reviewWarnings').textContent='Automatic reading failed. Copy the values from the image, or enter a table manually.';message(err.message||'Could not read this image.');}}
  finally{if(localWorker&&worker===localWorker){worker=null;await localWorker.terminate().catch(()=>{});}if(token===job)$('cancelImport').hidden=true;}
 }
 $('chooseImage').onclick=()=>$('sizeImage').click();
 $('sizeImage').onchange=()=>{const file=$('sizeImage').files[0];if(file)read(file)};
 const zone=$('uploadZone');['dragenter','dragover'].forEach(n=>zone.addEventListener(n,e=>{e.preventDefault();zone.classList.add('drag')}));['dragleave','drop'].forEach(n=>zone.addEventListener(n,e=>{e.preventDefault();zone.classList.remove('drag')}));zone.addEventListener('drop',e=>{if(e.dataTransfer.files[0])read(e.dataTransfer.files[0])});
 $('cancelImport').onclick=()=>{stop();message('Reading cancelled. The image is available for manual review.');rows=[empty()];renderRows();$('reviewPanel').hidden=false;};
 $('discardImport').onclick=reset;
 $('manualTable').onclick=()=>{stop();invalidate();if(!rows.length)rows=[empty()];renderRows();$('reviewPanel').hidden=false;};
 $('parseText').onclick=()=>{stop();parseText();};
 $('sourceText').addEventListener('input',invalidate);
 $('addSize').onclick=()=>{if(rows.length>=12){$('reviewWarnings').textContent='A maximum of 12 sizes can be reviewed at once.';return;}rows.push(empty());invalidate();renderRows();};
 $('reviewSize').onchange=invalidate;
 $('applyImport').onclick=()=>{
  try{
   FitChart.validate(rows);const index=$('reviewSize').value;if(index===''||!rows[Number(index)])throw Error('Choose the size to compare.');if(!$('reviewConfirmed').checked)throw Error('Confirm you checked the table against the source.');
   const selected=rows[Number(index)];FitChart.keys.forEach(k=>$('c'+k[0].toUpperCase()+k.slice(1)).value=selected.values[k]||'');$('sizeName').value=selected.size;
   applied={version:1,rows:structuredClone(rows),selectedSize:selected.size,sourceText:$('sourceText').value.slice(0,32000)};
   $('confirmChart').checked=false;clearComparison();message('Selected size copied. Confirm the chart type, units and methods below before comparing.');$('chartType').focus();
  }catch(err){$('reviewWarnings').textContent=err.message;}
 };
 $('compareForm').addEventListener('input',e=>{if(e.target.id==='sizeName'||/^c(?:Chest|Waist|Hip|Shoulder|Length|Sleeve|Inseam)$/.test(e.target.id))applied=null;});
 $('manualEntry').onclick=()=>{reset();$('c'+FitMeasurements.dimensions[$('category').value][0].replace(/^./,c=>c.toUpperCase())).focus();};
 window.FitImport={reset,pending:()=>!applied&&(!$('reviewPanel').hidden||!$('cancelImport').hidden),snapshot:()=>applied?structuredClone(applied):null};
 window.addEventListener('pagehide',reset);
})();
