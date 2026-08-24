# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class PayProbe2(gl.Contract):
    note: str

    @gl.public.write
    def probe_proxy(self) -> str:
        # What does a ContractProxy actually offer? This tells us whether any
        # value-bearing call exists in THIS runner.
        p = gl.get_contract_at(Address("0x61fd0047595A30A067f1F21F3b28C4AE8A8e3Dc3"))
        return "|".join(sorted([n for n in dir(p) if not n.startswith("_")]))

    @gl.public.write
    def probe_msg(self) -> str:
        return "|".join(sorted([n for n in dir(gl.message) if not n.startswith("_")]))

    @gl.public.write
    def probe_vm(self) -> str:
        return "|".join(sorted([n for n in dir(gl.vm) if not n.startswith("_")]))

    @gl.public.write.payable
    def fund(self) -> str:
        return "ok"
