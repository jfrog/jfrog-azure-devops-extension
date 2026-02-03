/// <reference types="mocha" />
import * as assert from 'assert';

// Use require to get the actual module with latest exports
import * as jfrogUtils from '@jfrog/tasks-utils';

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
function simulatePlatformUrlResolution(
    getEndpointResult: string | undefined | null,
    shouldThrow: boolean,
    serviceUrl: string,
): string {
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
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/artifactory'),
                'https://example.jfrog.io',
            );
        });

        it('should strip /xray suffix', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/xray'),
                'https://example.jfrog.io',
            );
        });

        it('should strip /distribution suffix', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/distribution'),
                'https://example.jfrog.io',
            );
        });

        it('should handle case-insensitive matching for /Artifactory', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/Artifactory'),
                'https://example.jfrog.io',
            );
        });

        it('should handle case-insensitive matching for /XRAY', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/XRAY'),
                'https://example.jfrog.io',
            );
        });

        it('should return URL as-is when no known suffix', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/other'),
                'https://example.jfrog.io/other',
            );
        });

        it('should handle URL with port', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io:8080/artifactory'),
                'https://example.jfrog.io:8080',
            );
        });

        it('should handle URL with trailing slash on suffix', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.jfrog.io/artifactory/'),
                'https://example.jfrog.io',
            );
        });

        it('should handle URL with path prefix', (): void => {
            assert.strictEqual(
                jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.com/jfrog/artifactory'),
                'https://example.com/jfrog',
            );
        });

        it('should handle URL without any prefix', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://example.com/jfrog'), 'https://example.com/jfrog');
        });

        it('should handle hostnames as well', (): void => {
            assert.strictEqual(jfrogUtils.parsePlatformUrlFromServiceUrl('https://artifactory.com/jfrog/artifactory'), 'https://artifactory.com/jfrog');
        });
    });
});
