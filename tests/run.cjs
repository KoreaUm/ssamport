const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(require('electron'),['--test',path.join(__dirname,'regressions.cjs')],{
  stdio:'inherit', env:{...process.env,ELECTRON_RUN_AS_NODE:'1',TZ:'Asia/Seoul'}
});
if(result.error)console.error(result.error);
process.exit(result.status??1);
