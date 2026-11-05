/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Load the actual source with only external services replaced. No credentials,
// package installation, network access or live Azure agent are needed.
function loadSource(relativePath, overrides = {}, globals = {}) {
    const filename = path.resolve(__dirname, '../..', relativePath);
    const nativeRequire = createRequire(filename);
    const defaults = {
        'azure-pipelines-task-lib/task': { getVariable: () => undefined },
        'azure-pipelines-tool-lib/tool': {},
        'azure-pipelines-tasks-java-common/java-common': {},
        'typed-rest-client/Handlers': { BearerCredentialHandler: class {} },
        'typed-rest-client/HttpClient': {},
        'sync-request': () => {
            throw new Error('Unexpected network request');
        },
        semver: { lt: () => false },
    };
    const modules = { ...defaults, ...overrides };
    const sandbox = {
        module: { exports: {} },
        require: (name) => (Object.prototype.hasOwnProperty.call(modules, name) ? modules[name] : nativeRequire(name)),
        console,
        process: { ...process, env: { ...process.env } },
        Buffer,
        URL,
        __dirname: path.dirname(filename),
        __filename: filename,
        ...globals,
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
    return sandbox;
}

module.exports = { loadSource };
