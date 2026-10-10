import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {validateAsset,detailedImage,cropImage} from '../src/assets.mjs';
test('detail textures use original pixels and preserve precise crop alignment',async()=>{
 const source=await sharp({create:{width:3600,height:2400,channels:3,background:'#fff'}}).composite([{input:Buffer.from('<svg width="3600" height="2400"><rect width="1800" height="2400" fill="red"/><text x="180" y="180" font-size="70">Readable original artwork</text></svg>')}]).png().toBuffer();
 const overview=await validateAsset(source,'front');
 const detailed=await detailedImage(source);
 assert.equal((await sharp(overview.texture).metadata()).width,1536);
 assert.equal((await sharp(detailed).metadata()).width,3600);
 const crop={ratio:1,x:0,y:0.5,zoom:2};
 const saved=await cropImage(source,crop);
 const close=await detailedImage(source,saved.details);
 const result=await sharp(close).stats();
 assert.equal((await sharp(close).metadata()).width,4096);
 assert.ok(result.channels[0].mean>240 && result.channels[1].mean<15);
});
