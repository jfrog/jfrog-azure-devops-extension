const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils/utils.js');

const cliExecName = 'jf';
const cliCommandPrefix = cliExecName + ' rt '; //todo

RunJfrogCliCommand(RunTaskCbk);

function RunJfrogCliCommand(RunTaskCbk) {
    // If no custom version requested, run with the version of the rest of the pipeline.
    if (!tl.getBoolInput('useCustomVersion')) {
        utils.executeCliTask(RunTaskCbk);
        return;
    }
    // Custom version selected, but placeholder provided.
    if (tl.getInput('cliVersion', true).localeCompare('$(jfrogCliVersion)') === 0) {
        utils.executeCliTask(RunTaskCbk);
        return;
    }

    let cliVersion = tl.getInput('cliVersion', true);
    // If the min version allowed is higher than the requested version we will fail the task.
    if (utils.compareVersions(utils.minCustomCliVersion, cliVersion) > 0) {
        tl.setResult(tl.TaskResult.Failed, 'Custom JFrog CLI Version must be at least ' + utils.minCustomCliVersion);
        return;
    }
    utils.executeCliTask(RunTaskCbk, cliVersion);
}

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    let artifactoryService = tl.getInput('artifactoryService', false);
    let cliCommand = tl.getInput('command', true);
    if (!cliCommand.startsWith(cliCommandPrefix)) {
        tl.setResult(
            tl.TaskResult.Failed,
            "Unexpected JFrog CLI command prefix. Expecting the command to start with 'jf rt'. The command received is: " + cliCommand
        );
        return;
    }
    try {
        let serverId = 'rt-server-' + utils.getCurrentTimestamp();
        // Execute the cli config command.
        utils.configureCliServer(artifactoryService, serverId, cliPath, workDir);
        // Use the server we just created
        utils.useCliServer(serverId, cliPath, workDir);
        // Remove 'jf' and space from the beginning of the command string, so we can use the CLI's path
        cliCommand = cliCommand.slice(cliExecName.length + 1);
        cliCommand = utils.cliJoin(cliPath, cliCommand);
        // Execute the cli command.
        utils.executeCliCommand(cliCommand, workDir);
        // delete the server we configured
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    }
    tl.setResult(tl.TaskResult.Succeeded, 'Command Succeeded.', cliPath);
}
