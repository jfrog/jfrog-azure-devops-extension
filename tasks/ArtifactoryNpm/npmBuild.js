const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');

const npmInstallCommand = 'rt npmi';
const npmPublishCommand = 'rt npmp';
const npmCiCommand = 'rt npmci';

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Get input parameters.
    let artifactoryService = tl.getInput('artifactoryService', false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
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
    let npmRepository;
    switch (inputCommand) {
        case 'install':
            npmRepository = tl.getInput('sourceRepo', true);
            performNpmCommand(npmInstallCommand, npmRepository, true, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir);
            break;
        case 'ci':
            npmRepository = tl.getInput('sourceRepo', true);
            performNpmCommand(npmCiCommand, npmRepository, true, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir);
            break;
        case 'pack and publish':
            npmRepository = tl.getInput('targetRepo', true);
            performNpmCommand(
                npmPublishCommand,
                npmRepository,
                false,
                cliPath,
                artifactoryUrl,
                artifactoryService,
                collectBuildInfo,
                requiredWorkDir
            );
            break;
    }
}

function performNpmCommand(cliNpmCommand, npmRepository, addThreads, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir) {
    // Build the cli command.
    let cliCommand = utils.cliJoin(cliPath, cliNpmCommand, utils.quote(npmRepository), '--url=' + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, 'arguments', 'npm-args');

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
