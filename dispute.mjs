import { readFileSync, writeFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const PK = process.env.PRIVATE_KEY;
if (!PK) { throw new Error("PRIVATE_KEY missing. Run: node --env-file=.env dispute.mjs"); }
const CONTRACT = readFileSync("contract.txt", "utf8").trim();
const client = createClient({ chain: testnetBradbury, account: createAccount(PK) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = () => client.readContract({ address: CONTRACT, functionName: "get_state", args: [] });

console.log("CONTRACT:", CONTRACT);
let s = await read();
console.log("status:", s.status, "| outcome:", s.outcome, "| history:", s.history);
if (s.status !== "resolved") { console.log("Not resolved yet - aborting."); process.exit(1); }

const NOTE = "This is wrong - the Merge never actually happened, the outcome should be NO.";
let h2 = null;
for (let attempt = 1; attempt <= 15; attempt++) {
  try {
    console.log("dispute submit attempt " + attempt + " ...");
    h2 = await client.writeContract({ address: CONTRACT, functionName: "dispute", args: [NOTE], value: 0 });
    console.log("dispute tx:", h2);
    break;
  } catch (e) {
    console.log("submit reverted (prior tx likely still finalizing), retry in 30s:", String(e?.message || e).slice(0, 100));
    await sleep(30000);
  }
}
if (!h2) { console.log("!!! Could not submit dispute after retries."); process.exit(1); }

await client.waitForTransactionReceipt({ hash: h2, status: TransactionStatus.ACCEPTED, retries: 300 });
console.log("waiting for dispute to COMMIT (history -> 2)...");
let fin;
for (let i = 0; i < 220; i++) {
  fin = await read();
  let h = []; try { h = JSON.parse(fin.history || "[]"); } catch {}
  if (h.length >= 2) break;
  await sleep(5000);
}
let execResult = "NOT_VOTED";
for (let i = 0; i < 120; i++) {
  const tx = await client.getTransaction({ hash: h2 });
  const r = tx?.txExecutionResultName;
  if (r && r !== "NOT_VOTED") { execResult = r; break; }
  await sleep(5000);
}
console.log("dispute execution result:", execResult);
console.log("=====================================");
console.log("OUTCOME AFTER DISPUTE:", fin?.outcome, "| STATUS:", fin?.status);
console.log("RATIONALE:", fin?.rationale);
let hist = []; try { hist = JSON.parse(fin?.history || "[]"); } catch {}
console.log("HISTORY ROUNDS:", hist.length);
for (const it of hist) console.log("  round " + it.round + " [" + it.kind + "] -> " + it.outcome);
console.log("dispute tx:", h2);
console.log("=====================================");
writeFileSync("dispute-tx.txt", String(h2));
