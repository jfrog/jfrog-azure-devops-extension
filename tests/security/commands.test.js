/* eslint-env node */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./helpers');

function source() {
    const calls = [];
    const child = {
        execSync: (...args) => {
            calls.push({ shell: true, args });
            return Buffer.from('');
        },
        execFileSync: (...args) => {
            calls.push({ shell: false, args });
            return Buffer.from('');
        },
    };
    return { ...loadSource('jfrog-tasks-utils/utils.js', { child_process: child }, { console: { log: () => {} } }), calls };
}

test('ordinary CLI invocations never invoke a shell', () => {
    const f = source();
    f.module.exports.executeCliCommand('jf rt ping', process.cwd());
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].shell, false);
    assert.equal(f.calls[0].args[0], 'jf');
    assert.deepEqual(Array.from(f.calls[0].args[1]), ['rt', 'ping']);
});

for (const value of [
    'image"; echo unexpected',
    '$(echo unexpected)',
    '`echo unexpected`',
    '%PATH% & echo unexpected',
    'name\n&& echo unexpected',
    'C:\\Program Files\\',
    'both\'and"quotes',
    '##vso[task.setvariable variable=x;]value',
]) {
    test('one task value remains one literal argument: ' + JSON.stringify(value), () => {
        const f = source();
        const utils = f.module.exports;
        utils.executeCliCommand(utils.cliJoin('jf', 'rt bs', utils.quote(value)), process.cwd());
        assert.equal(f.calls[0].shell, false);
        assert.deepEqual(Array.from(f.calls[0].args[1]), ['rt', 'bs', value]);
    });
}

test('custom arguments retain single/double quotes and Windows paths', () => {
    const f = source();
    f.module.exports.executeCliCommand(
        '"C:\\tools folder\\jf.exe" rt u "C:\\work\\some file" repo/ --props=\'a=one two\' --flat=true',
        process.cwd(),
    );
    assert.equal(f.calls[0].shell, false);
    assert.equal(f.calls[0].args[0], 'C:\\tools folder\\jf.exe');
    assert.deepEqual(Array.from(f.calls[0].args[1]), ['rt', 'u', 'C:\\work\\some file', 'repo/', '--props=a=one two', '--flat=true']);
});

test('CLI version detection never invokes a shell', () => {
    const f = source();
    try {
        f.getCliVersion('jf');
    } catch {
        /* empty fake version output */
    }
    assert.equal(f.calls[0].shell, false);
});

test('a real child process receives metacharacters literally', () => {
    const f = loadSource('jfrog-tasks-utils/utils.js', {}, { console: { log: () => {} } });
    const utils = f.module.exports;
    const values = ['$(echo substituted)', '`echo substituted`', '%PATH%', 'x" & echo injected', "a'b", 'C:\\Program Files\\'];
    const command = utils.cliJoin(
        utils.quote(process.execPath),
        '-e',
        utils.quote('process.stdout.write(JSON.stringify(process.argv.slice(1)))'),
        ...values.map(utils.quote),
    );
    const output = utils.executeCliCommand(command, process.cwd(), { withOutput: true });
    assert.deepEqual(JSON.parse(output.toString()), values);
});

test('Python activation changes the child environment without interpreting CLI arguments', () => {
    const f = loadSource('jfrog-tasks-utils/utils.js', {}, { console: { log: () => {} } });
    const utils = f.module.exports;
    const activationCommand = process.platform === 'win32' ? 'set "JFROG_ACTIVATION_TEST=activated"' : 'export JFROG_ACTIVATION_TEST=activated';
    const command = utils.cliJoin(
        utils.quote(process.execPath),
        '-e',
        utils.quote('process.stdout.write(JSON.stringify([process.env.JFROG_ACTIVATION_TEST, process.argv[1]]))'),
        utils.quote('$(echo substituted)'),
    );
    const result = utils.executeCliCommand(command, process.cwd(), { withOutput: true, activationCommand });
    assert.deepEqual(JSON.parse(result.toString()), ['activated', '$(echo substituted)']);
    assert.equal(process.env.JFROG_ACTIVATION_TEST, undefined);
});

test('malformed command quoting fails before launching any process', () => {
    const f = source();
    assert.throws(() => f.module.exports.executeCliCommand('jf rt u "unterminated', process.cwd()), /Unterminated quote/);
    assert.equal(f.calls.length, 0);
});

test('UNC paths and trailing backslashes survive argument parsing', () => {
    const { parseCommandLine, quoteArgument } = require('../../jfrog-tasks-utils/commandLine');
    assert.deepEqual(parseCommandLine('jf rt u "\\\\server\\share\\file name" repo/'), ['jf', 'rt', 'u', '\\\\server\\share\\file name', 'repo/']);
    for (let n = 0; n < 8; n++) {
        for (const value of ['prefix' + '\\'.repeat(n), '\\'.repeat(n) + '"tail', '\\'.repeat(n) + '"', '']) {
            assert.deepEqual(parseCommandLine(quoteArgument(value)), [value]);
        }
    }
});
