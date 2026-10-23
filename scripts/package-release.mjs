import {mkdtemp, mkdir, readFile, readdir, lstat, cp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=process.cwd(), manifest=JSON.parse(await readFile('package.json','utf8'));
if(manifest.name!=='project-plannr'||manifest.version!=='1.0.0')throw Error('Review the public release version before packaging.');
const name=`project-plannr-${manifest.version}`, temp=await mkdtemp(join(tmpdir(),'plannr-release-')), stage=join(temp,name);
const files=['README.md','LICENSE','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md','.env.example','package.json','package-lock.json','server.mjs','agent.mjs','board.js','board-client.js','board.css','prototype.html','ticket-priority.js','ticket-checklist.js','check.mjs','app-stylr.json',
'netlify/functions','netlify.toml','lib','assets','vendor/app-stylr','scripts','test','examples/project-import.json','docs/self-hosting.md','docs/agent-api.md','docs/project-onboarding.md','docs/ticket-writing.md','docs/app-stylr-exceptions.md'];
async function safeCopy(source,target){const entry=await lstat(source);if(entry.isSymbolicLink())throw Error('Release input must not be a symlink: '+source);if(entry.isDirectory()){await mkdir(target,{recursive:true});for(const file of await readdir(source))await safeCopy(join(source,file),join(target,file));}else{await mkdir(resolve(target,'..'),{recursive:true});await cp(source,target);}}
try{
 for(const file of files)await safeCopy(join(root,file),join(stage,file));
 await writeFile(join(stage,'.gitignore'),'node_modules/\ndata/\ndist/\n.env\n.env.*\n!.env.example\nreleases/\noutputs/\n');
 await writeFile(join(stage,'AGENTS.md'),'# Project Plannr\n\nRead README.md before changing the app. Preserve App Stylr roles, local data, origin/CSRF checks, project-scoped agent access, optimistic concurrency, and transactional audit. Use only disposable fixtures for tests. Run npm run check and npm run build. Do not publish, deploy, or change live workspaces without explicit approval.\n');
 const output=resolve('releases');await mkdir(output,{recursive:true});
 const archive=join(output,name+'.tar.gz');execFileSync('tar',['-czf',archive,'-C',temp,name],{env:{...process.env,COPYFILE_DISABLE:'1'}});
 const list=execFileSync('tar',['-tzf',archive],{encoding:'utf8'});
 if(list.split('\n').some(p=>/(^|\/)\.env$|\/data\/|\/node_modules\/|\/docs\/screenshots\/|\/\.git\//.test(p)))throw Error('Unexpected private/runtime files in archive.');
 await writeFile(join(output,'CONTENTS.txt'),list);
 await writeFile(join(output,'SHA256SUMS'),createHash('sha256').update(await readFile(archive)).digest('hex')+'  '+name+'.tar.gz\n');
 console.log('Packaged '+name+'.tar.gz with manifest and SHA-256.');
}finally{await rm(temp,{recursive:true,force:true});}
