#!/usr/bin/env node
/** artgen MCP server entry: `node tools/artgen/artgen-mcp.js` (the committed `.mcp.json` entry) or `artgen-mcp`. */
import { serve } from './server.ts';

void serve().then(() => process.exit(0));
