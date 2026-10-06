/** artgen MCP stdio server (SPEC §14): W1 + pipeline tools in P2, the full tool set in P7. */
export const name = 'artgen-mcp';
export { handle, serve, assetPath, TOOLS, SERVER, type RpcMessage } from './server.ts';
