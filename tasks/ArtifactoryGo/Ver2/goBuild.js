const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');
const path = require('path');

const cliGoNativeCommand = 'rt go';
const cliGoPublishCommand = 'rt gp';
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
            performGoNativeCommand(inputCommand, cliPath, requiredWorkDir);
            break;
        case 'custom':
            let customCommand = tl.getInput('customCommand', true);
            performGoNativeCommand(customCommand, cliPath, requiredWorkDir);
            break;
        case 'publish':
            performGoPublishCommand(cliPath, requiredWorkDir);
            break;
    }
}

function performGoNativeCommand(goCommand, cliPath, requiredWorkDir) {
    // Create config file and configure cli server
    let configPath = path.join(requiredWorkDir, '.jfrog', 'projects', 'go.yaml');
    try {
        createGoConfigFile(configPath, cliPath, requiredWorkDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build go command with arguments and execute.
    let cliCommand = utils.cliJoin(cliPath, cliGoNativeCommand, goCommand);
    let goArguments = tl.getInput('goArguments', false);
    if (goArguments) {
        cliCommand = utils.cliJoin(cliCommand, goArguments);
    }
    executeGoCliCommand(cliCommand, cliPath, requiredWorkDir);
}

function createGoConfigFile(configPath, cliPath, requiredWorkDir) {
    configureGoCliServer(cliPath, requiredWorkDir, 'resolver');
    let resolutionRepo = tl.getInput('resolutionRepo', true);
    let resolverObj = { serverId: configuredServerId, repo: resolutionRepo };
    utils.createBuildToolConfigFile(configPath, 'go', resolverObj, {});
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
        cleanup(cliPath, requiredWorkDir);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function configureGoCliServer(cliPath, buildDir, serverType) {
    configuredServerId = utils.assembleBuildToolServerId('go', serverType);
    let artifactoryService = tl.getInput('artifactoryService', false);
    utils.configureCliServer(artifactoryService, configuredServerId, cliPath, buildDir);
}

function cleanup(cliPath, workDir) {
    // Delete servers.
    try {
        utils.deleteCliServers(cliPath, workDir, [configuredServerId]);
    } catch (deleteServersException) {
        tl.setResult(tl.TaskResult.Failed, deleteServersException);
    }
}

utils.executeCliTask(RunTaskCbk);
