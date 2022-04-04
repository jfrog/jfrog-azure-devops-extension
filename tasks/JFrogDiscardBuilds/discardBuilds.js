const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');

const cliDiscardCommand = 'rt bdi';
let serverId;

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    serverId = utils.configureDefaultArtifactoryServer('discard_build', cliPath, workDir);

    let buildName = tl.getInput('buildName', true);

    let cliCommand = utils.cliJoin(cliPath, cliDiscardCommand, utils.quote(buildName));
    cliCommand = utils.addStringParam(cliCommand, 'maxDays', 'max-days', false);
    cliCommand = utils.addStringParam(cliCommand, 'maxBuilds', 'max-builds', false);
    cliCommand = utils.addStringParam(cliCommand, 'excludeBuilds', 'exclude-builds', false);
    cliCommand = utils.addBoolParam(cliCommand, 'deleteArtifacts', 'delete-artifacts');
    cliCommand = utils.addBoolParam(cliCommand, 'async', 'async');
    cliCommand = utils.addProjectOption(cliCommand);
    cliCommand = utils.addServerIdOption(cliCommand, serverId);

    try {
        utils.executeCliCommand(cliCommand, process.cwd());
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.taskDefaultCleanup(cliPath, workDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
