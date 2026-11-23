/* eslint-env node */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./helpers');

function fixture({ status = 200, exchangeBody, platformUrl = 'https://example.jfrog.io' } = {}) {
    const idToken =
        'header.' +
        Buffer.from(JSON.stringify({ sub: 'sc://org/project/service', iss: 'https://issuer', aud: 'audience' })).toString('base64') +
        '.signature';
    const calls = [],
        commands = [],
        logs = [],
        secrets = [],
        outputs = [];
    const tl = {
        getVariable: (key) =>
            ({ 'System.AccessToken': 'ado-oauth', 'System.CollectionUri': 'https://dev.azure.com/org/', 'Build.Repository.Name': 'repository' })[key],
        getEndpointAuthorizationScheme: () => 'oidc',
        getEndpointAuthorizationParameter: (service, key) =>
            ({ oidcProviderName: 'provider', oidcAudience: 'audience', jfrogPlatformUrl: platformUrl })[key],
        getEndpointUrl: () => platformUrl,
        setSecret: (value) => secrets.push(value),
        setVariable: (...args) => outputs.push(args),
        debug: (value) => logs.push(value),
    };
    const source = loadSource(
        'jfrog-tasks-utils/utils.js',
        {
            'azure-pipelines-task-lib/task': tl,
            child_process: {
                execFileSync: (executable, args, options) => {
                    const command = [executable, ...args].join(' ');
                    commands.push({ command, options });
                    return Buffer.from(command.includes('--version') ? 'jf version 2.130.0' : '{"AccessToken":"jfrog-token","Username":"user"}');
                },
                execSync: (command, options) => {
                    commands.push({ command, options });
                    return Buffer.from(command.includes('--version') ? 'jf version 2.130.0' : '{"AccessToken":"jfrog-token","Username":"user"}');
                },
            },
            'typed-rest-client/HttpClient': {
                HttpClient: class {
                    constructor(agent, handlers, options) {
                        this.options = options;
                    }
                    async post(url, data) {
                        calls.push({ url, body: JSON.parse(data), options: this.options });
                        const azure = url.includes('/oidctoken?');
                        return {
                            message: { statusCode: azure ? 200 : status },
                            readBody: async () =>
                                azure
                                    ? JSON.stringify({ oidcToken: idToken })
                                    : exchangeBody || JSON.stringify({ access_token: 'jfrog-token', username: 'user' }),
                        };
                    }
                },
            },
        },
        {
            console: {
                log: (...args) => logs.push(args.join(' ')),
                debug: (...args) => logs.push(args.join(' ')),
                warn: (...args) => logs.push(args.join(' ')),
            },
        },
    );
    return { source, idToken, calls, commands, logs, secrets, outputs };
}

test('normal task OIDC exchange keeps the ID token out of logs and child processes', async () => {
    const f = fixture();
    const token = await f.source.exchangeOidcTokenAndSetStepVariables('svc', 'https://example.jfrog.io', 'provider', 'jf', process.cwd());
    assert.equal(token, 'jfrog-token');
    assert.ok(!JSON.stringify(f.commands).includes(f.idToken), 'ID token reached a child process');
    assert.ok(!f.logs.join('\n').includes(f.idToken), 'ID token reached the task log');
    assert.ok(f.secrets.includes(f.idToken), 'Azure ID token must be registered for masking');
    const exchange = f.calls.find((call) => call.url.endsWith('/access/api/v1/oidc/token'));
    assert.equal(exchange.body.subject_token, f.idToken);
    assert.equal(exchange.body.provider_name, 'provider');
    assert.equal(exchange.body.provider_type, 'Azure');
    assert.equal(exchange.body.audience, 'audience');
    assert.equal(exchange.body.repo, 'repository');
    assert.equal(exchange.options.allowRedirects, false);
    assert.ok(f.outputs.some(([key, value, secret]) => key === 'oidc_token' && value === token && secret === true));
});

test('OIDC rejects plaintext endpoints before requesting a token', async () => {
    const f = fixture();
    await assert.rejects(() => f.source.module.exports.exchangeOidcTokenViaRest('svc', 'http://example.jfrog.io', 'provider'), /HTTPS/);
    assert.equal(f.calls.length, 0);
});

test('OIDC failures do not echo a server response that contains credentials', async () => {
    const f = fixture({ status: 403, exchangeBody: 'sensitive-server-response' });
    await assert.rejects(
        () => f.source.module.exports.exchangeOidcTokenViaRest('svc', 'https://example.jfrog.io', 'provider'),
        (err) => {
            assert.match(err.message, /HTTP 403/);
            assert.ok(!err.message.includes('sensitive-server-response'));
            return true;
        },
    );
});

test('malformed token responses do not leak JSON parser excerpts', async () => {
    const f = fixture({ exchangeBody: 'sensitive-server-response' });
    await assert.rejects(
        () => f.source.module.exports.exchangeOidcTokenViaRest('svc', 'https://example.jfrog.io', 'provider'),
        (err) => {
            assert.match(err.message, /invalid JSON/);
            assert.ok(!err.message.includes('sensitive-server-response'));
            return true;
        },
    );
});
