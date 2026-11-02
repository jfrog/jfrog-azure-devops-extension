/* eslint-env node, mocha */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const scanReport = require('../tasks/JFrogBuildScan/scanReport.js');

describe('Build scan report link', function () {
    const reportLine = 'The scan data is available at: https://example.test/xray/builds/scan';
    const tableAndUrl = 'High | CVE-2024-0001 | pkg\n' + reportLine + '\n';

    it('reads the report URL from the CLI log line', function () {
        assert.strictEqual(scanReport.extractScanReportUrl(tableAndUrl), 'https://example.test/xray/builds/scan');
    });

    it('reads the last report URL when the line is printed more than once', function () {
        const output = 'The scan data is available at: https://example.test/old\n' + reportLine;
        assert.strictEqual(scanReport.extractScanReportUrl(output), 'https://example.test/xray/builds/scan');
    });

    it('returns no URL when the scan output has none', function () {
        assert.strictEqual(scanReport.extractScanReportUrl('High | CVE-2024-0001 | pkg\n'), '');
        assert.strictEqual(scanReport.extractScanReportUrl('The scan data is available at: \n'), '');
        assert.strictEqual(scanReport.extractScanReportUrl(''), '');
    });

    it('saves the report URL in the form the legacy tab already opens', function () {
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scan-'));
        const lines = [];
        const originalLog = console.log;
        console.log = function (line) {
            lines.push(line);
        };
        try {
            const url = scanReport.recordScanReport(tableAndUrl, workDir);
            const filePath = path.join(workDir, 'scanUrlFile');
            const body = fs.readFileSync(filePath, 'utf8');
            assert.strictEqual(url, 'https://example.test/xray/builds/scan');
            assert.strictEqual(JSON.parse(body), 'https://example.test/xray/builds/scan');
            assert.ok(lines.indexOf('##vso[task.addattachment type=xrayType;name=scanDetails;]' + filePath) !== -1);
        } finally {
            console.log = originalLog;
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    });

    it('saves nothing when the scan output has no report URL', function () {
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scan-'));
        try {
            const url = scanReport.recordScanReport('scan failed before a report\n', workDir);
            assert.strictEqual(url, '');
            assert.strictEqual(fs.existsSync(path.join(workDir, 'scanUrlFile')), false);
        } finally {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    });

    it('still saves the report URL from a failed scan that printed one', function () {
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scan-'));
        const failedOutput = reportLine + '\nBuild scan returned fail build\n';
        try {
            const url = scanReport.recordScanReport(failedOutput, workDir);
            assert.strictEqual(JSON.parse(fs.readFileSync(path.join(workDir, 'scanUrlFile'), 'utf8')), url);
        } finally {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    });

    it('echoes the table and the report line when the scan command succeeds', async function () {
        const echoed = captureStream(process.stdout, process.stderr);
        try {
            const output = await scanReport.captureCliCommand(
                "node -e \"console.log('vuln table'); console.error('The scan data is available at: https://example.test/ok')\"",
                process.cwd(),
            );
            const echoedText = echoed.text();
            assert.ok(echoedText.includes('vuln table'));
            assert.ok(echoedText.includes('The scan data is available at: https://example.test/ok'));
            assert.ok(output.includes('vuln table'));
            assert.strictEqual(scanReport.extractScanReportUrl(output), 'https://example.test/ok');
        } finally {
            echoed.restore();
        }
    });

    it('returns a scan larger than the default pipe buffer and echoes it', async function () {
        const echoed = captureStream(process.stdout);
        try {
            const output = await scanReport.captureCliCommand(
                "node -e \"process.stdout.write('x'.repeat(1024 * 1024 + 1)); process.stdout.write('\\nThe scan data is available at: https://example.test/big\\n')\"",
                process.cwd(),
            );
            assert.ok(output.length > 1024 * 1024);
            assert.ok(echoed.text().length > 1024 * 1024);
            assert.strictEqual(scanReport.extractScanReportUrl(output), 'https://example.test/big');
        } finally {
            echoed.restore();
        }
    });

    it('keeps the report line when the scan command fails', async function () {
        try {
            await scanReport.captureCliCommand(
                'node -e "console.error(\'The scan data is available at: https://example.test/fail\'); process.exit(3)"',
                process.cwd(),
            );
            assert.fail('expected the command to fail');
        } catch (ex) {
            const output = ex && ex.capturedOutput ? ex.capturedOutput : '';
            assert.strictEqual(scanReport.extractScanReportUrl(output), 'https://example.test/fail');
        }
    });

    it('keeps the report line when the scan command is killed', async function () {
        let thrown = null;
        try {
            await scanReport.captureCliCommand(
                "node -e \"console.error('The scan data is available at: https://example.test/sig'); process.kill(process.pid, 'SIGTERM')\"",
                process.cwd(),
            );
        } catch (ex) {
            thrown = ex;
        }
        assert.ok(thrown, 'expected the command to fail');
        const output = thrown.capturedOutput ? thrown.capturedOutput : '';
        assert.strictEqual(scanReport.extractScanReportUrl(output), 'https://example.test/sig');
    });
});

function captureStream() {
    const streams = Array.prototype.slice.call(arguments);
    const chunks = [];
    const originals = streams.map(function (stream) {
        const original = stream.write;
        stream.write = function (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk));
            return true;
        };
        return { stream: stream, write: original };
    });
    return {
        text: function () {
            return chunks.join('');
        },
        restore: function () {
            originals.forEach(function (item) {
                item.stream.write = item.write;
            });
        },
    };
}
