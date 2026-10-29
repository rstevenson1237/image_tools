/**
 * The pixel-art module's operations (docs/OPERATION-REGISTRY.md §6): the project, direction, asset-pipeline, production and breadth
 * commands, declared once for the CLI, the MCP server and the Python client. The declarations live in `art-direction.ts`,
 * `art-asset.ts` and `art-production.ts`; this file puts them in order. The order is the MCP tools' order (each tool where it always
 * was, the new ones after their group) with the command-line-only operations beside their relatives, so `--help` follows it.
 */
import { anim, bench, conformance, fx, passNext, passStatus, render, reportOp, review, score, texture, variants, voxel } from './art-asset.ts';
import { anchors, candidates, directionShow, draft, finish, init, lockOp, mix, newOp, paletteExtract, paletteImport, ramp, tile, validate } from './art-direction.ts';
import { analytics, approveOp, briefAdd, briefLint, briefList, briefRm, exportOp, feedbackOp, galleryOp, importEditOp, makeOp, restyleOp, roster, rosterRecordOp, status } from './art-production.ts';
import { usageLines, type OpDef } from './registry.ts';

export const ART_OPS: OpDef[] = [
  init, candidates, directionShow, tile, mix, lockOp, anchors, draft, validate, paletteImport, paletteExtract, ramp, newOp,
  passStatus, passNext, render, review, conformance, score, variants, reportOp, finish,
  makeOp, briefLint, briefAdd, briefList, briefRm, status, galleryOp, feedbackOp, approveOp, roster, rosterRecordOp,
  texture, fx, exportOp, restyleOp, analytics, importEditOp, voxel, anim, bench,
];

/** The `--help` lines of the art operations, in order. */
export const ART_USAGE = ART_OPS.flatMap(usageLines).join('\n');
