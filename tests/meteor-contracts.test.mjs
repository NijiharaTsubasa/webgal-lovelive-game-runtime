import assert from 'node:assert/strict';
import test from 'node:test';
import {linearToSRGB,outputReference,assessOutput} from './helpers/meteor-output-reference.mjs';

test('independent output reference covers transfer threshold, coverage conventions and alpha zero',()=>{
 assert.ok(Math.abs(linearToSRGB(.002)-.02584)<1e-15);
 assert.ok(Math.abs(linearToSRGB(.137)-.40584268252341077)<.00001);
 const base={input:[.137*.371,.731*.371,.002371*.371,.371],remainingAlpha:false,encodeSRGB:false,premultiplyOutput:true};
 assert.deepEqual(outputReference(base),[13,69,0,95]);
 assert.deepEqual(outputReference({...base,premultiplyOutput:false}),[35,186,1,95]);
 assert.deepEqual(outputReference({...base,remainingAlpha:true,input:[...base.input.slice(0,3),1-.371]}),outputReference(base));
 assert.deepEqual(outputReference({...base,input:[0,0,0,0],encodeSRGB:true}),[0,0,0,0]);
 const good={...base,contextPremultipliedAlpha:true,actualBytes:[13,69,0,95],glErrors:[]};
 assert.equal(assessOutput([good])[0].passed,true);
 assert.equal(assessOutput([{...good,actualBytes:[30,69,0,95]}])[0].passed,false);
 assert.equal(assessOutput([{...good,glErrors:[1282]}])[0].passed,false);
 assert.equal(assessOutput([{...good,contextPremultipliedAlpha:false}])[0].passed,false);
 assert.equal(assessOutput([{...good,actualBytes:[15,69,0,95]}])[0].passed,true);
 assert.equal(assessOutput([{...good,actualBytes:[16,69,0,95]}])[0].passed,false);
 assert.deepEqual(outputReference({...base,input:[.137,.731,.002371,1]}),[35,186,1,255]);
 assert.deepEqual(outputReference({...base,input:[.137,.731,.002371,-.1],encodeSRGB:true}),[0,0,0,0]);
});
