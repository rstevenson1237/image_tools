/** A check result, shared by the pixel-art gate (conformance) and the map subjects' checks. */
export type CheckStatus = 'pass' | 'fail' | 'flag' | 'skip';
/** `fail` blocks approval, `flag` is a warning, `skip` was not run. */
export interface Check { id: string; status: CheckStatus; detail: string }
