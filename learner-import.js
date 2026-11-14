/* Spreadsheet parsing is kept separate so it can be tested without Supabase. */
const LearnerImport = (() => {
  const normalize = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const key = value => normalize(value).toLowerCase();
  function validate(value) {
    const name = normalize(value);
    if (name.length < 2 || name.length > 120) return 'Name must contain 2–120 characters';
    if (!/\p{L}/u.test(name) || /[<>|\x00-\x1f\x7f]/.test(name)) return 'Invalid name';
    if (/^[=+@]/.test(name)) return 'Formula-like names are not accepted';
    return '';
  }
  function parseRows(rows) {
    const populated = rows.map((cells, i) => ({cells, row: i + 1}))
      .filter(r => r.cells.some(c => normalize(c?.v ?? c) !== ''));
    if (!populated.length) throw new Error('The selected sheet is empty.');
    const cellValue = c => c && typeof c === 'object' ? c.v : c;
    const headings = populated[0].cells.map(c => key(cellValue(c)).replace(/[_-]/g, ' '));
    let column = headings.findIndex(h => ['full name', 'name', 'student name', 'learner name', 'full names', 'names'].includes(h));
    let source = populated;
    if (column >= 0) source = populated.slice(1);
    else {
      if (populated.some(r => r.cells.filter(c => normalize(cellValue(c)) !== '').length > 1))
        throw new Error('Use a Full Name heading when the sheet has multiple columns.');
      column = populated[0].cells.findIndex(c => normalize(cellValue(c)) !== '');
    }
    if (source.length > 1000) throw new Error('Import no more than 1,000 learners at a time.');
    if (!source.length) throw new Error('No learners found below the heading.');
    const seen = new Set();
    return source.map(r => {
      const cell = r.cells[column];
      const name = normalize(cellValue(cell));
      let error = cell?.f ? 'Formula cells are not accepted' : validate(name);
      if (!error && seen.has(key(name))) error = 'Duplicate in file';
      if (!error) seen.add(key(name));
      return {row: r.row, name, error};
    });
  }
  return {normalize, key, validate, parseRows};
})();
if (typeof module !== 'undefined') module.exports = LearnerImport;

async function readAll(query) {
  const rows = [];
  for (let offset = 0;; offset += 1000) {
    const {data, error} = await query().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
function initYearSelect() {
  const select = document.getElementById('academic-year');
  select.replaceChildren();
  for (let year = 2026; year <= 2100; year++) {
    const option = document.createElement('option');
    option.value = year; option.textContent = year; option.selected = year === academicYear;
    select.appendChild(option);
  }
}
async function changeAcademicYear(value) {
  const next = Number(value), previous = academicYear;
  if (!Number.isInteger(next) || next < 2026 || next > 2100 || next === previous) return;
  const root = document.getElementById('app-root');root.inert = true;
  const message = document.getElementById('year-message');message.textContent = 'Loading register…';
  clearTimeout(autoSaveTimer);autoSaveTimer = null;
  try {
    // Freeze the UI, wait for prior saves, and flush remaining changes before changing date mappings.
    if (databaseReady && !await saveAll()) throw new Error('Save the current register before changing year.');
    const backup = {store, reports, challengeItems, studentIdByName, sessionIdCache,
      milimani: [...MILIMANI], coram: [...CORAM_DEO], databaseReady};
    academicYear = next;
    try { await loadData(); }
    catch (error) {
      academicYear = previous;
      ({store, reports, challengeItems, studentIdByName, sessionIdCache, databaseReady} = backup);
      MILIMANI.splice(0, MILIMANI.length, ...backup.milimani);
      CORAM_DEO.splice(0, CORAM_DEO.length, ...backup.coram);
      throw error;
    }
    centerView = {};selectedForBulk.clear();resetImportPreview();
    WEEKS = getWeeksWithDays(currentCenter);
    const index = findCurrentIndex(WEEKS);currentWeek = index.wi;currentDay = index.di;
    renderAll();renderUptime();renderReports();
    if (document.getElementById('section-dashboard').style.display !== 'none') renderDashboard();
    message.textContent = `${academicYear} register loaded`;
  } catch (error) {message.textContent = error.message;}
  finally {document.getElementById('academic-year').value = academicYear;root.inert = false;}
}
let importReadVersion = 0;
function resetImportPreview() {
  importReadVersion++;importPreview = null;
  document.getElementById('import-preview').replaceChildren();
  document.getElementById('import-confirm').hidden = true;
  document.getElementById('learner-file').value = '';
  document.getElementById('learner-message').textContent = '';
}
function downloadLearnerTemplate() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Full Name']]), 'Learners');
  XLSX.writeFile(workbook, 'Learner_Import_Template.xlsx');
}
async function previewLearnerFile(file) {
  importPreview = null;const version = ++importReadVersion;
  const message = document.getElementById('learner-message');
  document.getElementById('import-preview').replaceChildren();
  document.getElementById('import-confirm').hidden = true;
  if (!file) return;
  const centre = currentCenter, year = academicYear;
  try {
    if (!databaseReady) throw new Error('Connect to the database before importing learners.');
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an Excel or CSV file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds the 5 MB limit.');
    message.textContent = 'Reading file…';
    const bytes = await file.arrayBuffer();
    if (version !== importReadVersion) return;
    const workbook = XLSX.read(bytes, {type:'array', cellFormula:true, sheetRows:1003});
    const sheetName = workbook.SheetNames[0], sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) throw new Error('The first sheet is empty.');
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
    if (range.e.r > 1001 || range.e.c > 100) throw new Error('Use a compact sheet with at most 1,000 learners and 100 columns.');
    const rows = [];
    for (let row = 0; row <= range.e.r; row++) {
      const cells = [];
      for (let col = 0; col <= range.e.c; col++) cells.push(sheet[XLSX.utils.encode_cell({r:row,c:col})] || '');
      rows.push(cells);
    }
    const entries = LearnerImport.parseRows(rows);
    const existingRows = await readAll(()=>sb.from('students').select('id,full_name').eq('centre_id',centreIdByName[centre]).eq('academic_year',year).order('id'));
    if (version !== importReadVersion) return;
    const existing = new Set(existingRows.map(s=>LearnerImport.key(s.full_name)));
    entries.forEach(entry=>{if (!entry.error && existing.has(LearnerImport.key(entry.name))) entry.error = 'Already enrolled (skipped)';});
    importPreview = {centre, year, entries};
    const table = document.createElement('table');table.className = 'reg-table';
    const header = table.createTHead().insertRow();
    ['Row','Full name','Result'].forEach(label=>{const th=document.createElement('th');th.textContent=label;header.appendChild(th);});
    const body=table.createTBody();
    entries.forEach(entry=>{const row=body.insertRow();[entry.row,entry.name,entry.error || 'Ready'].forEach(value=>row.insertCell().textContent=value);});
    document.getElementById('import-preview').appendChild(table);
    const valid = entries.filter(e=>!e.error).length;
    message.textContent = `Sheet: ${sheetName}. ${valid} ready; ${entries.length-valid} skipped or invalid. Target: ${centre}, ${year}. Review before importing.`;
    document.getElementById('import-confirm').hidden = !valid;
  } catch (error) {if (version===importReadVersion) message.textContent=error.message;}
}
async function persistLearners(names, centre, year) {
  if (!databaseReady || !sb) throw new Error('Database unavailable. No learners were saved.');
  const {data, error} = await sb.rpc('enrol_learners', {p_centre_id:centreIdByName[centre],p_academic_year:year,p_names:names});
  if (error) throw error;
  return data;
}
async function addLearner() {
  const input=document.getElementById('learner-name'), name=LearnerImport.normalize(input.value);
  const message=document.getElementById('learner-message');
  const error=LearnerImport.validate(name);if(error){message.textContent=error;return;}
  const root=document.getElementById('app-root');root.inert=true;
  try {
    const result=await persistLearners([name],currentCenter,academicYear);
    resetImportPreview();input.value='';
    message.textContent=result.inserted ? `${name} added to ${currentCenter}, ${academicYear}.` : 'Learner already enrolled; no duplicate added.';
    try {await loadCentresAndStudents();renderAll();}catch(e){message.textContent+=' Saved, but the register could not refresh. Reload the page.';}
  } catch(e){message.textContent='Could not add learner: '+e.message;}
  finally{root.inert=false;}
}
async function confirmLearnerImport() {
  const preview=importPreview;
  if(!preview || preview.centre!==currentCenter || preview.year!==academicYear)return;
  const names=preview.entries.filter(e=>!e.error).map(e=>e.name);if(!names.length)return;
  const root=document.getElementById('app-root');root.inert=true;
  const message=document.getElementById('learner-message');message.textContent='Saving learners…';
  try {
    const result=await persistLearners(names,preview.centre,preview.year);
    resetImportPreview();
    message.textContent=`${result.inserted} learners added to ${preview.centre}, ${preview.year}; ${result.skipped} already enrolled. ${preview.entries.length-names.length} rows skipped during preview.`;
    try{await loadCentresAndStudents();renderAll();}catch(e){message.textContent+=' Saved, but the register could not refresh. Reload the page.';}
  }catch(e){message.textContent='Import failed: '+e.message+'. The import can be retried safely; existing names will be skipped.';}
  finally{root.inert=false;}
}
