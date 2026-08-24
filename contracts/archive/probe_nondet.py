# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Isolation probe: which nondeterministic primitive actually reaches consensus
on Bradbury? Each method exercises one layer so a stall can be attributed.
"""

from genlayer import *


class Probe(gl.Contract):
    log: TreeMap[str, str]

    @gl.public.write
    def web_strict(self) -> str:
        """Web fetch only, strict equality. No LLM."""

        def f() -> str:
            page = gl.nondet.web.render("https://example.com", mode="text")
            return "HIT" if "Example" in page else "MISS"

        out = gl.eq_principle.strict_eq(f)
        self.log["web_strict"] = str(out)
        return str(out)

    @gl.public.write
    def llm_strict(self) -> str:
        """LLM only, strict equality. No web."""

        def f() -> str:
            v = gl.nondet.exec_prompt(
                "Reply with exactly one word: YES. Nothing else."
            )
            return "YES" if "YES" in v.strip().upper() else "OTHER"

        out = gl.eq_principle.strict_eq(f)
        self.log["llm_strict"] = str(out)
        return str(out)

    @gl.public.write
    def llm_comparative(self) -> str:
        """LLM under comparative consensus."""

        def f() -> str:
            v = gl.nondet.exec_prompt(
                "Reply with exactly one word: YES. Nothing else."
            )
            return "YES" if "YES" in v.strip().upper() else "OTHER"

        out = gl.eq_principle.prompt_comparative(f, "Both must answer YES")
        self.log["llm_comparative"] = str(out)
        return str(out)

    @gl.public.view
    def read(self, key: str) -> str:
        return self.log.get(key, "")
