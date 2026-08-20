import { readFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const PK = process.env.PRIVATE_KEY;
if (!PK) { throw new Error("PRIVATE_KEY missing. Run: node --env-file=.env test.mjs"); }
const source = readFileSync("contracts/prediction_market.py", "utf8");
const code = new TextEncoder().encode(source);
const QUESTION = "According to the cited sources, has Ethereum completed 'The Merge' and now runs on Proof-of-Stake?";
const RULES = "Resolve YES if the evidence clearly states Ethereum completed The Merge and uses Proof-of-Stake. Resolve NO if it clearly states it has not. Otherwise UNRESOLVED.";
const GOOD1 = "https://en.wikipedia.org/wiki/The_Merge";
const GOOD2 = "https://en.wikipedia.org/wiki/Ethereum";

const account = createAccount(PK);
const client = createClient({ chain: testnetBradbury, account });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const pass = (n) => console.log("PASS -", n);
const fail = (n, extra) => { console.log("FAIL -", n, extra ?? ""); failed++; };
const read = (addr) => client.readContract({ address: addr, functionName: "get_state", args: [] });
const isRevert = (r) => (r === "FINISHED_WITH_ERROR" || r === "REVERTED");
const histLen = (s) => { try { return JSON.parse(s?.history || "[]").length; } catch { return 0; } };
const isCollision = (e) => { const m = String(e?.message || e); return m.includes("consensus contract") || m.includes("EVM tx"); };

async function deploy(q, rules, s1, s2, s3) {
  let h = null;
  for (let attempt = 1; attempt <= 25; attempt++) {
    try { h = await client.deployContract({ code, args: [q, rules, s1, s2, s3] }); break; }
    catch (e) { if (isCollision(e)) { await sleep(20000); continue; } throw e; }
  }
  if (!h) throw new Error("deploy submit failed after retries");
  await client.waitForTransactionReceipt({ hash: h, status: TransactionStatus.ACCEPTED, retries: 300 });
  const tx = await client.getTransaction({ hash: h });
  const addr = tx?.txDataDecoded?.contractAddress ?? tx?.recipient;
  if (!addr || tx?.txExecutionResultName !== "FINISHED_WITH_RETURN") throw new Error("deploy failed: " + tx?.txExecutionResultName);
  return addr;
}
async function call(addr, fn, args) {
  let h = null;
  for (let attempt = 1; attempt <= 25; attempt++) {
    try { h = await client.writeContract({ address: addr, functionName: fn, args, value: 0 }); break; }
    catch (e) { if (isCollision(e)) { await sleep(20000); continue; } return "REVERTED"; }
  }
  if (!h) return "SUBMIT_TIMEOUT";
  try { await client.waitForTransactionReceipt({ hash: h, status: TransactionStatus.ACCEPTED, retries: 300 }); }
  catch (e) { return "REVERTED"; }
  for (let i = 0; i < 120; i++) {
    const tx = await client.getTransaction({ hash: h });
    const r = tx?.txExecutionResultName;
    if (r && r !== "NOT_VOTED") return r;
    await sleep(5000);
  }
  return "NOT_VOTED";
}
async function waitLeaves(addr, fromStatus) {
  let s;
  for (let i = 0; i < 220; i++) { s = await read(addr); if (s?.status !== fromStatus) return s; await sleep(5000); }
  return s;
}
async function waitHistory(addr, minLen) {
  let s;
  for (let i = 0; i < 220; i++) { s = await read(addr); if (histLen(s) >= minLen) return s; await sleep(5000); }
  return s;
}

console.log("### TEST 1: live multi-source resolution (expect YES) ###");
const c1 = await deploy(QUESTION, RULES, GOOD1, GOOD2, "");
console.log("market contract:", c1);
console.log("resolve:", await call(c1, "resolve", []));
const s1 = await waitLeaves(c1, "open");
console.log("final status:", s1?.status, "| outcome:", s1?.outcome);
(s1?.status === "resolved" && s1?.outcome === "YES") ? pass("resolved YES from real sources") : fail("expected resolved YES", JSON.stringify(s1));

console.log("### TEST 2: cannot resolve twice ###");
const r2 = await call(c1, "resolve", []);
isRevert(r2) ? pass("double resolve reverted") : fail("expected revert on double resolve", r2);

console.log("### TEST 3: cannot add source after resolved ###");
const r3 = await call(c1, "add_source", ["https://example.com"]);
isRevert(r3) ? pass("late add_source reverted") : fail("expected revert on late add_source", r3);

console.log("### TEST 4: cannot resolve with no source configured ###");
const c2 = await deploy(QUESTION, RULES, "", "", "");
const r4 = await call(c2, "resolve", []);
isRevert(r4) ? pass("resolve without source reverted") : fail("expected revert without source", r4);

console.log("### TEST 5: reject non-http source URL ###");
const r5 = await call(c2, "add_source", ["ftp://evil.example/x"]);
isRevert(r5) ? pass("non-http source rejected") : fail("expected revert on bad URL", r5);

console.log("### TEST 6: dispute re-runs resolution and records history ###");
const d1 = await call(c1, "dispute", ["I believe the sources were misread, please re-check."]);
const s6 = await waitHistory(c1, 2);
(!isRevert(d1) && s6?.status === "resolved" && histLen(s6) === 2 && ["YES", "NO", "UNRESOLVED"].includes(s6?.outcome)) ? pass("dispute processed, history has 2 rounds") : fail("dispute did not process as expected", JSON.stringify({ d1, status: s6?.status, hist: histLen(s6), outcome: s6?.outcome }));

console.log("### TEST 7: dispute with empty reason reverts ###");
const r7 = await call(c1, "dispute", ["   "]);
isRevert(r7) ? pass("empty dispute reason reverted") : fail("expected revert on empty dispute", r7);

console.log("### TEST 8: cannot dispute before resolution ###");
const c3 = await deploy(QUESTION, RULES, GOOD1, "", "");
const r8 = await call(c3, "dispute", ["Trying to dispute too early."]);
isRevert(r8) ? pass("dispute before resolution reverted") : fail("expected revert on early dispute", r8);

console.log("### TEST 9: dispute limit enforced (max 2) ###");
const d2 = await call(c1, "dispute", ["Second dispute, please re-examine once more."]);
await waitHistory(c1, 3);
const d3 = await call(c1, "dispute", ["Third dispute should be blocked."]);
(!isRevert(d2) && isRevert(d3)) ? pass("second dispute ok, third dispute capped") : fail("dispute cap not enforced", JSON.stringify({ d2, d3 }));

console.log("=====================================");
console.log(failed === 0 ? "ALL TESTS PASSED" : (failed + " TEST(S) FAILED"));
process.exitCode = failed === 0 ? 0 : 1;
