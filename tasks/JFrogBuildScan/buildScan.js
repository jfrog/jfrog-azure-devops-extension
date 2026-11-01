const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const scanReport = require('./scanReport.js');

const cliXrayBuildScanCommand = 'bs';
let serverId;

async function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);

    serverId = await utils.configureDefaultXrayServer('xray_build_scan', cliPath, workDir);

    let cliCommand = utils.cliJoin(cliPath, cliXrayBuildScanCommand, utils.quote(buildName), utils.quote(buildNumber));
    cliCommand = utils.addBoolParam(cliCommand, 'vuln', 'vuln');
    cliCommand = utils.addBoolParam(cliCommand, 'allowFailBuild', 'fail');
    cliCommand = utils.addServerIdOption(cliCommand, serverId);
    cliCommand = utils.addProjectOption(cliCommand);

    try {
        // Echo both streams so the vulnerability table stays in the task log, and keep the text
        // so a printed report URL can be saved even when the CLI exits non-zero.
        console.log('Executing JFrog CLI Command:\n' + cliCommand);
        let scanOutput = await scanReport.captureCliCommand(cliCommand, process.cwd());
        scanReport.recordScanReport(scanOutput, workDir);
    } catch (ex) {
        scanReport.recordScanReport(ex && ex.capturedOutput ? ex.capturedOutput : '', workDir);
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.taskDefaultCleanup(cliPath, workDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
