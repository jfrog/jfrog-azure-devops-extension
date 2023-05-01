const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs');
const utils = require('@jfrog/tasks-utils/utils.js');

const npmInstallCommand = 'npm i';
const npmPublishCommand = 'npm p';
const npmCiCommand = 'npm ci';
const npmConfigCommand = 'npmc';
let configuredServerIdsArray;

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Determine working directory for the cli.
    let inputWorkingFolder = tl.getInput('workingFolder', false);
    let requiredWorkDir = utils.determineCliWorkDir(defaultWorkDir, inputWorkingFolder);
    if (!fs.existsSync(requiredWorkDir) || !fs.lstatSync(requiredWorkDir).isDirectory()) {
        tl.setResult(tl.TaskResult.Failed, "Provided 'Working folder with package.json': " + requiredWorkDir + ' neither exists nor a directory.');
        return;
    }

    // Determine npm command.
    let inputCommand = tl.getInput('command', true);
    switch (inputCommand) {
        case 'install': {
            performNpmConfigCommand(cliPath, requiredWorkDir, 'sourceRepo', null);
            performNpmCommand(npmInstallCommand, true, cliPath, requiredWorkDir);
            break;
        }
        case 'ci': {
            performNpmConfigCommand(cliPath, requiredWorkDir, 'sourceRepo', null);
            performNpmCommand(npmCiCommand, true, cliPath, requiredWorkDir);
            break;
        }
        case 'custom': {
            let customCommandAndArgs = tl.getInput('customCommandAndArgs', true);
            let npmCustomCommand = 'npm ' + customCommandAndArgs;
            performNpmConfigCommand(cliPath, requiredWorkDir, 'sourceRepo', null);
            performNpmCommand(npmCustomCommand, true, cliPath, requiredWorkDir);
            break;
        }
        case 'pack and publish': {
            performNpmConfigCommand(cliPath, requiredWorkDir, null, 'targetRepo');
            performNpmCommand(npmPublishCommand, false, cliPath, requiredWorkDir);
            break;
        }
    }
}

function performNpmCommand(cliNpmCommand, addThreads, cliPath, requiredWorkDir) {
    // Build the cli command.
    let cliCommand = utils.cliJoin(cliPath, cliNpmCommand);

    // Add npm args
    let npmParam = tl.getInput('arguments', false);
    if (npmParam) {
        cliCommand = utils.cliJoin(cliCommand, npmParam);
    }

    // Add build info collection.
    cliCommand = utils.appendBuildFlagsToCliCommand(cliCommand);

    // Check if need to add threads.
    if (addThreads) {
        cliCommand = utils.addIntParam(cliCommand, 'threads', 'threads');
    }

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.taskDefaultCleanup(cliPath, requiredWorkDir, configuredServerIdsArray);
    }
}

function performNpmConfigCommand(cliPath, requiredWorkDir, repoResolve, repoDeploy) {
    configuredServerIdsArray = utils.createBuildToolConfigFile(cliPath, 'npm', requiredWorkDir, npmConfigCommand, repoResolve, repoDeploy);
}

utils.executeCliTask(RunTaskCbk);
