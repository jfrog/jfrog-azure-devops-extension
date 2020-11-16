const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const cliExecName = 'jfrog';
const cliCommandPrefix = cliExecName + ' rt ';

RunJfrogCliCommand(RunTaskCbk);

function RunJfrogCliCommand(RunTaskCbk) {
    let cliVersion = utils.defaultJfrogCliVersion;
    // If a custom version was requested and provided (by a variable or a specific value) we will try to use it
    if (tl.getBoolInput('useCustomVersion') && tl.getInput('cliVersion', true).localeCompare('$(jfrogCliVersion)') !== 0) {
        cliVersion = tl.getInput('cliVersion', true);
        // If the min version allowed is higher than the requested version we will fail the task.
        if (utils.comparVersions(utils.minCustomCliVersion, cliVersion) > 0) {
            tl.setResult(tl.TaskResult.Failed, 'Custom JFrog CLI Version must be at least ' + utils.minCustomCliVersion);
            return;
        }
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
            "Unexpected JFrog CLI command prefix. Expecting the command to start with 'jfrog rt'. The command received is: ",
            cliCommand
        );
        return;
    }
    try {
        let serverId = 'rt-server-' + utils.getCurrentTimestamp();
        // Execute the cli config command.
        utils.configureCliServer(artifactoryService, serverId, cliPath, workDir);
        // Use the server we just created
        utils.useCliServer(serverId, cliPath, workDir);
        // Remove 'jfrog' and space from the beginning of the command string, so we can use the CLI's path
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
