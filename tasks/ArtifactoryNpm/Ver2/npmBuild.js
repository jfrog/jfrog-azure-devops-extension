const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');

const npmInstallCommand = 'rt npmi';
const npmPublishCommand = 'rt npmp';
const npmCiCommand = 'rt npmci';
const npmConfigCommand = 'rt npmc';
const serverId = 'npmServerIdDeployResolve';

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Get input parameters.
    let artifactoryService = tl.getInput('artifactoryService', false);
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
            performNpmConfigCommand(cliPath, artifactoryService, tl.getInput('sourceRepo', true), requiredWorkDir);
            performNpmCommand(npmInstallCommand, true, cliPath, collectBuildInfo, requiredWorkDir);
            break;
        case 'ci':
            performNpmConfigCommand(cliPath, artifactoryService, tl.getInput('sourceRepo', true), requiredWorkDir);
            performNpmCommand(npmCiCommand, true, cliPath, collectBuildInfo, requiredWorkDir);
            break;
        case 'pack and publish':
            performNpmConfigCommand(cliPath, artifactoryService, tl.getInput('targetRepo', true), requiredWorkDir);
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
        utils.executeCliCommand(cliCommand, requiredWorkDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

function performNpmConfigCommand(cliPath, artifactoryService, repo, requiredWorkDir) {
    utils.configureCliServer(artifactoryService, serverId, cliPath, requiredWorkDir);

    // Build the cli config command.
    let cliCommand = utils.cliJoin(
        cliPath,
        npmConfigCommand,
        '--server-id-resolve=' + utils.quote(serverId),
        '--repo-resolve=' + utils.quote(repo),
        '--server-id-deploy=' + utils.quote(serverId),
        '--repo-deploy=' + utils.quote(repo)
    );

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

function getCollectBuildInfoFlags(addThreads) {
    // Construct the build-info collection flags.
    let buildName = tl.getInput('buildName', true);
    let buildNumber = gtl.etInput('buildNumber', true);
    let commandAddition = utils.cliJoin('--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));

    // Check if need to add threads.
    if (addThreads) {
        let buildInfoThreads = tl.getInput('threads');
        commandAddition = utils.cliJoin(commandAddition, '--threads=' + utils.quote(buildInfoThreads));
    }

    return commandAddition;
}

utils.executeCliTask(RunTaskCbk);
