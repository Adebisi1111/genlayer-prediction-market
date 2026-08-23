# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class PayProbe5(gl.Contract):
    note: str

    @gl.public.write.payable
    def fund(self) -> str:
        return "ok"

    # Real signature (probed on chain):
    #   emit_transfer(*, value: u256, on: ON = 'finalized')
    # Default 'finalized' is too slow on Bradbury, so pay on acceptance.
    @gl.public.write
    def pay_accepted(self, amount: str) -> str:
        gl.get_contract_at(gl.message.sender_address).emit_transfer(
            value=u256(int(amount)), on="accepted"
        )
        return "sent"

    @gl.public.write
    def on_values(self) -> str:
        # Enumerate the allowed ON values so we use a valid literal.
        try:
            import genlayer.py.types as t
            return str(getattr(t, "ON", "no ON in types"))
        except Exception as e:
            return "err: " + str(e)[:150]
