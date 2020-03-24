const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');

const npmInstallCommand = 'rt npmi';
const npmPublishCommand = 'rt npmp';
const npmCiCommand = 'rt npmci';
const npmConfigCommand = 'rt npmc';

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Get input parameters.
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');

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
        case 'install':
            performNpmConfigCommand(cliPath, tl.getInput('sourceRepo', true), requiredWorkDir);
            performNpmCommand(npmInstallCommand, true, cliPath, collectBuildInfo, requiredWorkDir);
            break;
        case 'ci':
            performNpmConfigCommand(cliPath, tl.getInput('sourceRepo', true), requiredWorkDir);
            performNpmCommand(npmCiCommand, true, cliPath, collectBuildInfo, requiredWorkDir);
            break;
        case 'pack and publish':
            performNpmConfigCommand(cliPath, tl.getInput('targetRepo', true), requiredWorkDir);
            performNpmCommand(npmPublishCommand, false, cliPath, collectBuildInfo, requiredWorkDir);
            break;
    }
}

function performNpmCommand(cliNpmCommand, addThreads, cliPath, collectBuildInfo, requiredWorkDir) {
    // Build the cli command.
    let cliCommand = utils.cliJoin(cliPath, cliNpmCommand);

    // Add npm args
    let npmParam = tl.getInput('arguments', false);
    if (npmParam) {
        cliCommand = utils.cliJoin(cliCommand, npmParam);
    }

    // Add build info collection.
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, getCollectBuildInfoFlags(addThreads));
    }

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

function performNpmConfigCommand(cliPath, repo, requiredWorkDir) {
    const serverId = utils.assembleBuildToolServerId('npm', tl.getInput('command', true));
    const artifactoryService = tl.getInput('artifactoryService', false);
    utils.createBuildToolConfigFile(cliPath, artifactoryService, serverId, repo, requiredWorkDir, npmConfigCommand);
}

function getCollectBuildInfoFlags(addThreads) {
    // Construct the build-info collection flags.
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let commandAddition = utils.cliJoin('--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));

    // Check if need to add threads.
    if (addThreads) {
        let buildInfoThreads = tl.getInput('threads');
        commandAddition = utils.cliJoin(commandAddition, '--threads=' + utils.quote(buildInfoThreads));
    }

    return commandAddition;
}

utils.executeCliTask(RunTaskCbk);
