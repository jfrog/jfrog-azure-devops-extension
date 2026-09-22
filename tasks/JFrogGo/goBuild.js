const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs');
const utils = require('@jfrog/tasks-utils/utils.js');

const cliGoCommand = 'go';
const cliGoPublishCommand = 'gp';
const cliGoConfigCommand = 'go-config';
const resolutionRepoInputName = 'resolutionRepo';
const deploymentRepoInputName = 'targetRepo';
let configuredServerIdsArray;

async function RunTaskCbk(cliPath) {
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
        case 'get': {
            await performGoCommand(inputCommand, cliPath, requiredWorkDir);
            break;
        }
        case 'custom': {
            let customCommand = tl.getInput('customCommand', true);
            await performGoCommand(customCommand, cliPath, requiredWorkDir);
            break;
        }
        case 'publish': {
            await performGoPublishCommand(cliPath, requiredWorkDir);
            break;
        }
    }
}

async function performGoCommand(goCommand, cliPath, requiredWorkDir) {
    // Create config file and configure cli server
    try {
        await performGoConfig(cliPath, requiredWorkDir, resolutionRepoInputName, null);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build go command with arguments and execute.
    let cliCommand = utils.cliJoin(cliPath, cliGoCommand, goCommand);
    let goArguments = tl.getInput('goArguments', false);
    if (goArguments) {
        // Block the '-exec' flag, which allows running an arbitrary program instead of the compiled binary,
        // enabling arbitrary command execution during 'go build'/'go test'/'go run'.
        if (/(^|\s)-{1,2}exec(=|\s|$)/i.test(goArguments)) {
            tl.setResult(tl.TaskResult.Failed, "The 'goArguments' input must not contain the '-exec' flag.");
            return;
        }
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
async function performGoConfig(cliPath, requiredWorkDir, repoResolve, repoDeploy) {
    configuredServerIdsArray = await utils.createBuildToolConfigFile(cliPath, 'go', requiredWorkDir, cliGoConfigCommand, repoResolve, repoDeploy);
}

async function performGoPublishCommand(cliPath, requiredWorkDir) {
    let version = tl.getInput('version', false);

    try {
        await performGoConfig(cliPath, requiredWorkDir, null, deploymentRepoInputName);
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
        utils.executeCliCommand(cliCommand, requiredWorkDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.taskDefaultCleanup(cliPath, requiredWorkDir, configuredServerIdsArray);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

utils.executeCliTask(RunTaskCbk);
