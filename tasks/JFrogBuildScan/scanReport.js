const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');
const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');

// Matches ANSI colour and cursor codes. The pattern needs the escape character.
// eslint-disable-next-line no-control-regex
const ansiPattern = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const scanReportPattern = /The scan data is available at:[ \t]*(\S+)/g;

/**
 * Last report URL printed by JFrog CLI, or an empty string when the line is absent.
 * @param {string} output
 * @returns {string}
 */
function extractScanReportUrl(output) {
    const matches = [...String(output || '').replace(ansiPattern, '').matchAll(scanReportPattern)];
    return matches.length ? matches[matches.length - 1][1] : '';
}

/**
 * Write the scan URL the way the legacy Artifactory tab reads it.
 * The file body is a JSON string, and the attachment is xrayType/scanDetails.
 * Does nothing when the output has no report URL.
 * @param {string} output
 * @param {string} dir - Folder for the attachment file.
 */
function recordScanReport(output, dir) {
    const url = extractScanReportUrl(output);
    if (!url) {
        return;
    }
    const filePath = path.join(dir, 'scanUrlFile');
    fs.writeFileSync(filePath, JSON.stringify(url));
    tl.addAttachment('xrayType', 'scanDetails', filePath);
}

/**
 * Run a CLI command, echo both streams as they arrive so a long table is not cut off, and return them together.
 * A non-zero exit or a signal rejects with a short error. Its capturedOutput still holds both streams.
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
    console.log('Executing JFrog CLI Command:\n' + utils.maskSecrets(cliCommand));
    return new Promise((resolve, reject) => {
        const child = spawn(cliCommand, { shell: true, cwd: runningDir, stdio: ['inherit', 'pipe', 'pipe'] });
        let output = '';
        // One decoder per stream keeps a character that is split across two chunks whole.
        const tee = (stream) => {
            const decoder = new StringDecoder('utf8');
            return (chunk) => {
                const text = decoder.write(chunk);
                stream.write(text);
                output += text;
            };
        };
        const fail = (error) => {
            error.message = utils.maskSecrets(error.message);
            error.capturedOutput = output;
            reject(error);
        };

        child.stdout.on('data', tee(process.stdout));
        child.stderr.on('data', tee(process.stderr));
        child.on('error', fail);
        child.on('close', (status, signal) => {
            if (signal) {
                fail(new Error('Command ended by signal ' + signal));
            } else if (status) {
                fail(new Error('Command failed with exit code ' + status));
            } else {
                resolve(output);
            }
        });
    });
}

module.exports = {
    extractScanReportUrl: extractScanReportUrl,
    recordScanReport: recordScanReport,
    captureCliCommand: captureCliCommand,
};
