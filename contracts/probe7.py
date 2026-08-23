# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class Probe7(gl.Contract):
    m_positions: TreeMap[str, str]
    m_paid: TreeMap[str, u256]

    # Does a private (non-decorated) helper method break deployment?
    def _sum(self, positions: str, who: str, side: str) -> int:
        total = 0
        for p in positions.split("|"):
            if not p:
                continue
            pp = p.split(":")
            if len(pp) < 3:
                continue
            if pp[0] == who and pp[1] == side:
                total += int(pp[2])
        return total

    @gl.public.write
    def seed(self) -> None:
        self.m_positions["m1"] = "0xaa:YES:100|0xaa:YES:50|0xbb:NO:70"

    @gl.public.view
    def total(self, who: str, side: str) -> str:
        return str(self._sum(self.m_positions.get("m1", ""), who, side))

    @gl.public.view
    def my_bal(self) -> str:
        return str(int(gl.get_contract_at(gl.message.contract_address).balance))
