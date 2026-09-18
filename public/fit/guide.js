/* Copy for the accessible body and garment measurement diagrams. */
(function(root){
 const guides={
  tee:{title:'T-shirt measurement map',text:'Match the chart meaning first. Body measurements go around you; garment measurements are taken from the clothing.',tips:['Chest: around the body, or across a flat garment then doubled.','Shoulder: point to point across the upper back or garment seam.','Length: from the high shoulder point down to the hem.','Sleeve: from the shoulder point to the sleeve end.']},
  trousers:{title:'Trouser measurement map',text:'Waist and hip may be body circumferences or flat garment widths. Inseam follows the inside leg.',tips:['Waist: around the natural waist, or across the waistband then doubled.','Hip: around the fullest seat, or across the garment then doubled.','Inseam: from the crotch seam to the lower hem along the inside leg.']}
 };
 function content(category){return structuredClone(guides[category]||guides.tee);}
 root.FitGuide={content};
})(globalThis);
