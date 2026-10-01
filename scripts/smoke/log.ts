/**
 * Sorts the lines the app logged during a smoke run into failures and warnings.
 * Pure, so scripts/smoke/log.test.ts can run it; scripts/smoke.ts reads the log file.
 */

// A translation service that fails on the network logs "[<service>]happened error: ...".
// Those depend on third-party servers, so they are reported but do not fail the run.
const SERVICE_FAILURE = /\]happened error: /;

export function classifyLogLines(lines: string[]): { appErrors: string[]; serviceErrors: string[] } {
    const errors = lines.filter((line) => line.includes('[ERROR]') || line.includes('panicked'));
    return {
        appErrors: errors.filter((line) => !SERVICE_FAILURE.test(line)),
        serviceErrors: errors.filter((line) => SERVICE_FAILURE.test(line)),
    };
}
