/* eslint-env node, mocha */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const scanReport = require('../tasks/JFrogBuildScan/scanReport.js');

const reportUrl = 'https://example.test/xray/builds/scan';
const reportLine = 'The scan data is available at: ' + reportUrl;
const attachmentCommand = '##vso[task.addattachment type=xrayType;name=scanDetails;]';

describe('Build scan report link', function () {
    let workDir;

    beforeEach(function () {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scan-'));
    });

    afterEach(function () {
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    describe('extractScanReportUrl', function () {
        it('reads the report URL from the CLI log line', function () {
            assert.strictEqual(scanReport.extractScanReportUrl('High | CVE-2024-0001 | pkg\n' + reportLine + '\n'), reportUrl);
        });

        it('reads the last report URL when the line is printed more than once', function () {
            assert.strictEqual(scanReport.extractScanReportUrl('The scan data is available at: https://example.test/old\n' + reportLine), reportUrl);
        });

        it('returns no URL when the scan output has none', function () {
            assert.strictEqual(scanReport.extractScanReportUrl('High | CVE-2024-0001 | pkg\n'), '');
            assert.strictEqual(scanReport.extractScanReportUrl('The scan data is available at: \n'), '');
            assert.strictEqual(scanReport.extractScanReportUrl(''), '');
            assert.strictEqual(scanReport.extractScanReportUrl(undefined), '');
        });
    });

    describe('recordScanReport', function () {
        it('saves the report URL in the form the legacy tab already opens', function () {
            const written = captureStream(process.stdout);
            try {
                scanReport.recordScanReport(reportLine + '\n', workDir);
            } finally {
                written.restore();
            }
            const filePath = path.join(workDir, 'scanUrlFile');
            assert.strictEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), reportUrl);
            assert.ok(written.text().includes(attachmentCommand + filePath));
        });

        it('saves the report URL of a failed scan that printed one', function () {
            scanReport.recordScanReport(reportLine + '\nBuild scan returned fail build\n', workDir);
            assert.strictEqual(JSON.parse(fs.readFileSync(path.join(workDir, 'scanUrlFile'), 'utf8')), reportUrl);
        });

        it('saves nothing when the scan output has no report URL', function () {
            scanReport.recordScanReport('scan failed before a report\n', workDir);
            scanReport.recordScanReport(undefined, workDir);
            assert.strictEqual(fs.existsSync(path.join(workDir, 'scanUrlFile')), false);
        });
    });

    describe('captureCliCommand', function () {
        it('echoes the table and the report line when the scan command succeeds', async function () {
            const echoed = captureStream(process.stdout, process.stderr);
            let output;
            try {
                output = await scanReport.captureCliCommand(
                    "node -e \"console.log('vuln table'); console.error('" + reportLine + "')\"",
                    process.cwd(),
                );
            } finally {
                echoed.restore();
            }
            assert.ok(echoed.text().includes('vuln table'));
            assert.ok(echoed.text().includes(reportLine));
            assert.ok(output.includes('vuln table'));
            assert.strictEqual(scanReport.extractScanReportUrl(output), reportUrl);
        });

        it('returns a scan larger than the default pipe buffer and echoes it', async function () {
            const echoed = captureStream(process.stdout);
            let output;
            try {
                output = await scanReport.captureCliCommand(
                    "node -e \"process.stdout.write('x'.repeat(1024 * 1024 + 1)); process.stdout.write('\\n" + reportLine + "\\n')\"",
                    process.cwd(),
                );
            } finally {
                echoed.restore();
            }
            assert.ok(output.length > 1024 * 1024);
            assert.ok(echoed.text().length > 1024 * 1024);
            assert.strictEqual(scanReport.extractScanReportUrl(output), reportUrl);
        });

        [
            { name: 'fails', script: 'process.exit(3)' },
            { name: 'is killed', script: "process.kill(process.pid, 'SIGTERM')" },
        ].forEach(function (testCase) {
            it('keeps the report line when the scan command ' + testCase.name, async function () {
                const echoed = captureStream(process.stdout, process.stderr);
                try {
                    await assert.rejects(
                        scanReport.captureCliCommand('node -e "console.error(\'' + reportLine + "'); " + testCase.script + '"', process.cwd()),
                        (ex) => scanReport.extractScanReportUrl(ex.capturedOutput) === reportUrl,
                    );
                } finally {
                    echoed.restore();
                }
            });
        });

        it('rejects a missing folder and an empty command', function () {
            assert.throws(() => scanReport.captureCliCommand('node -v', path.join(workDir, 'missing')), /doesn't exist/);
            assert.throws(() => scanReport.captureCliCommand('', workDir), /empty Cli command/);
        });

        it('masks secrets in the logged command and keeps the error short', async function () {
            const secret = '--password="top-secret"';
            const scriptFile = path.join(workDir, 'fail.js');
            fs.writeFileSync(scriptFile, 'console.error(process.argv[2]); process.exit(3);');
            const echoed = captureStream(process.stdout, process.stderr);
            try {
                await assert.rejects(
                    scanReport.captureCliCommand('node ' + scriptFile + " '" + secret + "'", process.cwd()),
                    (ex) => ex.message === 'Command failed with exit code 3' && ex.capturedOutput.includes('top-secret'),
                );
            } finally {
                echoed.restore();
            }
            assert.ok(echoed.text().includes('Executing JFrog CLI Command:\nnode ' + scriptFile + " '--password=***'"));
        });
    });

    // Runs the real task file with a stub JFrog CLI, to check what the task does after the scan.
    (process.platform === 'win32' ? describe.skip : describe)('JFrogBuildScan task', function () {
        const taskFile = path.join(__dirname, '..', 'tasks', 'JFrogBuildScan', 'buildScan.js');
        const testsModules = path.join(__dirname, 'node_modules');

        function runTask(bsScript) {
            const nodeModules = path.join(workDir, 'node_modules');
            fs.mkdirSync(path.join(nodeModules, '@jfrog'), { recursive: true });
            fs.symlinkSync(path.join(__dirname, '..', 'jfrog-tasks-utils'), path.join(nodeModules, '@jfrog', 'tasks-utils'));
            const toolsDir = path.join(workDir, 'tools');
            const cliDir = path.join(toolsDir, '_jf', 'current');
            fs.mkdirSync(cliDir, { recursive: true });
            fs.writeFileSync(path.join(cliDir, 'jf'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "jf version 2.133.0"; exit 0; fi\nif [ "$1" = "bs" ]; then\n' + bsScript + '\nfi\nexit 0\n', { mode: 0o755 });
            const agentDir = path.join(workDir, 'agent');
            fs.mkdirSync(agentDir);
            return spawnSync(process.execPath, [taskFile], {
                encoding: 'utf8',
                env: Object.assign({}, process.env, {
                    NODE_PATH: [nodeModules, testsModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
                    AGENT_TOOLSDIRECTORY: toolsDir,
                    AGENT_TEMPDIRECTORY: agentDir,
                    SYSTEM_DEFAULTWORKINGDIRECTORY: agentDir,
                    BUILD_DEFINITIONNAME: 'scan-test',
                    BUILD_BUILDNUMBER: '1',
                    INPUT_BUILDNAME: 'scan-test',
                    INPUT_BUILDNUMBER: '1',
                    INPUT_XRAYCONNECTION: 'XRAYCONN',
                    ENDPOINT_URL_XRAYCONN: 'https://example.test/xray',
                    ENDPOINT_AUTH_SCHEME_XRAYCONN: 'UsernamePassword',
                    ENDPOINT_AUTH_PARAMETER_XRAYCONN_USERNAME: 'user',
                    ENDPOINT_AUTH_PARAMETER_XRAYCONN_PASSWORD: 'pass',
                }),
            });
        }

        it('saves the report link, then fails the task, when the scan fails the build', function () {
            const result = runTask('echo "' + reportLine + '" >&2\nexit 3');
            const attachedAt = result.stdout.indexOf(attachmentCommand);
            const failedAt = result.stdout.indexOf('##vso[task.complete result=Failed;');
            assert.ok(attachedAt !== -1, result.stdout);
            assert.ok(failedAt > attachedAt, result.stdout);
        });

        it('saves the report link when the scan succeeds', function () {
            const result = runTask('echo "' + reportLine + '" >&2\nexit 0');
            assert.ok(result.stdout.includes(attachmentCommand), result.stdout);
            assert.ok(!result.stdout.includes('result=Failed'), result.stdout);
        });

        it('saves no link and does not fail a scan that succeeded without a report line', function () {
            const result = runTask('echo "scan done"\nexit 0');
            assert.ok(!result.stdout.includes('task.addattachment'), result.stdout);
            assert.ok(!result.stdout.includes('result=Failed'), result.stdout);
        });
    });
});

function captureStream(...streams) {
    const chunks = [];
    const originals = streams.map((stream) => {
        const original = stream.write;
        stream.write = function (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk));
            return true;
        };
        return { stream: stream, write: original };
    });
    return {
        text: () => chunks.join(''),
        restore: () => originals.forEach((item) => (item.stream.write = item.write)),
    };
}
