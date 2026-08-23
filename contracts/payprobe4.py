# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class PayProbe4(gl.Contract):
    note: str

    @gl.public.write.payable
    def fund(self) -> str:
        return "ok"

    # Bradbury finalization is far slower than acceptance, so a transfer with
    # onAcceptance=False leaves winners waiting indefinitely. Probe whether the
    # runner lets us settle at ACCEPTANCE instead.

    @gl.public.write
    def sig(self) -> str:
        p = gl.get_contract_at(gl.message.sender_address)
        import inspect
        try:
            return "emit_transfer" + str(inspect.signature(p.emit_transfer))
        except Exception as e:
            return "no-signature: " + str(e)[:120]

    @gl.public.write
    def pay_on_acceptance(self, amount: str) -> str:
        gl.get_contract_at(gl.message.sender_address).emit_transfer(
            value=u256(int(amount)), on_acceptance=True
        )
        return "sent-on-acceptance"

    @gl.public.write
    def pay_kw_onAcceptance(self, amount: str) -> str:
        gl.get_contract_at(gl.message.sender_address).emit_transfer(
            value=u256(int(amount)), onAcceptance=True
        )
        return "sent-onAcceptance"
