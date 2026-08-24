# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Diagnostic: what does a validator actually see when it fetches a source?"""

from genlayer import *


class Probe(gl.Contract):
    log: TreeMap[str, str]

    @gl.public.write
    def look(self, url: str) -> str:
        """Return a fingerprint of the fetched page so we can see what arrived."""

        def f() -> str:
            page = gl.nondet.web.render(url, mode="text")
            head = page[:300].replace("\n", " ")
            return f"len={len(page)} head={head}"

        out = gl.eq_principle.strict_eq(f)
        self.log["look"] = str(out)
        return str(out)

    @gl.public.write
    def judge(self, url: str, question: str) -> str:
        """Full judge path: fetch, filter, prompt — return the raw LLM verdict."""

        def f() -> str:
            page = gl.nondet.web.render(url, mode="text")
            terms = [w.strip("?$,.").lower() for w in question.split() if len(w) > 3]
            hits = []
            for line in page.splitlines():
                ls = line.strip()
                if len(ls) < 20:
                    continue
                if any(t in ls.lower() for t in terms):
                    hits.append(ls)
                if len(hits) >= 40:
                    break
            evidence = "\n".join(hits) if hits else page[:2000]
            verdict = gl.nondet.exec_prompt(
                "You are resolving a prediction market from a cited source.\n"
                f"QUESTION: {question}\n\n"
                f"SOURCE EXCERPTS:\n{evidence[:4000]}\n\n"
                "Answer with exactly one word: YES if the excerpts show the "
                "question resolved true, NO if they show it resolved false, or "
                "UNKNOWN if they do not settle it. One word only."
            )
            return f"raw={verdict.strip()[:120]} evidence_len={len(evidence)} hits={len(hits)}"

        out = gl.eq_principle.strict_eq(f)
        self.log["judge"] = str(out)
        return str(out)

    @gl.public.view
    def read(self, key: str) -> str:
        return self.log.get(key, "")
