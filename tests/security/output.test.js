/* eslint-env node */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./helpers');

test('file spec contents cannot become Azure agent commands', () => {
    const payload = '{\n##vso[task.setvariable variable=INJECTED;]true\n}';
    const logs = [],
        writes = [];
    const { module } = loadSource(
        'jfrog-tasks-utils/utils.js',
        {
            'azure-pipelines-task-lib/task': { getVariable: () => undefined, getInput: () => payload, writeFile: (...args) => writes.push(args) },
        },
        { console: { log: (...args) => logs.push(args.join(' ')) } },
    );
    module.exports.writeSpecContentToSpecPath('taskConfiguration', 'spec.json');
    assert.ok(!logs.join('\n').includes('##vso['));
    assert.equal(writes[0][1], payload, 'The CLI must still receive the original content');
});

test('issue configuration contents cannot become Azure agent commands', () => {
    const payload = '##vso[task.prependpath]/untrusted/path';
    const logs = [],
        writes = [];
    const source = loadSource(
        'tasks/JFrogCollectIssues/collectIssues.js',
        {
            '@jfrog/tasks-utils/utils.js': { executeCliTask: () => {} },
            'azure-pipelines-task-lib/task': { getInput: () => payload, writeFile: (...args) => writes.push(args) },
        },
        { console: { log: (...args) => logs.push(args.join(' ')) } },
    );
    source.writeConfigFile('taskConfiguration', 'config.yaml');
    assert.ok(!logs.join('\n').includes('##vso['));
    assert.equal(writes[0][1], payload);
});

test('command diagnostics redact passphrases and encode Azure command markers', () => {
    const logs = [];
    const source = loadSource(
        'jfrog-tasks-utils/utils.js',
        {
            child_process: { execSync: () => Buffer.from(''), execFileSync: () => Buffer.from('') },
        },
        { console: { log: (value) => logs.push(value) } },
    );
    source.module.exports.executeCliCommand(
        'jf ds rbs name version --passphrase="private value"\n##vso[task.complete result=Succeeded;]',
        process.cwd(),
    );
    assert.ok(!logs.join('\n').includes('private value'));
    assert.ok(!logs.join('\n').includes('##vso['));
});

function ui() {
    let callback;
    const elements = [];
    function element(tag) {
        const e = {
            tag,
            classList: { add: () => {} },
            children: [],
            append(...children) {
                this.children.push(...children);
            },
        };
        elements.push(e);
        return e;
    }
    loadSource(
        'scripts/build-info.js',
        {},
        {
            define: (deps, factory) =>
                factory({
                    getClient: () => ({
                        getPlanAttachments: async () => [{ recordId: 'record', timelineId: 'timeline', name: 'buildDetails' }],
                        getAttachmentContent: async () => Buffer.from(JSON.stringify(ui.details)),
                    }),
                }),
            VSS: {
                getConfiguration: () => ({
                    onBuildChanged: (fn) => {
                        callback = fn;
                    },
                }),
                getWebContext: () => ({ project: { id: 'project' } }),
                notifyLoadSucceeded: () => {},
            },
            $: () => ({ append: () => {} }),
            document: { createElement: element },
            Uint8Array,
        },
    );
    return async (details) => {
        ui.details = details;
        callback({ orchestrationPlan: { planId: 'plan' } });
        await new Promise((resolve) => setImmediate(resolve));
        return elements;
    };
}

for (const url of [
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'https://evil.example/phishing',
    'https://user:password@artifactory.example/build',
]) {
    test('build-info rejects an unsafe destination: ' + url.split(':')[0], async () => {
        const elements = await ui()({ artifactoryUrl: 'https://artifactory.example/artifactory', buildInfoUiUrl: url });
        assert.ok(!elements.some((e) => e.tag === 'a' && e.href));
    });
}

test('build-info allows a same-origin URL and makes the destination visible', async () => {
    const elements = await ui()({
        artifactoryUrl: 'https://artifactory.example/artifactory',
        buildInfoUiUrl: 'https://artifactory.example/ui/builds/123',
    });
    const link = elements.find((e) => e.tag === 'a');
    assert.equal(link.href, 'https://artifactory.example/ui/builds/123');
    assert.match(link.text, /artifactory\.example/);
    assert.equal(link.rel, 'noopener noreferrer');
});
