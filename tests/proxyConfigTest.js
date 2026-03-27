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
    tl.setVariable('Agent.ProxyUrl', '');
    tl.setVariable('Agent.ProxyUsername', '');
    tl.setVariable('Agent.ProxyPassword', '');
    tl.setVariable('Agent.ProxyBypassList', '');
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

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
