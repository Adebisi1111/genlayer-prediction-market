# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class PayProbe(gl.Contract):
    log: TreeMap[str, str]

    # Each method probes ONE candidate transfer-out API. Whichever returns
    # FINISHED_WITH_RETURN *and* moves balance is the real payout primitive.

    @gl.public.write
    def a_eth_send(self, to: str) -> str:
        gl.eth_send(Address(to), 10**16)
        return "a"

    @gl.public.write
    def b_transfer(self, to: str) -> str:
        gl.transfer(Address(to), 10**16)
        return "b"

    @gl.public.write
    def c_send_value(self, to: str) -> str:
        gl.send_value(Address(to), 10**16)
        return "c"

    @gl.public.write
    def d_msg_value(self, to: str) -> str:
        gl.message.send(Address(to), 10**16)
        return "d"

    @gl.public.write
    def e_contract_at(self, to: str) -> str:
        gl.ContractAt(Address(to)).emit_transfer(value=10**16)
        return "e"

    @gl.public.write
    def f_evm_proxy(self, to: str) -> str:
        gl.evm.ContractProxy(Address(to)).emit_transfer(value=10**16)
        return "f"

    @gl.public.write
    def g_dir(self) -> str:
        # Enumerate what the runner actually exposes.
        return "|".join(sorted([n for n in dir(gl) if not n.startswith("_")]))

    @gl.public.write.payable
    def fund(self) -> str:
        return "funded"
