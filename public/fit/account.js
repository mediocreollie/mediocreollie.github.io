/* Account data stays in memory while signed in. Guest data is never auto-uploaded. */
(async function(){
const $=id=>document.getElementById(id), status=message=>$("cloudStatus").textContent=message;
let client,user=null,ready=false,revision=null,dirty=false,chain=Promise.resolve(),epoch=0;
const shell=document.querySelector(".shell");
function lock(value){shell.inert=value; $("profileSelect").disabled=value; $("addProfileTop").disabled=value;}
function clearPrivateView(){
 document.querySelectorAll("dialog[open]").forEach(d=>d.close());
 document.querySelectorAll("form").forEach(f=>f.reset());
 $("result").textContent="Enter measurements to compare a size.";
 $("visualTitle").textContent="Measurement guide"; $("visualNotes").textContent="";
 $("visualText").textContent="Choose a category to see where its measurements are taken.";
 $("uploadPreview").classList.remove("show"); $("uploadImage").removeAttribute("src");
}
function valid(v){return window.FitData.valid(v);}
function queueSave(){
 if(!user){try{localStorage.setItem(KEY,JSON.stringify(data));status("Saved in this browser only.")}catch{status("Browser storage unavailable. Keep this tab open.")}return;}
 if(!ready){status("Cloud is not ready. Load your account before editing.");return;}
 dirty=true; status("Saving to your account…");
 const snapshot=structuredClone(data), id=user.id, token=epoch;
 chain=chain.then(async()=>{
  if(token!==epoch||!ready)return;
  const next=(revision||0)+1;
  let q=client.from("fit_accounts");
  q=revision===null?q.insert({user_id:id,payload:snapshot,revision:next}):q.update({payload:snapshot,revision:next}).eq("user_id",id).eq("revision",revision);
  const result=await q.select("revision").single();
  if(token!==epoch)return;
  if(result.error){ready=false;status("Not saved to cloud: "+result.error.message+". Keep this tab open. Retry, or load the latest copy if another device changed it.");return;}
  revision=result.data.revision;
  dirty=JSON.stringify(data)!==JSON.stringify(snapshot);
  status(dirty?"Saving latest changes…":"Saved to your account.");
 }).catch(err=>{ready=false;status("Not saved: "+err.message+". Keep this tab open and retry.");});
}
window.fitCloud={save:queueSave};
async function loadAccount(session,force=false){
 const next=session?.user||null;
 if(!force&&next?.id===user?.id)return;
 epoch++;const token=epoch;user=next;ready=false;dirty=false;revision=null;
 lock(true);clearPrivateView();data=structuredClone(defaultData);render();
 $("authForm").hidden=!!user; $("accountControls").hidden=!user;
 if(!user){data=load();render();lock(false);status("Guest mode. Saved only in this browser.");return;}
 $("accountEmail").textContent="Signed in as "+user.email;
 status("Loading your saved profiles…");
 try{
 const result=await client.from("fit_accounts").select("payload,revision").eq("user_id",user.id).maybeSingle();
 if(token!==epoch)return;
 if(result.error)throw result.error;
 if(result.data){if(!valid(result.data.payload))throw Error("Saved profile format needs repair");data=result.data.payload;revision=result.data.revision;}
 ready=true;render();lock(false);status(result.data?"Cloud profiles loaded.":"Account ready. Add measurements or import your browser profiles.");
 }catch(err){if(token===epoch)status("Could not load cloud data: "+err.message+". Complete database setup, then load again.");}
}
lock(true);
try{
 const sdk=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
 client=sdk.createClient("https://fxsfiybuzvwjpqqmazdv.supabase.co","sb_publishable_z4ZRsKP5JWaGxEFPihqDzQ_ayiaNXIb");
 const initial=await client.auth.getSession(); if(initial.error)throw initial.error;
 await loadAccount(initial.data.session,true);
 client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>loadAccount(session),0);});
 $("authForm").onsubmit=async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;status("Contacting account service…");
  try{
  const credentials={email:$("authEmail").value.trim(),password:$("authPassword").value};
  const result=button.name==="signup"?await client.auth.signUp({...credentials,options:{emailRedirectTo:"https://olliewritesthings.com/fit/"}}):await client.auth.signInWithPassword(credentials);
  if(result.error)throw result.error;
  $("authPassword").value="";
  if(result.data.session)await loadAccount(result.data.session);
  else status("Check your email to confirm the account, then sign in.");
  }catch(err){status(err.message)}finally{button.disabled=false}
 };
 $("signOut").onclick=async()=>{
  if(dirty&&!confirm("Some changes have not reached the cloud. Sign out and discard them?"))return;
  await chain;
  const result=await client.auth.signOut({scope:"local"});
  if(result.error){status(result.error.message);return;}
  await loadAccount(null,true);
 };
 $("cloudReload").onclick=async()=>{
  if(dirty&&!confirm("Discard unsaved changes and load the latest cloud copy?"))return;
  await chain;
  const result=await client.auth.getSession();
  await loadAccount(result.data.session,true);
 };
 $("cloudRetry").onclick=()=>{if(!user)return;if(!ready&&!dirty){$("cloudReload").click();return;}ready=true;queueSave();};
 $("importGuest").onclick=()=>{
  if(!ready){status("Load cloud profiles before importing.");return;}
  const guest=load();
  if(!valid(guest)||!confirm("Copy all guest profiles on this browser into this account? Only import your own or authorised profiles."))return;
  const copies=structuredClone(guest.profiles).map(p=>({...p,id:crypto.randomUUID()}));
  data.profiles.push(...copies);data.active=copies[0].id;render();queueSave();
 };
 window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
}catch(err){lock(!!user);status("Accounts unavailable: "+err.message+(user?". Reload to reconnect.":". Guest mode still works."));}
})();
