/// <reference types="mocha" />
import * as assert from 'assert';

// Use require to get the actual module with latest exports
import * as jfrogUtils from '@jfrog/tasks-utils';

// Type declarations for the new exported functions
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
            const response = jfrogUtils.syncRequestWithRetry('GET', 'https://httpstat.us/200', { timeout: 5000 });
            assert.strictEqual(response.statusCode, 200);
        });

        it('should return response on 4xx client error without retry', (): void => {
            const response = jfrogUtils.syncRequestWithRetry('GET', 'https://httpstat.us/404', { timeout: 5000 });
            assert.strictEqual(response.statusCode, 404);
        });

        it('should throw error after retries exhausted on 5xx server error', (): void => {
            assert.throws(
                (): void => {
                    jfrogUtils.syncRequestWithRetry('GET', 'https://httpstat.us/503', { timeout: 5000 }, 2, 100);
                },
                /Server error 503 after 2 retries/,
            );
        });

        it('should throw error on network failure after retries', (): void => {
            assert.throws(
                (): void => {
                    jfrogUtils.syncRequestWithRetry('GET', 'https://invalid.domain.that.does.not.exist.example', { timeout: 1000 }, 2, 100);
                },
                Error,
            );
        });
    });

    describe('isCliBinaryAvailable', (): void => {
        it('should return true for a known valid CLI version', (): void => {
            // Use a known stable version that should always be available
            const result = jfrogUtils.isCliBinaryAvailable('2.50.0');
            assert.strictEqual(result, true);
        });

        it('should return false for a non-existent CLI version', (): void => {
            const result = jfrogUtils.isCliBinaryAvailable('0.0.1');
            assert.strictEqual(result, false);
        });

        it('should return false for an invalid version format', (): void => {
            const result = jfrogUtils.isCliBinaryAvailable('invalid-version');
            assert.strictEqual(result, false);
        });
    });

    describe('fetchLatestCliVersion', (): void => {
        it('should return a valid semver version string', (): void => {
            const version = jfrogUtils.fetchLatestCliVersion();
            // Version should match semver pattern (e.g., "2.89.0")
            assert.match(version, /^\d+\.\d+\.\d+$/);
        });

        it('should return version >= 2.50.0 (reasonable minimum)', (): void => {
            const version = jfrogUtils.fetchLatestCliVersion();
            const [major, minor] = version.split('.').map(Number);
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
            const fetchedVersion = jfrogUtils.fetchLatestCliVersion();
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
            const result = jfrogUtils.isCliBinaryAvailable(jfrogUtils.fallbackCliVersion);
            assert.strictEqual(result, true, `Fallback version ${jfrogUtils.fallbackCliVersion} should have available binary`);
        });
    });
});
