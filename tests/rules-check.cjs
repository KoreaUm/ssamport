// Uses the signed-in Firebase CLI account and the Rules test API; no user data is written.
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const globalRoot=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['root','-g'],{encoding:'utf8'}).trim();
const cli=path.join(globalRoot,'firebase-tools/lib');
const auth=require(path.join(cli,'auth'));
const {requireAuth}=require(path.join(cli,'requireAuth'));
const {Client}=require(path.join(cli,'apiv2'));
const project='school-2d277';
const user={email:'rules-test@example.com',displayName:'Test',role:'user',gradeAccess:false,active:true,approved:true};
const request=(method,data)=>({method,path:'/databases/(default)/documents/users/test-user',auth:{uid:'test-user',token:{email:user.email}},resource:{data}});
(async()=>{
 const account=auth.getGlobalDefaultAccount();
 await requireAuth({project,...account});
 const client=new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
 const source={files:[{name:'firestore.rules',content:fs.readFileSync(path.join(__dirname,'../firebase-firestore.rules'),'utf8')}]};
 const cases=[
  ['signup user','ALLOW',request('create',user)],
  ['signup admin','DENY',request('create',{...user,role:'admin'})],
  ['signup grade access','DENY',request('create',{...user,gradeAccess:true})],
  ['signup extra privilege field','DENY',request('create',{...user,deleted:false})],
  ['signup other identity','DENY',{...request('create',user),auth:{uid:'other',token:{email:user.email}}}],
  ['profile name update','ALLOW',request('update',{...user,displayName:'Changed'}),{data:user}],
  ['profile promote admin','DENY',request('update',{...user,role:'admin'}),{data:user}],
  ['profile reset deleted','DENY',request('update',{...user,deleted:false}),{data:{...user,deleted:true}}],
  ['admin manages user','ALLOW',{...request('update',{...user,gradeAccess:true}),auth:{uid:'admin',token:{email:'admin@example.com'}}},{data:user},{...user,role:'admin'}],
  ['disabled admin denied','DENY',{...request('update',{...user,gradeAccess:true}),auth:{uid:'admin',token:{email:'admin@example.com'}}},{data:user},{...user,role:'admin',active:false}],
  ['anonymous signup denied','DENY',{...request('create',user),auth:null}]
 ];
 const response=await client.post(`/projects/${project}:test`,{source,testSuite:{testCases:cases.map(([,expectation,request,resource,mockUser])=>({expectation,request,...(resource?{resource}:{}),functionMocks:[{function:'get',args:[{anyValue:{}}],result:{value:{data:mockUser||user}}}]}))}},{skipLog:{body:true,resBody:true}});
 const results=response.body.testResults||[];
 if(response.body.issues?.length)console.log(JSON.stringify(response.body.issues));
 results.forEach((result,i)=>console.log(cases[i][0]+': '+result.state));
 if(results.length!==cases.length||results.some(r=>r.state!=='SUCCESS')){console.log(JSON.stringify(response.body));process.exitCode=1;}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
