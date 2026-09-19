/* Backwards-compatible payload validation for browser and cloud profiles. */
(function(root){
 function valid(value){
  return !!(value&&Array.isArray(value.profiles)&&value.profiles.length&&value.profiles.every(profile=>typeof profile.id==='string'&&typeof profile.name==='string'&&['cm','in'].includes(profile.unit)&&profile.measurements&&typeof profile.measurements==='object'&&Array.isArray(profile.garments)&&Array.isArray(profile.comparisons)));
 }
 root.FitData={valid};
})(globalThis);
