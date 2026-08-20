import { readFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
const j = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
const PK = process.env.PRIVATE_KEY;
const CONTRACT = readFileSync("contract.txt", "utf8").trim();
const client = createClient({ chain: testnetBradbury, account: createAccount(PK) });

console.log("=== CURRENT STATE ===");
const s = await client.readContract({ address: CONTRACT, functionName: "get_state", args: [] });
console.log("status:", s.status, "| outcome:", s.outcome, "| history:", s.history);

console.log("=== RESOLVE TX (full dump) ===");
const RES = "0x6bef2019bdb2fbb40204f459530b1c1ddd4c6358147ad89bb12750d2a1273b93";
const tx = await client.getTransaction({ hash: RES });
console.log("top-level keys:", Object.keys(tx || {}).join(", "));
console.log("statusName:", tx?.statusName);
console.log("txExecutionResultName:", tx?.txExecutionResultName);
const dump = j(tx);
console.log(dump.length > 4000 ? dump.slice(0, 4000) + "\n...(truncated)" : dump);
