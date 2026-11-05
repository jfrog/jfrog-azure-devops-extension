/* eslint-env node */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const runtimeRequire = createRequire(path.resolve(__dirname, '../../jfrog-tasks-utils/package.json'));

test('task-lib is shared by the runtime, tool-lib and Java helper', () => {
    const expected = runtimeRequire.resolve('azure-pipelines-task-lib/task');
    for (const library of ['azure-pipelines-tool-lib', 'azure-pipelines-tasks-java-common']) {
        const nestedRequire = createRequire(runtimeRequire.resolve(library + '/package.json'));
        assert.equal(nestedRequire.resolve('azure-pipelines-task-lib/task'), expected);
    }
});

test('hostile wildcard patterns finish within a bounded time', () => {
    const taskRequire = createRequire(runtimeRequire.resolve('azure-pipelines-task-lib/task'));
    const matcher = taskRequire.resolve('minimatch');
    const script = `const match = require(${JSON.stringify(matcher)}); if (match('a'.repeat(64), '*'.repeat(34) + 'X')) process.exit(1);`;
    const result = spawnSync(process.execPath, ['-e', script], { timeout: 2000, encoding: 'utf8' });
    assert.equal(result.error, undefined, 'glob matching exceeded its time budget');
    assert.equal(result.status, 0, result.stderr);
});
