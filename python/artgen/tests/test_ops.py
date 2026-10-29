"""The methods generated from the operation registry (``_ops.py``), run against the real CLI on a copy of the fixture project."""
import json

import pytest

from artgen import Artgen, ArtgenError, Result
from artgen._ops import _OPS, Ops


def test_the_table_and_the_methods_agree():
    assert len(_OPS) > 100
    for name, (words, positionals, flags) in _OPS.items():
        method = name.replace(".", "_").replace("-", "_")
        assert hasattr(Ops, method), name
        assert all(flag.startswith("--") for flag, _kind in flags.values()), name
        assert words == tuple(name.split(".")), name
    assert "bench" not in _OPS  # this repo's benchmark has no Python method
    # a method written by hand wins over the generated one; the others are the mixin's
    assert "render" in Artgen.__dict__ and "dungeon_new" not in Artgen.__dict__


def test_formats_and_brief_list(project, cli):
    ag = Artgen(project, cli=cli)
    f = ag.formats()
    assert isinstance(f, Result) and set(f) == {"map", "dungeon", "settlement"}
    assert {b["id"] for b in ag.brief_list()} >= {"hero", "skeleton-knight"}


def test_dungeon_new_and_check_with_a_size_and_a_list(project, cli):
    ag = Artgen(project, cli=cli)
    ag.dungeon_new("cell", room="rect", room_size=(6, 6), exits=["n", "e:secret"], seed=3, title="Cell")
    file = project / "art" / "dungeons" / "cell" / "dungeon.json"
    assert json.loads(file.read_text())["title"] == "Cell"
    checked = ag.dungeon_check("cell")
    assert isinstance(checked, Result)
    # --file stands in for the id
    assert ag.dungeon_check(file=str(file)) == checked


def test_settlement_facts(project, cli):
    ag = Artgen(project, cli=cli)
    ag.settlement_new("mill", kind="hamlet", seed=4)
    facts = ag.settlement_facts("mill")
    assert isinstance(facts, Result) and facts


def test_an_on_off_flag_and_a_json_flag(project, cli):
    ag = Artgen(project, cli=cli)
    ag.map_new("isle", preset="regional", size="14x10", seed=4)
    file = project / "art" / "maps" / "isle" / "map.json"
    ag.map_gen("isle", seed=6, topo_labels=True)
    spec = json.loads(file.read_text())
    assert spec["seed"] == 6 and spec["topo"]["labels"] is True
    ag.map_gen("isle", topo_labels=False)
    assert json.loads(file.read_text())["topo"]["labels"] is False
    ag.map_update("isle", gen={"sea": 0.4}, legend=False)
    spec = json.loads(file.read_text())
    assert spec["gen"]["sea"] == 0.4 and spec["legend"] is False


def test_a_flag_with_several_values_and_an_error_from_the_cli(project, cli):
    ag = Artgen(project, cli=cli)
    ag.map_new("isle", size="14x10", seed=4)
    assert isinstance(ag.map_facts("isle", at=["3,3", "C4"]), Result)
    with pytest.raises(ArtgenError, match="--above"):
        ag.map_facts("isle", above="sky")


def test_commands_only_the_cli_had(project, cli):
    ag = Artgen(project, cli=cli)
    c = ag.conformance("barrel")
    assert c["pass"] is True and c.code == 0
    assert ag.direction_show(candidate="a")["id"]
