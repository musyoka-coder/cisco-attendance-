const assert=require('node:assert/strict');
const test=require('node:test');
const parser=require('../learner-import.js');
const XLSX=require('../vendor/xlsx.full.min.js');
test('names normalize and duplicates are caught without losing row numbers',()=>{
 const result=parser.parseRows([['Full Name'],['  Jane   Doe '],['jane doe'],['Anne O’Neil'],['']]);
 assert.equal(result[0].name,'Jane Doe');assert.equal(result[0].row,2);
 assert.equal(result[1].error,'Duplicate in file');assert.equal(result[2].error,'');
});
test('plain list, header aliases, and multi-column heading selection',()=>{
 assert.equal(parser.parseRows([['Jane Doe'],['John Doe']]).length,2);
 assert.equal(parser.parseRows([['ID','Student Name'],[1,'Jane Doe']])[0].name,'Jane Doe');
 assert.throws(()=>parser.parseRows([['1','Jane Doe']]));
});
test('invalid names, formulas, and empty files cannot silently import',()=>{
 for(const value of ['<img onerror=x>','Name|Other','123','A','=SUM(A1)'])assert.ok(parser.validate(value));
 assert.ok(parser.parseRows([['Full Name'],[{v:'Jane Doe',f:'A1'}]])[0].error);
 assert.throws(()=>parser.parseRows([]));
 assert.throws(()=>parser.parseRows([['Full Name']]));
 assert.throws(()=>parser.parseRows(Array.from({length:1001},()=>['Jane Doe'])));
});
test('actual xlsx and xls workbook round trips retain names',()=>{
 for(const bookType of ['xlsx','xls']){
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Full Name'],['Jane Doe'],['Anne O’Neil']]),'Learners');
  const read=XLSX.read(XLSX.write(workbook,{type:'buffer',bookType}),{type:'buffer'});
  const rows=XLSX.utils.sheet_to_json(read.Sheets.Learners,{header:1});
  assert.equal(parser.parseRows(rows).filter(e=>!e.error).length,2);
 }
});
