const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serve}=require('../scripts/serve.cjs');
test('preview serves only the public build root and handles missing files',async()=>{
 const server=await serve('vendor',0);
 try {
 const url='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(url+'/xlsx.full.min.js')).status,200);
 assert.equal((await fetch(url+'/missing')).status,404);
 assert.equal((await fetch(url+'/%2e%2e%2fpackage.json')).status,403);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
