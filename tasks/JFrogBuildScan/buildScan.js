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
    cliCommand = utils.addBoolParam(cliCommand, 'vuln', 'vuln');
    cliCommand = utils.addBoolParam(cliCommand, 'allowFailBuild', 'fail');
    cliCommand = utils.addServerIdOption(cliCommand, serverId);
    cliCommand = utils.addProjectOption(cliCommand)

    try {
        utils.executeCliCommand(cliCommand, process.cwd(), null);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
