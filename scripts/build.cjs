const fs=require('node:fs');
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
for(const file of ['index.html','learner-import.js','appraisal.html','appraisal.js','appraisal-config.js','appraisal.css','survey.html','survey.js'])fs.copyFileSync(file,'dist/'+file);
fs.cpSync('vendor','dist/vendor',{recursive:true});
console.log('Static register, appraisal and survey pages built.');
