const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const fs = require('fs');

let serverId;
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
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Determine working directory for the cli.
    let inputWorkingDirectory = tl.getInput('workingDirectory', false);
    let requiredWorkDir = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);
    if (!fs.existsSync(requiredWorkDir) || !fs.lstatSync(requiredWorkDir).isDirectory()) {
        tl.setResult(tl.TaskResult.Failed, "Provided 'Working Directory': " + requiredWorkDir + ' neither exists nor a directory.');
        return;
    }

    serverId = utils.assembleUniqueServerId('jfrog_cli_cmd');
    utils.configureDefaultJfrogServer(serverId, cliPath, requiredWorkDir);

    let cliCommand = tl.getInput('command', true);
    if (!cliCommand.startsWith(utils.jfrogCliToolName + ' ')) {
        tl.setResult(
            tl.TaskResult.Failed,
            "Unexpected JFrog CLI command prefix. Expecting the command to start with 'jf '. The command received is: " + cliCommand
        );
        utils.taskDefaultCleanup(cliPath, requiredWorkDir, [serverId]);
        return;
    }
    try {
        // Remove 'jf' and space from the beginning of the command string, so we can use the CLI's path
        cliCommand = cliCommand.slice(utils.jfrogCliToolName.length + 1);
        cliCommand = utils.cliJoin(cliPath, cliCommand);
        cliCommand = utils.addServerIdOption(cliCommand, serverId);
        // Execute the cli command.
        utils.executeCliCommand(cliCommand, requiredWorkDir);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        utils.taskDefaultCleanup(cliPath, requiredWorkDir, [serverId]);
    }
    tl.setResult(tl.TaskResult.Succeeded, 'Command Succeeded.', cliPath);
}
