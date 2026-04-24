/// <reference types="mocha" />
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

// Use require to get the actual module with latest exports
import * as jfrogUtils from '@jfrog/tasks-utils';

// Type declarations for exports not yet in the installed package's utils.d.ts
declare module '@jfrog/tasks-utils' {
    export function syncRequestWithRetry(
        method: string,
        url: string,
        options?: object,
        maxRetries?: number,
        retryDelay?: number,
    ): { statusCode: number; getBody(encoding: string): string };
    export function isCliBinaryAvailable(version: string): boolean;
    export function fetchLatestCliVersion(): string;
    export const defaultJfrogCliVersion: string;
    export const fallbackCliVersion: string;
    export function fetchAzureOidcToken(serviceConnectionID: string): Promise<string>;
}

/**
 * Simulates the platformUrl resolution logic from utils.js lines 441-449:
 *
 * let platformUrl = "";
 * try {
 *     platformUrl = tl.getEndpointAuthorizationParameter(service, 'jfrogPlatformUrl', true);
 * } catch (error) {
 *     console.warn('Failed to get platform url from field: ' + error + "\nparsing from url instead");
 * }
 * if (!platformUrl || !platformUrl.trim()) {
 *     platformUrl = parsePlatformUrlFromServiceUrl(serviceUrl);
 * }
 *
 * @param getEndpointResult - Simulated result from tl.getEndpointAuthorizationParameter
 * @param shouldThrow - Whether the call should throw an error
 * @param serviceUrl - The service URL to parse from if platformUrl is not available
 * @returns The resolved platform URL
 */
function simulatePlatformUrlResolution(getEndpointResult: string | undefined | null, shouldThrow: boolean, serviceUrl: string): string {
    let platformUrl: string | undefined | null = '';
    try {
        if (shouldThrow) {
            throw new Error('Simulated error');
        }
        platformUrl = getEndpointResult;
    } catch {
        // Simulates: console.warn('Failed to get platform url from field...')
    }
    if (!platformUrl || !platformUrl.trim()) {
        platformUrl = jfrogUtils.parsePlatformUrlFromServiceUrl(serviceUrl);
    }
    return platformUrl;
}

describe('Utils Unit Tests', (): void => {
    describe('platformUrl resolution (simulating tl.getEndpointAuthorizationParameter)', (): void => {
        const serviceUrl: string = 'https://example.jfrog.io/artifactory';

        it('should use platformUrl directly when getEndpointAuthorizationParameter returns valid URL', (): void => {
            const result: string = simulatePlatformUrlResolution('https://my-platform.jfrog.io', false, serviceUrl);
            assert.strictEqual(result, 'https://my-platform.jfrog.io');
        });

        it('should parse from serviceUrl when getEndpointAuthorizationParameter returns empty string', (): void => {
            const result: string = simulatePlatformUrlResolution('', false, serviceUrl);
            assert.strictEqual(result, 'https://example.jfrog.io');
        });

        it('should parse from serviceUrl when getEndpointAuthorizationParameter returns undefined', (): void => {
            const result: string = simulatePlatformUrlResolution(undefined, false, serviceUrl);
            assert.strictEqual(result, 'https://example.jfrog.io');
        });

        it('should parse from serviceUrl when getEndpointAuthorizationParameter returns null', (): void => {
            const result: string = simulatePlatformUrlResolution(null, false, serviceUrl);
            assert.strictEqual(result, 'https://example.jfrog.io');
        });

        it('should parse from serviceUrl when getEndpointAuthorizationParameter returns whitespace only', (): void => {
            const result: string = simulatePlatformUrlResolution('   ', false, serviceUrl);
            assert.strictEqual(result, 'https://example.jfrog.io');
        });

        it('should parse from serviceUrl when getEndpointAuthorizationParameter throws error', (): void => {
            const result: string = simulatePlatformUrlResolution('', true, serviceUrl);
            assert.strictEqual(result, 'https://example.jfrog.io');
        });

        it('should parse from xray serviceUrl when platformUrl not available', (): void => {
            const result: string = simulatePlatformUrlResolution('', false, 'https://example.jfrog.io/xray');
            assert.strictEqual(result, 'https://example.jfrog.io');
        });

        it('should parse from distribution serviceUrl when platformUrl not available', (): void => {
            const result: string = simulatePlatformUrlResolution('', false, 'https://example.jfrog.io/distribution');
            assert.strictEqual(result, 'https://example.jfrog.io');
        });
    });

    describe('parsePlatformUrlFromServiceUrl', (): void => {
        it('should strip /artifactory suffix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/artifactory'), 'https://example.jfrog.io');
        });

        it('should strip /xray suffix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/xray'), 'https://example.jfrog.io');
        });

        it('should strip /distribution suffix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/distribution'), 'https://example.jfrog.io');
        });

        it('should handle case-insensitive matching for /Artifactory', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/Artifactory'), 'https://example.jfrog.io');
        });

        it('should handle case-insensitive matching for /XRAY', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/XRAY'), 'https://example.jfrog.io');
        });

        it('should return URL as-is when no known suffix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/other'), 'https://example.jfrog.io/other');
        });

        it('should handle URL with port', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io:8080/artifactory'),
                'https://example.jfrog.io:8080',
            );
        });

        it('should handle URL with trailing slash on suffix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/artifactory/'), 'https://example.jfrog.io');
        });

        it('should handle URL with path prefix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.com/jfrog/artifactory'), 'https://example.com/jfrog');
        });

        it('should handle URL without any prefix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.com/jfrog'), 'https://example.com/jfrog');
        });

        it('should handle hostnames as well', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://artifactory.com/jfrog/artifactory'),
                'https://artifactory.com/jfrog',
            );
        });
    });

    describe('syncRequestWithRetry', (): void => {
        it('should return response on successful request (2xx)', (): void => {
            const response: { statusCode: number } = jfrogUtils.syncRequestWithRetry('GET', 'https://httpstat.us/200', { timeout: 5000 });
            assert.strictEqual(response.statusCode, 200);
        });

        it('should return response on 4xx client error without retry', (): void => {
            const response: { statusCode: number } = jfrogUtils.syncRequestWithRetry('GET', 'https://httpstat.us/404', { timeout: 5000 });
            assert.strictEqual(response.statusCode, 404);
        });

        it('should throw error after retries exhausted on 5xx server error', (): void => {
            assert.throws((): void => {
                jfrogUtils.syncRequestWithRetry('GET', 'https://httpstat.us/503', { timeout: 5000 }, 2, 100);
            }, /Server error 503 after 2 retries/);
        });

        it('should throw error on network failure after retries', (): void => {
            assert.throws((): void => {
                jfrogUtils.syncRequestWithRetry('GET', 'https://invalid.domain.that.does.not.exist.example', { timeout: 1000 }, 2, 100);
            }, Error);
        });
    });

    describe('isCliBinaryAvailable', (): void => {
        it('should return true for a known valid CLI version', (): void => {
            // Use a known stable version that should always be available
            const result: boolean = jfrogUtils.isCliBinaryAvailable('2.50.0');
            assert.strictEqual(result, true);
        });

        it('should return false for a non-existent CLI version', (): void => {
            const result: boolean = jfrogUtils.isCliBinaryAvailable('0.0.1');
            assert.strictEqual(result, false);
        });

        it('should return false for an invalid version format', (): void => {
            const result: boolean = jfrogUtils.isCliBinaryAvailable('invalid-version');
            assert.strictEqual(result, false);
        });
    });

    describe('fetchLatestCliVersion', (): void => {
        it('should return a valid semver version string', (): void => {
            const version: string = jfrogUtils.fetchLatestCliVersion();
            // Version should match semver pattern (e.g., "2.89.0")
            assert.match(version, /^\d+\.\d+\.\d+$/);
        });

        it('should return version >= 2.50.0 (reasonable minimum)', (): void => {
            const version: string = jfrogUtils.fetchLatestCliVersion();
            const [major, minor]: number[] = version.split('.').map(Number);
            assert.ok(major >= 2, `Major version ${major} should be >= 2`);
            if (major === 2) {
                assert.ok(minor >= 50, `Minor version ${minor} should be >= 50 for major version 2`);
            }
        });
    });

    describe('defaultJfrogCliVersion', (): void => {
        it('should be initialized with a valid version', (): void => {
            assert.ok(jfrogUtils.defaultJfrogCliVersion, 'defaultJfrogCliVersion should be defined');
            assert.match(jfrogUtils.defaultJfrogCliVersion, /^\d+\.\d+\.\d+$/);
        });

        it('should match the result of fetchLatestCliVersion', (): void => {
            // Since defaultJfrogCliVersion is set at module load, it should match fetchLatestCliVersion
            // unless there was a failure (in which case both would use fallback)
            const fetchedVersion: string = jfrogUtils.fetchLatestCliVersion();
            assert.strictEqual(jfrogUtils.defaultJfrogCliVersion, fetchedVersion);
        });
    });

    describe('fallbackCliVersion', (): void => {
        it('should be a valid semver version string', (): void => {
            assert.ok(jfrogUtils.fallbackCliVersion, 'fallbackCliVersion should be defined');
            assert.match(jfrogUtils.fallbackCliVersion, /^\d+\.\d+\.\d+$/);
        });

        it('should have an available binary on releases.jfrog.io', (): void => {
            // The fallback version should always have its binary available
            const result: boolean = jfrogUtils.isCliBinaryAvailable(jfrogUtils.fallbackCliVersion);
            assert.strictEqual(result, true, `Fallback version ${jfrogUtils.fallbackCliVersion} should have available binary`);
        });
    });

    describe('fetchAzureOidcToken', (): void => {
        /**
         * Simulates the OIDC token response-handling logic from fetchAzureOidcToken
         * (the part after the HTTP call is made), so we can unit-test it without
         * a real Azure DevOps endpoint.
         */
        async function simulateOidcTokenResponse(statusCode: number, responseBody: string): Promise<string> {
            if (statusCode !== 200) {
                throw new Error(`OIDC token request failed: HTTP ${statusCode}\nBody: ${responseBody}`);
            }
            const body: { oidcToken?: string } = JSON.parse(responseBody);
            if (!body.oidcToken) {
                throw new Error('OIDC token not found in response body.');
            }
            return body.oidcToken;
        }

        it('should throw when System.AccessToken is not available', async (): Promise<void> => {
            // System.AccessToken is not set in the test environment, so this should throw immediately.
            await assert.rejects(
                (): Promise<string> => jfrogUtils.fetchAzureOidcToken('test-service-connection-id'),
                /System\.AccessToken is not available/,
            );
        });

        it('should throw on non-200 HTTP response (simulated)', async (): Promise<void> => {
            await assert.rejects((): Promise<string> => simulateOidcTokenResponse(403, 'Forbidden'), /OIDC token request failed: HTTP 403/);
        });

        it('should throw on 500 HTTP response (simulated)', async (): Promise<void> => {
            await assert.rejects(
                (): Promise<string> => simulateOidcTokenResponse(500, 'Internal Server Error'),
                /OIDC token request failed: HTTP 500/,
            );
        });

        it('should throw when oidcToken is absent from response body (simulated)', async (): Promise<void> => {
            await assert.rejects(
                (): Promise<string> => simulateOidcTokenResponse(200, JSON.stringify({ someOtherField: 'value' })),
                /OIDC token not found in response body/,
            );
        });

        it('should throw when oidcToken is empty string in response body (simulated)', async (): Promise<void> => {
            await assert.rejects(
                (): Promise<string> => simulateOidcTokenResponse(200, JSON.stringify({ oidcToken: '' })),
                /OIDC token not found in response body/,
            );
        });

        it('should return the oidcToken on a successful 200 response (simulated)', async (): Promise<void> => {
            const token: string = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test';
            const result: string = await simulateOidcTokenResponse(200, JSON.stringify({ oidcToken: token }));
            assert.strictEqual(result, token);
        });

        it('should throw when response body is not valid JSON (simulated)', async (): Promise<void> => {
            await assert.rejects((): Promise<string> => simulateOidcTokenResponse(200, 'not-json'), SyntaxError);
        });
    });

    describe('OIDC minimum CLI version check', (): void => {
        // Regression test: string comparison ('2.101.0' < '2.75.0') incorrectly returns true
        // because '1' < '7' lexicographically. semver.lt must be used instead.
        const minOidcVersion: string = '2.75.0';

        it('should recognise 2.101.0 as above minimum (3-digit minor regression)', (): void => {
            assert.strictEqual(semver.lt('2.101.0', minOidcVersion), false);
        });

        it('should recognise 2.100.0 as above minimum', (): void => {
            assert.strictEqual(semver.lt('2.100.0', minOidcVersion), false);
        });

        it('should recognise 2.75.0 as meeting minimum exactly', (): void => {
            assert.strictEqual(semver.lt('2.75.0', minOidcVersion), false);
        });

        it('should recognise 2.74.9 as below minimum', (): void => {
            assert.strictEqual(semver.lt('2.74.9', minOidcVersion), true);
        });
    });

    // Regression guard for https://github.com/jfrog/jfrog-azure-devops-extension/issues/608 :
    // the silent OIDC failure was caused by configureArtifactoryCliServer,
    // configureDistributionCliServer, and configureXrayCliServer no longer invoking
    // the OIDC exchange after the proxy-support refactor in PR #593. Catches any future
    // refactor that moves OIDC out of one of the four configure paths.
    describe('OIDC exchange wiring across connection types (regression for #608)', (): void => {
        it('every configure*CliServer function calls fetchOidcTokenIfConfigured', (): void => {
            const utilsPath: string = path.join(__dirname, 'node_modules', '@jfrog', 'tasks-utils', 'utils.js');
            const src: string = fs.readFileSync(utilsPath, 'utf8');

            const wrappers: readonly string[] = [
                'configureJfrogCliServer',
                'configureArtifactoryCliServer',
                'configureDistributionCliServer',
                'configureXrayCliServer',
            ];

            for (const name of wrappers) {
                const re: RegExp = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
                const match: RegExpMatchArray | null = src.match(re);
                assert.ok(match, `${name} not found in utils.js`);
                assert.match(
                    match![1],
                    /fetchOidcTokenIfConfigured\s*\(/,
                    `${name} must call fetchOidcTokenIfConfigured — regression of issue #608`,
                );
            }
        });
    });
});
