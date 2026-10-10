"""artgen: thin Python client for the artgen pixel-art pipeline (the Node CLI does the work)."""
from .client import Artgen, ArtgenError, Effect, Render, Result, Session, Sheet, Texture, ToolResult, find_cli, find_mcp

__all__ = ["Artgen", "ArtgenError", "Effect", "Render", "Result", "Session", "Sheet", "Texture", "ToolResult", "find_cli", "find_mcp"]
__version__ = "0.9.0"
