"""The quickstart notebook runs top to bottom (its code cells, in order, in one namespace)."""
import json
from pathlib import Path

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def test_quickstart_notebook(cli, monkeypatch):
    monkeypatch.setenv("ARTGEN_CLI", str(cli))
    monkeypatch.chdir(EXAMPLES)
    nb = json.loads((EXAMPLES / "artgen-quickstart.ipynb").read_text())
    shown = []
    ns = {"__name__": "__main__"}
    for cell in nb["cells"]:
        if cell["cell_type"] != "code":
            continue
        exec(compile("".join(cell["source"]), "artgen-quickstart.ipynb", "exec"), ns)
        ns["display"] = shown.append  # after the first cell's import, collect what the notebook shows
    # a texture preview, the material board, a review sheet, a render strip and an onion skin
    assert len(shown) == 5
    assert ns["tex"].preview.size == (384, 384)
    assert ns["sheet"]["sheet"].endswith("review-finish.v2.png")
    assert ns["board"].size == ((4 * 34 - 2) * 4, 128)
