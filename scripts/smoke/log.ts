/**
 * Sorts the lines the app logged during a smoke run into failures and warnings.
 * Pure, so scripts/smoke/log.test.ts can run it; scripts/smoke.ts reads the log file.
 */

// The Translate window logs every translate error as "[<service>]happened error: <error>".
// Most are a third-party server failing on the network: reported, but they do not fail the run.
const SERVICE_FAILURE = /\]happened error: (.*)/;

// The same line carries a JavaScript error thrown by the app's own code (a refactor slip), which
// must fail the run, so the message decides.
const JAVASCRIPT_ERROR =
    /\b(TypeError|ReferenceError|SyntaxError|RangeError)\b|is not a function|is not defined|Cannot read propert/;

function isServiceFailure(line: string): boolean {
    const message = SERVICE_FAILURE.exec(line)?.[1];
    return message !== undefined && !JAVASCRIPT_ERROR.test(message);
}

export function classifyLogLines(lines: string[]): { appErrors: string[]; serviceErrors: string[] } {
    const errors = lines.filter((line) => line.includes('[ERROR]') || line.includes('panicked'));
    return {
        appErrors: errors.filter((line) => !isServiceFailure(line)),
        serviceErrors: errors.filter(isServiceFailure),
    };
}
