"""The client against the real CLI on a copy of the iso-dungeon fixture (no mocks: the CLI is the contract)."""
import json
from pathlib import Path

import pytest
from PIL import Image

from artgen import Artgen, ArtgenError, Render, Sheet, Texture, find_cli

from conftest import REPO


def test_find_cli(tmp_path, cli, monkeypatch):
    monkeypatch.delenv("ARTGEN_CLI", raising=False)
    with pytest.raises(FileNotFoundError, match="tools/artgen/artgen.js"):
        find_cli(tmp_path)
    (tmp_path / "tools" / "artgen").mkdir(parents=True)
    (tmp_path / "tools" / "artgen" / "artgen.js").write_text("")
    assert find_cli(tmp_path) == (tmp_path / "tools" / "artgen" / "artgen.js").resolve()
    assert find_cli(tmp_path, cli) == cli.resolve()
    monkeypatch.setenv("ARTGEN_CLI", str(cli))
    assert find_cli(tmp_path) == cli.resolve()


def test_status_and_direction(project, cli):
    ag = Artgen(project, cli=cli)
    rows = ag.status()
    assert {r["id"] for r in rows} >= {"hero", "skeleton-knight", "floor"}
    assert all(r["status"] == "exported" for r in rows)
    assert ag.direction()["locked"]["id"]
    assert [r["id"] for r in ag.status("slime")] == ["slime"]


def test_texture_returns_pillow_images_and_metrics(project, cli):
    tex = Artgen(project, cli=cli).texture("stone", size=16, seed=7)
    assert isinstance(tex, Texture)
    assert tex.tile.size == (16, 16) and tex.normal.size == (16, 16)
    assert tex.preview.size == (16 * 3 * 4, 16 * 3 * 4)
    assert tex.files[0] == project / "art" / "sheets" / "textures" / "stone.png"
    assert tex["seam"]["ratio"] > 0 and isinstance(tex["issues"], list)
    assert Artgen(project, cli=cli).texture("wood", size=(32, 16)).tile.size == (32, 16)
    assert "stone" in Artgen(project, cli=cli).materials()


def test_render_review_and_sheet(project, cli):
    ag = Artgen(project, cli=cli)
    r = ag.render("skeleton-knight")
    assert isinstance(r, Render) and r.passed and r["version"] == "finish.v2"
    assert r.scaled.width > r.strip.width
    ledger = project / "art" / "ledger.jsonl"
    before = len(ledger.read_text().splitlines())
    s = ag.review("skeleton-knight")
    assert isinstance(s, Sheet) and s["pass"] is True
    assert s.sheet.mode in ("RGBA", "RGB") and max(s.sheet.size) <= 1568
    last = json.loads(ledger.read_text().splitlines()[-1])
    assert len(ledger.read_text().splitlines()) == before + 1
    assert last["type"] == "review" and last["asset"] == "skeleton-knight"


def test_fx(project, cli):
    fx = Artgen(project, cli=cli).fx("sparks", size=24, frames=6, seed=2)
    assert fx.strip.size == (6 * 25 - 1, 24)
    assert fx.gif.suffix == ".gif" and fx.gif.is_file()
    assert len(Artgen(project, cli=cli).presets()) == 11


def test_errors_raise_with_the_cli_message(project, cli):
    with pytest.raises(ArtgenError, match="not an asset directory or a brief id"):
        Artgen(project, cli=cli).render("no-such-asset")


def test_pooled_analytics(project, cli):
    r = Artgen(project, cli=cli).analytics(across=[REPO / "examples" / n for n in ("swamp-topdown", "iso-dungeon")])
    assert len(r["projects"]) == 2
    assert any(k["kind"] == "character" for k in r["kinds"])


def test_session_over_mcp(project, cli):
    """The persistent session: one server process, results inline (JSON + Pillow images), tool errors raise."""
    with Artgen(project, cli=cli).session() as s:
        assert s.server_info["name"] == "artgen"
        assert {"texture", "render", "review", "make"} <= set(s.tools())
        tiles = [s.call("texture", material=m, size=16).images for m in ("stone", "wood", "brick")]
        assert all(len(t) == 2 and t[0].size == (192, 192) for t in tiles)  # 3×3 preview at 4×, normal map
        r = s.call("render", asset="slime")
        assert r.data["pass"] is True and len(r.images) == 1
        with pytest.raises(ArtgenError, match="outside art/"):
            s.call("render", asset="../../etc")
    assert s.proc.poll() is not None
