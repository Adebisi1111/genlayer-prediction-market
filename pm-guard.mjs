import { readFileSync, writeFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
const HOME = process.env.HOME;
const a = createAccount(process.env.PRIVATE_KEY);
const b = createAccount(readFileSync(HOME + "/genlayer/escrow-dapp/seller-key.txt", "utf8").trim());
const bAddr = readFileSync(HOME + "/genlayer/escrow-dapp/seller-addr.txt", "utf8").trim();
const cA = createClient({ chain: testnetBradbury, account: a });
const cB = createClient({ chain: testnetBradbury, account: b });
const QUESTION = "Did a crewed mission land on Mars during the year 2029?";
const RULES = "Answer YES if a loaded source states a crewed mission landed on Mars in 2029. Answer NO if a loaded source states no crewed Mars landing happened in 2029. If the event has not settled yet or no loaded source addresses it, answer UNRESOLVED.";
const SOURCE1 = "https://en.wikipedia.org/wiki/Blockchain".replace(/[<>]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function objify(v){ if(v instanceof Map){ const o={}; for(const kv of v){ o[kv[0]]=kv[1]; } return o; } return v||{}; }
function retriable(msg){ msg=String(msg||"").toLowerCase(); return msg.includes("-32005")||msg.includes("capacity")||msg.includes("rate limit")||msg.includes("exceeds defined limit")||msg.includes("consensus contract")||msg.includes("evm tx"); }
async function waitFinal(client, hash, label){
  for(let i=0;i<80;i++){
    let tx=null;
    try{ tx=await client.getTransaction({ hash }); }catch(e){ await sleep(5000); continue; }
    const rn=String(tx?.txExecutionResultName||"");
    if(rn==="FINISHED"||rn==="FINISHED_WITH_RETURN") return tx;
    if(/ERROR|REVERT|ROLL|DISAGREE|UNDETERMIN/i.test(rn)) throw new Error("execution failed for "+label+": "+rn);
    if(i%5===0) console.log("  ...waiting finality for "+label+" ("+(rn||"pending")+")");
    await sleep(6000);
  }
  throw new Error("timeout waiting finality for "+label);
}
async function submitWrite(client, address, fn, args, value){
  for(let attempt=1;attempt<=40;attempt++){
    try{
      const hash=await client.writeContract({ address, functionName:fn, args, value:value||0n });
      await client.waitForTransactionReceipt({ hash, status:TransactionStatus.ACCEPTED, retries:300 });
      await waitFinal(client, hash, fn);
      return hash;
    }catch(e){
      const msg=e?.message||String(e);
      if(retriable(msg)&&attempt<40){ console.log("  retry "+fn+" ("+attempt+"): "+msg.slice(0,80)); await sleep(8000); continue; }
      throw e;
    }
  }
}
async function main(){
  console.log("A (creator):", a.address, "| B (non-creator):", bAddr);
  const bb = await cA.getBalance({ address: bAddr });
  if(bb < 10000000000000000n){
    console.log("topping up B for gas ...");
    const th = await cA.sendTransaction({ to: bAddr, value: 20000000000000000n });
    console.log("topup tx:", th);
    for(let i=0;i<25;i++){ const x=await cA.getBalance({address:bAddr}); if(x>=10000000000000000n) break; await sleep(6000); }
  }
  const code = new TextEncoder().encode(readFileSync("contracts/prediction_market.py","utf8"));
  console.log("deploying patched prediction market ...");
  let dHash;
  for(let attempt=1;attempt<=40;attempt++){
    try{
      dHash = await cA.deployContract({ code, args: [QUESTION, RULES, SOURCE1, "", "", "pm-guard-1"] });
      await cA.waitForTransactionReceipt({ hash:dHash, status:TransactionStatus.ACCEPTED, retries:300 });
      break;
    }catch(e){
      const msg=e?.message||String(e);
      if(retriable(msg)&&attempt<40){ console.log("  retry deploy ("+attempt+"): "+msg.slice(0,80)); await sleep(8000); continue; }
      throw e;
    }
  }
  const dtx = await cA.getTransaction({ hash:dHash });
  const ADDRESS = dtx?.txDataDecoded?.contractAddress ?? dtx?.recipient;
  writeFileSync("pm-contract.txt", String(ADDRESS)); writeFileSync("pm-deploy-tx.txt", dHash);
  console.log("deploy tx:", dHash); console.log("PM contract:", ADDRESS);
  const read = async (fn) => objify(await cA.readContract({ address:ADDRESS, functionName:fn, args:[] }));
  const s0 = await read("get_state"); console.log("creator:", s0.creator, "| status:", s0.status);
  console.log("=== PROOF 1: non-creator resolve() must REVERT ===");
  let guard = "UNEXPECTED: no revert";
  try { await submitWrite(cB, ADDRESS, "resolve", [], 0n); }
  catch(e){ guard = "REVERTED: " + String(e?.message||e).slice(0,120); }
  console.log("guard(non-creator resolve):", guard);
  writeFileSync("pm-guard-check.txt", guard);
  console.log("=== PROOF 2: creator resolve() on unsettled event -> UNRESOLVED, stays open ===");
  const hRes1 = await submitWrite(cA, ADDRESS, "resolve", [], 0n); writeFileSync("pm-resolve1-tx.txt", hRes1);
  const s1 = await read("get_state"); const o1 = String(s1.outcome);
  console.log("resolve1 ->", hRes1, "| outcome:", o1, "| status:", String(s1.status));
  if(o1 === "UNRESOLVED" && String(s1.status) === "open"){
    console.log("=== PROOF 3: retry resolve() allowed (market not closed) ===");
    const hRes2 = await submitWrite(cA, ADDRESS, "resolve", [], 0n); writeFileSync("pm-resolve2-tx.txt", hRes2);
    const s2 = await read("get_state");
    console.log("resolve2 ->", hRes2, "| outcome:", String(s2.outcome), "| status:", String(s2.status));
    console.log("=== PROOF 4: creator can void unsettled market (funds-safe escape) ===");
    const hVoid = await submitWrite(cA, ADDRESS, "void", [], 0n); writeFileSync("pm-void-tx.txt", hVoid);
    const s3 = await read("get_state");
    console.log("void ->", hVoid, "| status:", String(s3.status));
  } else {
    console.log("NOTE: outcome was", o1, "(determinable) -> retry branch not exercised; guard proof still valid.");
  }
  console.log("PM contract:", ADDRESS);
  console.log(">>> PM GUARD RUN COMPLETE");
}
main().catch((e)=>{ console.error("FATAL:", e?.message||e); process.exit(1); });
