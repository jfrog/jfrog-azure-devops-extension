const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');

const cliPromoteCommand = 'rt bpr';
let serverId;

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    serverId = utils.configureDefaultJfrogOrArtifactoryServer('build_promotion', cliPath, workDir);

    // Get input parameters
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let targetRepo = tl.getInput('targetRepo', true);

    let cliCommand = utils.cliJoin(cliPath, cliPromoteCommand, utils.quote(buildName), utils.quote(buildNumber), utils.quote(targetRepo));

    cliCommand = utils.addStringParam(cliCommand, 'status', 'status', false);
    cliCommand = utils.addStringParam(cliCommand, 'comment', 'comment', false);
    cliCommand = utils.addStringParam(cliCommand, 'sourceRepo', 'source-repo', false);
    cliCommand = utils.addBoolParam(cliCommand, 'includeDependencies', 'include-dependencies');
    cliCommand = utils.addBoolParam(cliCommand, 'copy', 'copy');
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');
    cliCommand = utils.addProjectOption(cliCommand);
    cliCommand = utils.addServerIdOption(cliCommand, serverId);

    try {
        utils.executeCliCommand(cliCommand, process.cwd());
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
