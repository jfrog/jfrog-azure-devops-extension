const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const scanReportPattern = /The scan data is available at:[ \t]*(\S+)/g;

/**
 * Last report URL printed by JFrog CLI, or an empty string when the line is absent.
 * @param {string} output
 * @returns {string}
 */
function extractScanReportUrl(output) {
    if (!output) {
        return '';
    }
    let url = '';
    const pattern = new RegExp(scanReportPattern.source, 'g');
    let match = pattern.exec(String(output));
    while (match) {
        url = match[1];
        match = pattern.exec(String(output));
    }
    return url;
}

/**
 * Write the scan URL the way the legacy Artifactory tab reads it.
 * The file body is a JSON string, and the logging command publishes xrayType/scanDetails.
 * @param {string} output
 * @param {string} workDir
 * @returns {string} The saved URL, or an empty string when output has none.
 */
function recordScanReport(output, workDir) {
    const url = extractScanReportUrl(output);
    if (!url) {
        return '';
    }
    const filePath = path.join(workDir, 'scanUrlFile');
    fs.writeFileSync(filePath, JSON.stringify(url));
    console.log('##vso[task.addattachment type=xrayType;name=scanDetails;]' + filePath);
    return url;
}

/**
 * Run a CLI command, echo both streams as they arrive so a long table is not cut off, and return them together.
 * A non-zero exit or a signal throws an error whose capturedOutput still holds both streams.
 * @param {string} cliCommand
 * @param {string} runningDir
 * @returns {Promise<string>}
 */
function captureCliCommand(cliCommand, runningDir) {
    if (!fs.existsSync(runningDir)) {
        throw "JFrog CLI execution path doesn't exist: " + runningDir;
    }
    if (!cliCommand) {
        throw 'Cannot execute empty Cli command.';
    }
    return new Promise((resolve, reject) => {
        const child = spawn(cliCommand, { shell: true, cwd: runningDir });
        let output = '';
        let settled = false;

        function append(chunk, stream) {
            const text = chunk.toString();
            stream.write(text);
            output += text;
        }

        function finish(error) {
            if (settled) {
                return;
            }
            settled = true;
            if (error) {
                error.capturedOutput = output;
                reject(error);
                return;
            }
            resolve(output);
        }

        child.stdout.on('data', (chunk) => {
            append(chunk, process.stdout);
        });
        child.stderr.on('data', (chunk) => {
            append(chunk, process.stderr);
        });
        child.on('error', (error) => {
            finish(error);
        });
        child.on('close', (status, signal) => {
            if (signal || status) {
                const error = new Error(signal ? 'Command ended by signal ' + signal : output || 'Command failed');
                finish(error);
                return;
            }
            finish();
        });
    });
}

module.exports = {
    extractScanReportUrl: extractScanReportUrl,
    recordScanReport: recordScanReport,
    captureCliCommand: captureCliCommand,
};
