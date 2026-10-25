// Pure CPU test reference extracted from the diagnostic tool; arithmetic preserved.
export function linearToSRGB(value) {return value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055;}
export function outputReference({input,remainingAlpha,encodeSRGB,premultiplyOutput}) {
  const coverage=Math.min(1,Math.max(0,remainingAlpha?1-input[3]:input[3]));
  return [...input.slice(0,3).map(v=>{let straight=coverage>0?v/coverage:0;if(encodeSRGB)straight=linearToSRGB(straight);return premultiplyOutput?straight*coverage:straight;}),coverage].map(v=>Math.round(Math.min(1,Math.max(0,v))*255));
}
export function assessOutput(records,toleranceBytes=2) {
  return records.map(record=>{const expectedBytes=outputReference(record),errors=expectedBytes.map((v,i)=>Math.abs(v-record.actualBytes[i]));return {...record,expectedBytes,maxErrorBytes:Math.max(...errors),toleranceBytes,passed:Math.max(...errors)<=toleranceBytes&&record.glErrors.length===0&&record.contextPremultipliedAlpha===record.premultiplyOutput};});
}
