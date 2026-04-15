/* eslint-env node */
const tl = require('azure-pipelines-task-lib/task');
const jfrogUtils = require('../jfrog-tasks-utils/utils.js');
const assert = require('assert');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

function clearProxyVars() {
    tl.setVariable('Agent.ProxyUrl', undefined);
    tl.setVariable('Agent.ProxyUsername', undefined);
    tl.setVariable('Agent.ProxyPassword', undefined);
    tl.setVariable('Agent.ProxyBypassList', undefined);
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;
}

console.log('\nProxy Configuration Tests\n');

runTest('Returns empty object when no proxy is set', () => {
    clearProxyVars();
    const config = jfrogUtils.getProxyConfiguration();
    assert.deepStrictEqual(config, {});
});

runTest('Returns proxy config with URL only', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'http://myproxy:8080');
    assert.strictEqual(config.proxy.proxyUsername, undefined);
    assert.strictEqual(config.proxy.proxyPassword, undefined);
    assert.strictEqual(config.proxy.proxyBypassHosts, undefined);
    clearProxyVars();
});

runTest('Returns full proxy config with auth and bypass list', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://corpproxy:3128');
    tl.setVariable('Agent.ProxyUsername', 'proxyuser');
    tl.setVariable('Agent.ProxyPassword', 'proxypass');
    tl.setVariable('Agent.ProxyBypassList', '["localhost","*.internal.corp"]');
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'http://corpproxy:3128');
    assert.strictEqual(config.proxy.proxyUsername, 'proxyuser');
    assert.strictEqual(config.proxy.proxyPassword, 'proxypass');
    assert.deepStrictEqual(config.proxy.proxyBypassHosts, ['localhost', '*.internal.corp']);
    clearProxyVars();
});

runTest('proxyUsername/proxyPassword are undefined when not set', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyUsername', 'user');
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUsername, 'user');
    assert.strictEqual(config.proxy.proxyPassword, undefined);
    clearProxyVars();
});

runTest('proxyPassword without username still passes both separately', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyPassword', 'pass');
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUsername, undefined);
    assert.strictEqual(config.proxy.proxyPassword, 'pass');
    clearProxyVars();
});

runTest('Handles HTTPS proxy URL', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'https://secureproxy:443');
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'https://secureproxy:443');
    clearProxyVars();
});

runTest('Falls back to HTTPS_PROXY env var when Agent.ProxyUrl is not set', () => {
    clearProxyVars();
    process.env.HTTPS_PROXY = 'http://envproxy:8100';
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'http://envproxy:8100');
    assert.strictEqual(config.proxy.proxyUsername, undefined);
    clearProxyVars();
});

runTest('Falls back to HTTP_PROXY env var when HTTPS_PROXY is not set', () => {
    clearProxyVars();
    process.env.HTTP_PROXY = 'http://httpproxy:3128';
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'http://httpproxy:3128');
    clearProxyVars();
});

runTest('Falls back to lowercase https_proxy env var', () => {
    clearProxyVars();
    process.env.https_proxy = 'http://lowercaseproxy:9090';
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'http://lowercaseproxy:9090');
    clearProxyVars();
});

runTest('Agent.ProxyUrl takes priority over HTTPS_PROXY env var', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://agentproxy:3128');
    process.env.HTTPS_PROXY = 'http://envproxy:8100';
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyUrl, 'http://agentproxy:3128');
    clearProxyVars();
});

runTest('Returns empty object when no proxy is configured anywhere', () => {
    clearProxyVars();
    const config = jfrogUtils.getProxyConfiguration();
    assert.deepStrictEqual(config, {});
});

runTest('Returns undefined proxyBypassHosts when Agent.ProxyBypassList contains invalid JSON', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyBypassList', 'not-valid-json');
    const config = jfrogUtils.getProxyConfiguration();
    assert.strictEqual(config.proxy.proxyBypassHosts, undefined);
    clearProxyVars();
});

console.log('\nforwardProxyToEnv Tests\n');

runTest('forwardProxyToEnv does nothing when Agent.ProxyUrl is not set', () => {
    clearProxyVars();
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.HTTP_PROXY, undefined);
    assert.strictEqual(process.env.HTTPS_PROXY, undefined);
    clearProxyVars();
});

runTest('forwardProxyToEnv sets HTTP_PROXY and HTTPS_PROXY when Agent.ProxyUrl is set', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.HTTP_PROXY, 'http://myproxy:8080');
    assert.strictEqual(process.env.HTTPS_PROXY, 'http://myproxy:8080');
    clearProxyVars();
});

runTest('forwardProxyToEnv includes auth in proxy URL when username and password are set', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyUsername', 'user');
    tl.setVariable('Agent.ProxyPassword', 'pass');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.HTTP_PROXY, 'http://user:pass@myproxy:8080/');
    assert.strictEqual(process.env.HTTPS_PROXY, 'http://user:pass@myproxy:8080/');
    clearProxyVars();
});

runTest('forwardProxyToEnv does not override existing HTTP_PROXY', () => {
    clearProxyVars();
    process.env.HTTP_PROXY = 'http://existing:9090';
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.HTTP_PROXY, 'http://existing:9090');
    assert.strictEqual(process.env.HTTPS_PROXY, 'http://myproxy:8080');
    clearProxyVars();
});

runTest('forwardProxyToEnv does not override existing HTTPS_PROXY', () => {
    clearProxyVars();
    process.env.HTTPS_PROXY = 'http://existing:9090';
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.HTTP_PROXY, 'http://myproxy:8080');
    assert.strictEqual(process.env.HTTPS_PROXY, 'http://existing:9090');
    clearProxyVars();
});

runTest('forwardProxyToEnv does not override existing lowercase http_proxy', () => {
    clearProxyVars();
    process.env.http_proxy = 'http://existing:9090';
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.http_proxy, 'http://existing:9090');
    assert.strictEqual(process.env.HTTP_PROXY, undefined);
    assert.strictEqual(process.env.HTTPS_PROXY, 'http://myproxy:8080');
    clearProxyVars();
});

runTest('forwardProxyToEnv does not override existing lowercase https_proxy', () => {
    clearProxyVars();
    process.env.https_proxy = 'http://existing:9090';
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.https_proxy, 'http://existing:9090');
    assert.strictEqual(process.env.HTTPS_PROXY, undefined);
    assert.strictEqual(process.env.HTTP_PROXY, 'http://myproxy:8080');
    clearProxyVars();
});

runTest('forwardProxyToEnv falls back to original URL when parse fails (no credentials)', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'not-a-valid-url');
    tl.setVariable('Agent.ProxyUsername', 'user');
    tl.setVariable('Agent.ProxyPassword', 'pass');
    jfrogUtils.forwardProxyToEnv();
    // URL parsing fails so credentials cannot be embedded, but the original
    // URL is still forwarded so proxy support is not lost entirely.
    assert.strictEqual(process.env.HTTP_PROXY, 'not-a-valid-url');
    assert.strictEqual(process.env.HTTPS_PROXY, 'not-a-valid-url');
    clearProxyVars();
});

runTest('forwardProxyToEnv sets NO_PROXY from Agent.ProxyBypassList', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyBypassList', '["localhost","*.internal.corp"]');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.HTTP_PROXY, 'http://myproxy:8080');
    assert.strictEqual(process.env.NO_PROXY, 'localhost,*.internal.corp');
    clearProxyVars();
});

runTest('forwardProxyToEnv does not override existing NO_PROXY', () => {
    clearProxyVars();
    process.env.NO_PROXY = 'existing.host';
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyBypassList', '["localhost"]');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.NO_PROXY, 'existing.host');
    clearProxyVars();
});

runTest('forwardProxyToEnv does not override existing lowercase no_proxy', () => {
    clearProxyVars();
    process.env.no_proxy = 'existing.host';
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyBypassList', '["localhost"]');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.no_proxy, 'existing.host');
    assert.strictEqual(process.env.NO_PROXY, undefined);
    clearProxyVars();
});

runTest('forwardProxyToEnv does not set NO_PROXY when Agent.ProxyBypassList is empty', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyBypassList', '[]');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.NO_PROXY, undefined);
    clearProxyVars();
});

runTest('forwardProxyToEnv warns and skips NO_PROXY when Agent.ProxyBypassList is invalid JSON', () => {
    clearProxyVars();
    tl.setVariable('Agent.ProxyUrl', 'http://myproxy:8080');
    tl.setVariable('Agent.ProxyBypassList', 'not-valid-json');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.NO_PROXY, undefined);
    clearProxyVars();
});

runTest('forwardProxyToEnv does not set NO_PROXY when user already has HTTP_PROXY and HTTPS_PROXY set', () => {
    clearProxyVars();
    process.env.HTTP_PROXY = 'http://user-proxy:9090';
    process.env.HTTPS_PROXY = 'http://user-proxy:9090';
    tl.setVariable('Agent.ProxyUrl', 'http://agent-proxy:8080');
    tl.setVariable('Agent.ProxyBypassList', '["internal.host"]');
    jfrogUtils.forwardProxyToEnv();
    assert.strictEqual(process.env.NO_PROXY, undefined);
    assert.strictEqual(process.env.HTTP_PROXY, 'http://user-proxy:9090');
    assert.strictEqual(process.env.HTTPS_PROXY, 'http://user-proxy:9090');
    clearProxyVars();
});


console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
