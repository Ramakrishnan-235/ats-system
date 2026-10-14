import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = 'http://localhost:3000/core-api/api/v1';
const jobId = 'c5c3b72d-9a02-49bf-a2c8-0f8f4939108d';
const existingId = '82f6f979-b8de-434f-9b49-64b78135febd';
const newId = 'ea10408a-7409-4662-be5f-142478d4d589';
const testedIds = [existingId, newId, '70cb2485-54fb-466b-abcc-41aaf30cf8ce'];
async function json(path) { const response = await fetch(base + path); assert.equal(response.status, 200); return response.json(); }
let rows;
for (let i=0;i<60;i++) {
  rows = await json(`/jobs/${jobId}/candidates`);
  if (testedIds.every(id => rows.find(row=>row.id===id)?.matchScore != null)) break;
  await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.equal(rows.length,3);
for (const id of testedIds) {
  const row = rows.find(value=>value.id===id);
  assert.equal(row.jobId,jobId); assert.equal(typeof row.matchScore,'number');
  const scorecard = await json(`/candidates/${id}/scorecard?job_id=${jobId}`);
  assert.equal(scorecard.overall_match_score,row.matchScore);
}
const candidate = await json(`/candidates/${newId}?include_pii=true`);
assert.equal(candidate.name,'Synthetic New Applicant');
assert.equal(candidate.role,'Python Backend Engineer');
assert.equal(candidate.processing_status,'COMPLETED');
assert.ok(candidate.core_skills.includes('Python'));
const resume = await fetch(`${base}/candidates/${newId}/resume-pdf`);
assert.equal(resume.status,200);
assert.equal(Buffer.from(await resume.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
const proof = { job_id:jobId, candidates:rows.map(({id,jobId,matchScore,stage})=>({id,jobId,matchScore,stage})), new_candidate_name:candidate.name, new_candidate_role:candidate.role, extracted_skills:candidate.core_skills, processing_status:candidate.processing_status, original_pdf_retrieved:true };
fs.writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
