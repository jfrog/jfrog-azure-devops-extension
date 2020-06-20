const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs');
const utils = require('artifactory-tasks-utils');

const cliGoCommand = 'rt go';
const cliGoPublishCommand = 'rt gp';
const cliGoConfigCommand = 'rt go-config';
let configuredServerId;

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

    // Determine go command and run cli.
    let inputCommand = tl.getInput('command', true);
    switch (inputCommand) {
        // Fall-through if command is build / test / get
        case 'build':
        case 'test':
        case 'get':
            performGoCommand(inputCommand, cliPath, requiredWorkDir);
            break;
        case 'custom':
            let customCommand = tl.getInput('customCommand', true);
            performGoCommand(customCommand, cliPath, requiredWorkDir);
            break;
        case 'publish':
            performGoPublishCommand(cliPath, requiredWorkDir);
            break;
    }
}

function performGoCommand(goCommand, cliPath, requiredWorkDir) {
    // Create config file and configure cli server
    try {
        performGoConfig(cliPath, requiredWorkDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build go command with arguments and execute.
    let cliCommand = utils.cliJoin(cliPath, cliGoCommand, goCommand);
    let goArguments = tl.getInput('goArguments', false);
    if (goArguments) {
        cliCommand = utils.cliJoin(cliCommand, goArguments);
    }
    executeGoCliCommand(cliCommand, cliPath, requiredWorkDir);
}

function performGoConfig(cliPath, requiredWorkDir) {
    configuredServerId = utils.createBuildToolConfigFile(
        cliPath,
        'artifactoryService',
        'go',
        requiredWorkDir,
        cliGoConfigCommand,
        'resolutionRepo',
        null
    );
}

function performGoPublishCommand(cliPath, requiredWorkDir) {
    try {
        configureGoCliServer(cliPath, requiredWorkDir, 'deployer');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build go publish command and execute
    let targetRepo = tl.getInput('targetRepo', true);
    let version = tl.getInput('version', false);
    let cliCommand = utils.cliJoin(cliPath, cliGoPublishCommand, targetRepo, version);
    executeGoCliCommand(cliCommand, cliPath, requiredWorkDir);
}

function executeGoCliCommand(cliCommand, cliPath, requiredWorkDir) {
    // Add build info collection.
    cliCommand = utils.appendBuildFlagsToCliCommand(cliCommand);

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir, null);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.deleteCliServers(cliPath, requiredWorkDir, configuredServerId);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function configureGoCliServer(cliPath, buildDir, serverType) {
    const serverId = utils.assembleBuildToolServerId('go', serverType);
    let artifactoryService = tl.getInput('artifactoryService', false);
    utils.configureCliServer(artifactoryService, serverId, cliPath, buildDir);
    configuredServerId = [serverId]
}

utils.executeCliTask(RunTaskCbk);
