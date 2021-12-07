const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs');
const utils = require('@jfrog/artifactory-tasks-utils/utils.js');

const cliGoCommand = 'rt go';
const cliGoPublishCommand = 'rt gp';
const cliGoConfigCommand = 'rt go-config';
const newGpCommandMinVersion = '1.46.1';
const resolutionRepoInputName = 'resolutionRepo';
const deploymentRepoInputName = 'targetRepo';
let configuredServerIdsArray;

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
        performGoConfig(cliPath, requiredWorkDir, resolutionRepoInputName, null);
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

/**
 * Creates go config file.
 * @param cliPath - JFrog CLI path.
 * @param requiredWorkDir - Working Directory to run in.
 * @param repoResolve - Resolution repo input name, null if not needed.
 * @param repoDeploy - Deployment repo input name, null if not needed.
 */
function performGoConfig(cliPath, requiredWorkDir, repoResolve, repoDeploy) {
    configuredServerIdsArray = utils.createBuildToolConfigFile(
        cliPath,
        'artifactoryService',
        'go',
        requiredWorkDir,
        cliGoConfigCommand,
        repoResolve,
        repoDeploy
    );
}

function performLegacyGoPublishCommand(cliPath, requiredWorkDir, version) {
    try {
        configureGoCliServer(cliPath, requiredWorkDir, 'deployer');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build go publish command and execute
    let targetRepo = tl.getInput('targetRepo', true);
    let cliCommand = utils.cliJoin(cliPath, cliGoPublishCommand, targetRepo, version);
    executeGoCliCommand(cliCommand, cliPath, requiredWorkDir);
}

function performGoPublishCommand(cliPath, requiredWorkDir) {
    let version = tl.getInput('version', false);

    if (shouldUseLegacyGpCmd()) {
        performLegacyGoPublishCommand(cliPath, requiredWorkDir, version);
        return;
    }

    try {
        performGoConfig(cliPath, requiredWorkDir, null, deploymentRepoInputName);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build go publish command and execute
    let cliCommand = utils.cliJoin(cliPath, cliGoPublishCommand, version);
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
        utils.deleteCliServers(cliPath, requiredWorkDir, configuredServerIdsArray);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function configureGoCliServer(cliPath, buildDir, serverType) {
    const serverId = utils.assembleBuildToolServerId('go', serverType);
    let artifactoryService = tl.getInput('artifactoryService', false);
    utils.configureCliServer(artifactoryService, serverId, cliPath, buildDir);
    configuredServerIdsArray = [serverId];
}

function shouldUseLegacyGpCmd() {
    let cliVersion = tl.getVariable(utils.taskSelectedCliVersionEnv);
    return utils.compareVersions(cliVersion, newGpCommandMinVersion) < 0;
}

utils.executeCliTask(RunTaskCbk);
