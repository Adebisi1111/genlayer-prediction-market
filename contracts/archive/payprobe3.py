# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class PayProbe3(gl.Contract):
    note: str

    @gl.public.write.payable
    def fund(self) -> str:
        return "ok"

    @gl.public.write
    def payout(self, to: str, amount: str) -> str:
        # THE candidate payout primitive for this runner:
        #   gl.get_contract_at(addr).emit_transfer(value=...)
        gl.get_contract_at(Address(to)).emit_transfer(value=u256(int(amount)))
        return "sent"

    @gl.public.view
    def my_balance(self) -> str:
        return str(gl.get_contract_at(gl.message.contract_address).balance)
