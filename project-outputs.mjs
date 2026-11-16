import fs from 'node:fs';
import path from 'node:path';
const allowed = new Set(['.md','.txt','.json','.csv','.html','.pdf','.png','.jpg','.jpeg','.webp','.xlsx','.docx','.pptx','.svg']);
function safeRoot(root,parent) {
  try {const real=fs.realpathSync(root),base=fs.realpathSync(parent);return real.startsWith(base+path.sep)?real:null;}catch{return null;}
}
export function listOutputs(overview) {
  const files=[];
  function walk(root,dir,prefix,depth=0) {
    if(!root||!fs.existsSync(dir)||depth>4||files.length>=64)return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())walk(root,full,prefix,depth+1);
      else if(entry.isFile()&&allowed.has(path.extname(full).toLowerCase())) {
        const stat=fs.statSync(full);files.push({id:prefix+'/'+path.relative(root,full).split(path.sep).join('/'),name:entry.name,size:stat.size,updated:stat.mtime.toISOString()});
      }
      if(files.length>=64)break;
    }
  }
  const outputRoot=safeRoot(overview.outputs,overview.workingCopy);if(outputRoot)walk(outputRoot,outputRoot,'deliverables');
  if(overview.office&&safeRoot(overview.office,path.dirname(overview.office)))for(const name of ['FINAL.md']){const f=path.join(overview.office,name);if(fs.existsSync(f)&&!fs.lstatSync(f).isSymbolicLink()&&fs.statSync(f).isFile()){const st=fs.statSync(f);files.push({id:'office/'+name,name:'Výsledek · '+name,size:st.size,updated:st.mtime.toISOString()});}}
  // Markdown twins of rendered pages are hidden; the summary page comes first.
  const ids=new Set(files.map(f=>f.id));
  const shown=files.filter(f=>!(/\.md$/i.test(f.id)&&ids.has(f.id.replace(/\.md$/i,'.html')))&&!(f.id==='office/FINAL.md'&&ids.has('deliverables/Souhrn.html')));
  return shown.sort((a,b)=>(b.name==='Souhrn.html')-(a.name==='Souhrn.html')||b.updated.localeCompare(a.updated));
}
export function outputPath(overview,id) {
  const listed=listOutputs(overview).find(f=>f.id===id);if(!listed)throw new Error('Soubor není mezi výstupy projektu.');
  const [prefix,...parts]=id.split('/'),root=fs.realpathSync(prefix==='office'?overview.office:overview.outputs),file=fs.realpathSync(path.join(root,...parts));
  if(!file.startsWith(root+path.sep))throw new Error('Soubor je mimo projekt.');
  return file;
}
export function outputPreview(overview,id) {
  const file=outputPath(overview,id),ext=path.extname(file).toLowerCase();
  const kind=['.png','.jpg','.jpeg','.webp'].includes(ext)?'image':['.md','.txt','.json','.csv','.html','.svg'].includes(ext)?'text':'document';
  let content=null;if(kind==='text'){const fd=fs.openSync(file,'r');try{const b=Buffer.alloc(Math.min(fs.statSync(file).size,1024*1024));fs.readSync(fd,b);content=b.toString('utf8');}finally{fs.closeSync(fd);}}
  return {name:path.basename(file),kind,content,truncated:kind==='text'&&fs.statSync(file).size>1024*1024};
}
