"""Thin client over the artgen CLI (DECISIONS D7): every call runs ``node <artgen.js> <command> --json`` in the
project root and returns the parsed JSON, with the PNGs it wrote available as Pillow images.

The engine stays in one place (the Node CLI); this module only builds argument lists, runs the process and opens
files. Node 20+ must be on PATH (or passed as ``node=``).
"""
from __future__ import annotations

import base64
import io
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional, Sequence, Union

from PIL import Image

PathLike = Union[str, "os.PathLike[str]"]


class ArtgenError(RuntimeError):
    """The CLI failed (non-zero exit without a JSON answer). ``output`` holds what it printed."""

    def __init__(self, args: Sequence[str], code: int, output: str):
        self.args_list = list(args)
        self.code = code
        self.output = output
        super().__init__(f"artgen {' '.join(args)} exited {code}: {output.strip().splitlines()[-1] if output.strip() else 'no output'}")


class Result(dict):
    """A command's JSON answer (a dict) plus the project root, so file paths in it open as images."""

    def __init__(self, data: Mapping[str, Any], root: Path, code: int = 0):
        super().__init__(data)
        self.root = root
        #: The CLI's exit code: 1 with a JSON answer means the command ran but a gate failed (render, tile, restyle).
        self.code = code

    def path(self, p: PathLike) -> Path:
        """A path the CLI reported (absolute, or relative to the project root) as an absolute path."""
        return (self.root / p).resolve()

    def image(self, p: PathLike) -> Image.Image:
        """Open a PNG the CLI wrote (loaded, so the file can change afterwards)."""
        with Image.open(self.path(p)) as im:
            im.load()
            return im

    @property
    def files(self) -> list[Path]:
        return [self.path(f) for f in self.get("files", [])]


class Render(Result):
    """``render``: the 1× strip (``image``), the scaled strip (``scaled``), gate checks and metrics."""

    @property
    def passed(self) -> bool:
        return bool(self["pass"])

    @property
    def strip(self) -> Image.Image:
        return self.image(self["files"][0])

    @property
    def scaled(self) -> Image.Image:
        return self.image(self["files"][-1])


class Sheet(Result):
    """A sheet (review, variants, gallery page): ``sheet`` path, its ``image`` and the review-image token estimate."""

    @property
    def sheet(self) -> Image.Image:
        return self.image(self["sheet"] if "sheet" in self else self["path"])


class Texture(Result):
    """``texture``: the tile, its normal map and a 3×3 repeat preview at 4×, with seam and repetition metrics."""

    @property
    def tile(self) -> Image.Image:
        return self.image(self["files"][0])

    @property
    def normal(self) -> Image.Image:
        return self.image(self["files"][1])

    @property
    def preview(self) -> Image.Image:
        return self.image(self["files"][2])


class Effect(Result):
    """``fx``: the frame strip and the onion-skin sheet (GIF / APNG paths in ``files``), with solid-fill numbers."""

    @property
    def strip(self) -> Image.Image:
        return self.image(self["files"][0])

    @property
    def onion(self) -> Image.Image:
        return self.image(self["files"][1])

    @property
    def gif(self) -> Path:
        return self.files[2]


def find_cli(project: Path, cli: Optional[PathLike] = None) -> Path:
    """The CLI to run: ``cli``, else ``$ARTGEN_CLI``, else the committed install's ``tools/artgen/artgen.js``."""
    for c in (cli, os.environ.get("ARTGEN_CLI"), project / "tools" / "artgen" / "artgen.js"):
        if c and Path(c).is_file():
            return Path(c).resolve()
    raise FileNotFoundError(
        f"no artgen CLI: {project}/tools/artgen/artgen.js is missing (install artgen into the game repo, "
        "or pass cli= / set ARTGEN_CLI to an artgen.js)"
    )


def find_mcp(cli: Path, mcp: Optional[PathLike] = None) -> Path:
    """The MCP server beside the CLI: ``mcp``, else ``$ARTGEN_MCP``, else ``artgen-mcp.js`` next to ``artgen.js``
    (in the artgen repo: ``packages/artgen-mcp/src/bin.ts`` beside ``packages/artgen-cli/src/bin.ts``)."""
    dev = cli.parent.parent.parent / "artgen-mcp" / "src" / "bin.ts" if cli.name == "bin.ts" else None
    for c in (mcp, os.environ.get("ARTGEN_MCP"), cli.with_name("artgen-mcp.js"), dev):
        if c and Path(c).is_file():
            return Path(c).resolve()
    raise FileNotFoundError(f"no artgen MCP server beside {cli} (pass mcp= or set ARTGEN_MCP)")


class ToolResult:
    """One MCP tool answer: ``data`` (the JSON of the first text part, or its text) and the ``images`` it returned."""

    def __init__(self, content: list[dict]):
        texts = [c["text"] for c in content if c.get("type") == "text"]
        try:
            self.data: Any = json.loads(texts[0]) if texts else None
        except json.JSONDecodeError:
            self.data = texts[0]
        self.images: list[Image.Image] = []
        for c in content:
            if c.get("type") == "image":
                im = Image.open(io.BytesIO(base64.b64decode(c["data"])))
                im.load()
                self.images.append(im)

    def __repr__(self) -> str:
        return f"ToolResult({type(self.data).__name__}, {len(self.images)} images)"


class Session:
    """A persistent connection to the artgen MCP server (stdio, one Node process for many calls). The engine and its
    SVG rasteriser start once, so bulk work (hundreds of textures) runs several times faster than a CLI call per item.
    Results come back inline: ``call()`` returns the tool's JSON and its images, no files to open.

    >>> with Artgen("game").session() as s:
    ...     tiles = [s.call("texture", material=m, size=32).images[0] for m in ("stone", "wood")]
    """

    def __init__(self, ag: "Artgen", mcp: Optional[PathLike] = None):
        self.server = find_mcp(ag.cli, mcp)
        self.proc = subprocess.Popen([ag.node, str(self.server)], cwd=ag.root, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.DEVNULL, text=True, bufsize=1)
        self._id = 0
        init = self._request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "artgen-py", "version": "0"}})
        self.server_info = init.get("serverInfo", {})
        self._send({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def _send(self, msg: dict) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()

    def _request(self, method: str, params: Optional[dict] = None) -> dict:
        self._id += 1
        self._send({"jsonrpc": "2.0", "id": self._id, "method": method, **({"params": params} if params is not None else {})})
        assert self.proc.stdout is not None
        line = self.proc.stdout.readline()
        if not line:
            raise ArtgenError([method], self.proc.poll() or -1, "the MCP server closed the connection")
        msg = json.loads(line)
        if "error" in msg:
            raise ArtgenError([method], -1, msg["error"].get("message", str(msg["error"])))
        return msg["result"]

    def tools(self) -> list[str]:
        return [t["name"] for t in self._request("tools/list")["tools"]]

    def call(self, tool: str, **arguments: Any) -> ToolResult:
        """Call an MCP tool (``texture``, ``render``, ``review``, ``fx``, ``status``…); raises ArtgenError on a tool error."""
        r = self._request("tools/call", {"name": tool, "arguments": arguments})
        if r.get("isError"):
            raise ArtgenError([tool], 1, r["content"][0].get("text", ""))
        return ToolResult(r["content"])

    def close(self) -> None:
        if self.proc.poll() is None:
            assert self.proc.stdin is not None
            self.proc.stdin.close()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()

    def __enter__(self) -> "Session":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


class Artgen:
    """One artgen project (a game repo root with ``art/artgen.config.json``).

    >>> ag = Artgen("examples/iso-dungeon")
    >>> tex = ag.texture("stone", size=32)
    >>> tex.preview.save("stone.png")
    """

    def __init__(self, project: PathLike = ".", *, cli: Optional[PathLike] = None, node: Optional[str] = None, timeout: float = 600):
        self.root = Path(project).resolve()
        self.cli = find_cli(self.root, cli)
        self.node = node or os.environ.get("ARTGEN_NODE") or shutil.which("node") or "node"
        self.timeout = timeout

    # ---- plumbing ----

    def run(self, *args: Any, check: bool = True) -> Any:
        """Run ``artgen <args> --json`` in the project root and return the parsed JSON (a dict or list).

        A non-zero exit with a JSON answer (a failing gate) is returned, not raised; anything else raises ArtgenError.
        """
        argv = [str(a) for a in args if a is not None]
        p = subprocess.run([self.node, str(self.cli), *argv, "--json"], cwd=self.root, capture_output=True, text=True, timeout=self.timeout)
        try:
            data = json.loads(p.stdout)
        except json.JSONDecodeError:
            if p.returncode == 0:
                return p.stdout
            raise ArtgenError(argv, p.returncode, p.stderr or p.stdout) from None
        if check and p.returncode not in (0, 1):
            raise ArtgenError(argv, p.returncode, p.stderr or p.stdout)
        return self._wrap(data, p.returncode)

    def _wrap(self, data: Any, code: int = 0, cls: type = Result) -> Any:
        return cls(data, self.root, code) if isinstance(data, dict) else data

    def version(self) -> str:
        p = subprocess.run([self.node, str(self.cli), "--version"], cwd=self.root, capture_output=True, text=True, timeout=self.timeout)
        if p.returncode:
            raise ArtgenError(["--version"], p.returncode, p.stderr)
        return p.stdout.strip()

    @staticmethod
    def _opt(name: str, value: Any) -> list[str]:
        if value is None or value is False:
            return []
        if value is True:
            return [f"--{name}"]
        if isinstance(value, (list, tuple)):
            return [f"--{name}", ",".join(str(v) for v in value)]
        if isinstance(value, Mapping):
            return [f"--{name}", ",".join(f"{k}={v}" for k, v in value.items())]
        return [f"--{name}", str(value)]

    def _call(self, cls: type, *args: Any, **opts: Any) -> Any:
        argv = list(args)
        for k, v in opts.items():
            argv += self._opt(k.replace("_", "-"), v)
        r = self.run(*argv)
        return cls(r, self.root, r.code) if isinstance(r, Result) else r

    def session(self, mcp: Optional[PathLike] = None) -> Session:
        """A persistent MCP session for bulk work (see Session); use it as a context manager."""
        return Session(self, mcp)

    # ---- project / direction ----

    def direction(self) -> Result:
        """The locked direction (id, version, anchors), the candidates and the style tiles."""
        return self._call(Result, "direction", "show")

    def status(self, *ids: str) -> list[dict]:
        """W2 status of each brief (brief, in-pipeline, final, approved, exported, revision, stale)."""
        return self.run("status", *ids)

    def briefs(self) -> list[dict]:
        return self.run("brief", "list")

    def brief_add(self, id: str, kind: str, **opts: Any) -> Result:
        """``artgen brief add``: options as keywords (``view=``, ``size=``, ``states=[...]``, ``directions=8``,
        ``anims={"walk": 4}``, ``importance="hero"``, ``object="ice lance"`` for effects, ``notes=``…)."""
        anims = opts.pop("anims", None)
        if isinstance(anims, Mapping):
            opts["anims"] = [f"{k}:{v}" for k, v in anims.items()]
        elif anims is not None:
            opts["anims"] = anims
        return self._call(Result, "brief", "add", id, kind=kind, **opts)

    def make(self, *ids: str, parallel: Optional[int] = None) -> Result:
        """One tick of the autonomous run; ``parallel=n`` also returns a round of maker packets (``work``)."""
        return self._call(Result, "make", *ids, parallel=parallel)

    # ---- assets ----

    def render(self, asset: str, version: Optional[str] = None, variant: int = 0) -> Render:
        """Render a version (default the latest) of an asset (brief id or directory) and run the gate."""
        return self._call(Render, "render", asset, version=version, variant=variant or None)

    def review(self, asset: str, version: Optional[str] = None, blind: bool = False) -> Sheet:
        """Build (and log) the review sheet for a version; ``blind`` = the final alone, for a fresh reviewer."""
        return self._call(Sheet, "review", asset, version=version, blind=blind)

    def score(self, asset: str, version: str, score: float, note: str = "", reviewer: Optional[str] = None, blind: bool = False) -> Result:
        return self._call(Result, "score", asset, version, score, note=note or None, reviewer=reviewer, blind=blind)

    def variants(self, asset: str, version: Optional[str] = None, n: int = 8) -> Sheet:
        return self._call(Sheet, "variants", asset, version=version, n=n)

    def gallery(self, *ids: str) -> list[Image.Image]:
        """The gallery sheet(s) of finished assets, as images."""
        r = self.run("gallery", *ids)
        return [r.image(s) for s in r.get("sheets", [])]

    def feedback(self, id: str, route: str, note: str, region: Optional[Sequence[int]] = None, cell: Optional[str] = None) -> Result:
        """Record the user's feedback (route ``base`` or ``finish``); region x,y,w,h in sprite pixels of ``cell``."""
        return self._call(Result, "feedback", id, route=route, note=note, region=region, cell=cell)

    def approve(self, id: str, note: str = "") -> Result:
        """Record the user's approval (D10: call this only for a person's decision, never automatically)."""
        return self._call(Result, "approve", id, note=note or None)

    def export(self, packs: Optional[Iterable[str]] = None, include_drafts: bool = False, runtime: bool = False, force: bool = False) -> Result:
        return self._call(Result, "export", pack=list(packs) if packs else None, include_drafts=include_drafts, runtime=runtime, force=force)

    def restyle(self, from_version: Optional[int] = None) -> Sheet:
        return self._call(Sheet, "restyle", **{"from": from_version})

    # ---- breadth ----

    def texture(self, material: str, size: Union[int, Sequence[int]] = 32, seed: Optional[int] = None, ramps: Optional[Mapping[str, str]] = None,
                scale: Optional[float] = None, out: Optional[PathLike] = None) -> Texture:
        """A material recipe under the project's direction: tile, normal map, 3×3 preview, seam and repetition metrics."""
        sz = f"{size[0]}x{size[1]}" if isinstance(size, (list, tuple)) else size
        return self._call(Texture, "texture", material, size=sz, seed=seed, ramps=ramps, scale=scale, out=out)

    def materials(self) -> list[str]:
        return self.run("texture", "--list")

    def fx(self, preset: str, size: Union[int, Sequence[int]] = 32, frames: int = 8, seed: Optional[int] = None, scale: Optional[int] = None,
           out: Optional[PathLike] = None) -> Effect:
        """A particle preset under the project's direction: strip, onion skin, GIF / APNG, solid-fill numbers."""
        sz = f"{size[0]}x{size[1]}" if isinstance(size, (list, tuple)) else size
        return self._call(Effect, "fx", preset, size=sz, frames=frames, seed=seed, scale=scale, out=out)

    def presets(self) -> list[str]:
        return self.run("fx", "--list")

    def anim(self, asset: str, version: Optional[str] = None, state: Optional[str] = None, facing: Optional[str] = None, scale: Optional[int] = None) -> Result:
        """GIF + APNG previews per state (paths in ``files``)."""
        return self._call(Result, "anim", asset, version=version, state=state, facing=facing, scale=scale)

    # ---- records ----

    def analytics(self, across: Optional[Iterable[PathLike]] = None, apply: bool = False) -> Result:
        """Pipeline analytics; ``across=[roots]`` gives the pooled v2 recommendations (``apply`` writes the config patch)."""
        if across is None:
            return self._call(Result, "analytics")
        return self._call(Result, "analytics", across=[str(Path(a).resolve()) for a in across], apply=apply)
