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

    serverId = utils.assembleUniqueServerId('xray_build_scan');
    if (!utils.configureDefaultJfrogServer(serverId, cliPath, workDir)) {
        utils.configureDefaultXrayServer(serverId, cliPath, workDir);
    }

    let allowFailBuild = tl.getBoolInput('allowFailBuild', false);

    let cliCommand = utils.cliJoin(
        cliPath,
        cliXrayBuildScanCommand,
        utils.quote(buildName),
        utils.quote(buildNumber),
        '--fail=true',
        '--format=table'
    );

    // Add watches source if provided.
    let watchesSource = tl.getInput('watchesSource', false);
    if (watchesSource !== 'none') {
        cliCommand = utils.addStringParam(cliCommand, watchesSource, watchesSource, true);
    }
    cliCommand = utils.addBoolParam(cliCommand, 'vuln', 'vuln');
    utils.addServerIdOption(cliCommand, serverId);

    try {
        utils.executeCliCommand(cliCommand, process.cwd(), null);
    } catch (ex) {
        // Fail task iff the CLI throw exit code 3 and allowFailBuild is enabled.
        if (ex.status === 3) {
            if (allowFailBuild) {
                tl.setResult(tl.TaskResult.Failed, "Build scan returned 'Fail Build'.");
            } else {
                tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
            }
        } else {
            tl.setResult(tl.TaskResult.Failed, ex);
        }
    } finally {
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
