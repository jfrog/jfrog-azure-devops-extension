const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');

const cliXrayBuildScanCommand = 'bs';
let serverId;

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);

    serverId = utils.configureDefaultXrayServer('xray_build_scan', cliPath, workDir);

    let cliCommand = utils.cliJoin(cliPath, cliXrayBuildScanCommand, utils.quote(buildName), utils.quote(buildNumber));

    // Add watches source if provided.
    let watchesSource = tl.getInput('watchesSource', false);
    if (watchesSource !== 'none') {
        cliCommand = utils.addStringParam(cliCommand, watchesSource, watchesSource, true);
    }
    cliCommand = utils.addBoolParam(cliCommand, 'vuln', 'vuln');
    cliCommand = utils.addBoolParam(cliCommand, 'allowFailBuild', 'fail');
    utils.addServerIdOption(cliCommand, serverId);

    try {
        utils.executeCliCommand(cliCommand, process.cwd(), null);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
