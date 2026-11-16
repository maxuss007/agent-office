import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {listOutputs,outputPath,outputPreview} from '../project-outputs.mjs';
test('floating results list real deliverables and final report, with project boundaries and symlink protection',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'office-output-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'office-other-'));
 const o={workingCopy:root,outputs:path.join(root,'deliverables'),office:path.join(root,'office')};
 try{fs.mkdirSync(o.outputs);fs.mkdirSync(o.office);fs.writeFileSync(path.join(o.outputs,'brief.md'),'Actual result');fs.writeFileSync(path.join(o.office,'FINAL.md'),'Final report');fs.writeFileSync(path.join(outside,'secret.md'),'private');fs.symlinkSync(path.join(outside,'secret.md'),path.join(o.outputs,'link.md'));
 assert.equal(listOutputs(o).length,2);assert.equal(outputPreview(o,'deliverables/brief.md').content,'Actual result');assert.throws(()=>outputPath(o,'deliverables/../../secret.md'));assert.throws(()=>outputPath(o,'deliverables/link.md'));
 fs.unlinkSync(path.join(o.outputs,'brief.md'));fs.unlinkSync(path.join(o.outputs,'link.md'));fs.rmdirSync(o.outputs);fs.symlinkSync(outside,o.outputs);assert.equal(listOutputs(o).length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});
