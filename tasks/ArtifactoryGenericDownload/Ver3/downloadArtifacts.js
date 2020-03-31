const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');

const cliDownloadCommand = 'rt dl';

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    let artifactoryService = tl.getInput('connection', false);

    // Decide if the task runs as generic download or artifact-source.
    let definition = tl.getInput('definition', false);
    if (definition) {
        console.log('Artifact source download...');
        performArtifactSourceDownload(cliPath, workDir, artifactoryService);
    } else {
        console.log('Generic download...');
        performGenericDownload(cliPath, workDir, artifactoryService);
    }
}

function performArtifactSourceDownload(cliPath, workDir, artifactoryService) {
    // 'ARTIFACTORY_RELEASE_BUILD_NUMBER' is used to support providing 'LATEST' version by the user.
    // When Azure DevOps Server supports Artifactory's LATEST version natively, this variable could be removed.
    let buildNumber = tl.getVariable('ARTIFACTORY_RELEASE_BUILD_NUMBER') || tl.getInput('version', true);
    let buildName = tl.getInput('definition', true);
    // 'downloadPath' is provided by server when artifact-source is used.
    let downloadPath = tl.getInput('downloadPath', true);
    if (!downloadPath.endsWith('/') && !downloadPath.endsWith('\\')) {
        downloadPath += '/';
    }
    downloadPath = utils.fixWindowsPaths(downloadPath);

    let cliCommand = utils.cliJoin(
        cliPath,
        cliDownloadCommand,
        utils.quote('*'),
        utils.quote(downloadPath),
        '--build=' + utils.quote(buildName + '/' + buildNumber),
        '--flat',
        '--fail-no-op'
    );
    cliCommand = utils.addUrlAndCredentialsParams(cliCommand, artifactoryService);

    try {
        utils.executeCliCommand(cliCommand, workDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Download Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

function performGenericDownload(cliPath, workDir, artifactoryService) {
    let specPath = path.join(workDir, 'downloadSpec' + Date.now() + '.json');
    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand);
    cliCommand = utils.addUrlAndCredentialsParams(cliCommand, artifactoryService);
    try {
        cliCommand = utils.addCommonGenericParams(cliCommand, specPath);
        // Add unique download flags
        cliCommand = utils.addBoolParam(cliCommand, 'validateSymlinks', 'validate-symlinks');
        cliCommand = utils.addIntParam(cliCommand, 'splitCount', 'split-count');
        cliCommand = utils.addIntParam(cliCommand, 'minSplit', 'min-split');
        // Execute the cli command.
        utils.executeCliCommand(cliCommand, workDir);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        // Remove created fileSpec from file system.
        try {
            tl.rmRF(specPath);
        } catch (fileException) {
            tl.setResult(tl.TaskResult.Failed, 'Failed cleaning temporary FileSpec file.');
        }
    }

    // Ignored if previously failed.
    tl.setResult(tl.TaskResult.Succeeded, 'Download Succeeded.');
}

utils.executeCliTask(RunTaskCbk);
