import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const helpers = html.slice(html.indexOf("function preventiveDate("), html.indexOf("function fmtPlannedDate("));
const dateHelper = html.match(/function fmtPlannedDate\(value\)\{[\s\S]*?\n\}/)[0];
const { preventiveDate, fmtPlannedDate } = new Function(`${helpers}\n${dateHelper};return {preventiveDate,fmtPlannedDate};`)();

test("preventive dates reject blank and impossible dates and retain leap days", () => {
  for (const value of ["", "2026-02-30", "2026-02-29", "13/10/2026", "not-a-date"])
    assert.throws(() => preventiveDate(value));
  assert.equal(preventiveDate("2028-02-29"), "2028-02-29");
  assert.equal(preventiveDate("2026-10-13"), "2026-10-13");
});

test("scheduled dates display without converting midnight to another time zone", () => {
  assert.equal(fmtPlannedDate("2026-10-13"), "13/10/2026");
  assert.equal(fmtPlannedDate(null), "");
});

test("preventive form stores date and all read surfaces include it", () => {
  const panel = html.slice(html.indexOf("async function openPreventivePanel()"), html.indexOf("function closeHistoryPanel()"));
  assert.match(panel, /id="preventiveDate" type="date" required/);
  assert.match(panel, /scheduled_for=preventiveDate/);
  assert.match(panel, /equipment_id:eq,scheduled_for/);
  assert.match(panel, /if\(creating\)return/);
  assert.match(panel, /createButton\.disabled=true/);
  assert.match(panel, /finally\{creating=false;createButton\.disabled=false/);
  assert.match(panel, /if\(sr\.error\)throw sr\.error/);
  assert.match(panel, /status,scheduled_for,created_at/);
  assert.match(html, /Data programada:.*fmtPlannedDate\(x\.scheduled_for\)/);
  assert.match(html, /status,scheduled_for,opened_at/);
});

test("admin preventive RLS change is narrow and preserves existing policies and records", async () => {
  const sql = await readFile(new URL("../supabase/preventive_scheduling.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists scheduled_for date/);
  assert.match(sql, /for insert to authenticated/);
  for (const guard of ["maintenance_access_ready()", "requester_id = auth.uid()", "p.active", "p.role = 'admin'", "scheduled_for is not null", "p.organization_id = work_orders.organization_id"])
    assert.ok(sql.includes(guard), guard);
  assert.doesNotMatch(sql, /disable row level security|delete from|truncate |drop table/i);
  assert.match(sql, /title like 'Manutenção preventiva · %'/);
});

async function formHarness({date="2026-10-20", insertError=null}={}) {
  const ids=["preventiveEquipment","preventiveSector","preventiveDate","preventiveDescription","createPreventive","preventiveMsg","preventiveRecent"];
  const nodes=Object.fromEntries(ids.map(id=>[id,{value:"",innerHTML:"",disabled:false}]));
  nodes.preventiveEquipment.value="machine";
  nodes.preventiveSector.value="sector";
  nodes.preventiveDate.value=date;
  nodes.preventiveDescription.value="Trocar filtro";
  const state={attempts:[],rows:[],pushes:[],loads:0,markup:""};
  const equipment=[{id:"machine",name:"Máquina teste",sector_id:"sector",active:true}];
  const sectors=[{id:"sector",name:"Setor teste",active:true}];
  const sb={from(table){
    let inserted;
    const query={
      select(){return query},eq(){return query},order(){return query},ilike(){return query},limit(){return query},
      insert(payload){inserted=payload;state.attempts.push(payload);return query},
      async single(){
        if(insertError)return {error:insertError};
        state.rows.push({...inserted,id:"new-preventive",equipment:{name:"Máquina teste"}});
        return {data:{id:"new-preventive"},error:null};
      },
      then(resolve,reject){return Promise.resolve({data:table==="equipment"?equipment:table==="sectors"?sectors:state.rows,error:null}).then(resolve,reject)},
    };return query;
  }};
  const panel=html.slice(html.indexOf("async function openPreventivePanel()"),html.indexOf("function closeHistoryPanel()"));
  const open=new Function("sb","profile","session","$","adminOnly","openAdminModal","escapeHtml","notice","triggerPush","loadTickets","fmt","labels","showError",
    `let currentAdminModal;${helpers}\n${dateHelper}\n${panel};return openPreventivePanel;`)(
    sb,{organization_id:"organization"},{user:{id:"admin"}},id=>nodes[id],()=>true,
    (_title,markup)=>{state.markup=markup},value=>String(value),
    (node,message,ok)=>{node.message=message;node.ok=ok},
    async(id,event)=>{state.pushes.push({id,event})},async()=>{state.loads++},()=>"",{open:"Aberto"},error=>{throw error},
  );
  await open(); await new Promise(resolve=>setImmediate(resolve));
  return {nodes,state};
}

test("preventive submit sends date, refreshes recent list and prevents concurrent duplicate clicks", async () => {
  const {nodes,state}=await formHarness();
  const first=nodes.createPreventive.onclick();
  assert.equal(nodes.createPreventive.disabled,true);
  await nodes.createPreventive.onclick();
  await first;
  assert.equal(state.attempts.length,1);
  assert.equal(state.attempts[0].scheduled_for,"2026-10-20");
  assert.equal(state.attempts[0].requester_id,"admin");
  assert.equal(state.attempts[0].equipment_id,"machine");
  assert.equal(nodes.preventiveDescription.value,"");
  assert.match(nodes.preventiveRecent.innerHTML,/20\/10\/2026/);
  assert.equal(state.loads,1);
  assert.deepEqual(state.pushes,[{id:"new-preventive",event:"created"}]);
  assert.equal(nodes.createPreventive.disabled,false);
});

test("missing date prevents submission, and rejected inserts retain the typed description", async () => {
  const empty=await formHarness({date:""});
  await empty.nodes.createPreventive.onclick();
  assert.equal(empty.state.attempts.length,0);
  assert.match(empty.nodes.preventiveMsg.message,/data programada/);
  const rejected=await formHarness({insertError:{message:"Acesso recusado"}});
  await rejected.nodes.createPreventive.onclick();
  assert.equal(rejected.nodes.preventiveDescription.value,"Trocar filtro");
  assert.equal(rejected.nodes.createPreventive.disabled,false);
  assert.equal(rejected.state.pushes.length,0);
  assert.equal(rejected.nodes.preventiveMsg.message,"Acesso recusado");
});
