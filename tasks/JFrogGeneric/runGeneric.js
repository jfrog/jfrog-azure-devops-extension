const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const path = require('path');

const cliUploadCommand = 'rt u';
const cliDownloadCommand = 'rt dl';
const cliSetPropertiesCommand = 'rt sp';
const cliDeletePropertiesCommand = 'rt delp';
const cliMoveCommand = 'rt mv';
const cliCopyCommand = 'rt cp';
const cliDeleteArtifactsCommand = 'rt del';

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    let artifactoryService = tl.getInput('connection', false);

    // Decide if the task runs as generic or artifact-source download.
    let definition = tl.getInput('definition', false);
    if (definition) {
        console.log('Artifact source download...');
        performArtifactSourceDownload(cliPath, workDir, artifactoryService);
        return;
    }

    let genericCommand = tl.getInput('command', true);

    switch (genericCommand) {
        case 'Upload':
            handleGenericUpload(cliPath, workDir, artifactoryService);
            break;
        case 'Download':
            handleGenericDownload(cliPath, workDir, artifactoryService);
            break;
        case 'SetProperties':
            handleGenericSetProperties(cliPath, workDir, artifactoryService);
            break;
        case 'DeleteProperties':
            handleGenericDeleteProperties(cliPath, workDir, artifactoryService);
            break;
        case 'Move':
            handleGenericMove(cliPath, workDir, artifactoryService);
            break;
        case 'Copy':
            handleGenericCopy(cliPath, workDir, artifactoryService);
            break;
        case 'DeleteArtifacts':
            handleGenericDeleteArtifacts(cliPath, workDir, artifactoryService);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, 'Command not supported: ' + genericCommand);
    }
}

function handleGenericUpload(cliPath, workDir, artifactoryService) {
    let cliCommand = utils.cliJoin(cliPath, cliUploadCommand);
    cliCommand = utils.appendBuildFlagsToCliCommand(cliCommand)
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');

    cliCommand = utils.addBoolParam(cliCommand, 'preserveSymlinks', 'symlinks');
    cliCommand = addDebParam(cliCommand);

    let syncDeletes = tl.getBoolInput('syncDeletesRemote');
    if (syncDeletes) {
        cliCommand = utils.addStringParam(cliCommand, 'syncDeletesPathRemote', 'sync-deletes');
    }
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function handleGenericDownload(cliPath, workDir, artifactoryService) {
    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand);
    cliCommand = utils.appendBuildFlagsToCliCommand(cliCommand)
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');

    cliCommand = utils.addIntParam(cliCommand, 'splitCount', 'split-count');
    cliCommand = utils.addIntParam(cliCommand, 'minSplit', 'min-split');

    cliCommand = utils.addBoolParam(cliCommand, 'validateSymlinks', 'validate-symlinks');

    let syncDeletes = tl.getBoolInput('syncDeletesLocal');
    if (syncDeletes) {
        cliCommand = utils.addStringParam(cliCommand, 'syncDeletesPathLocal', 'sync-deletes');
    }
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function handleGenericSetProperties(cliPath, workDir, artifactoryService) {
    let props = tl.getInput('setProps', false);
    let cliCommand = utils.cliJoin(cliPath, cliSetPropertiesCommand, utils.quote(props));
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function handleGenericDeleteProperties(cliPath, workDir, artifactoryService) {
    let props = tl.getInput('deleteProps', false);
    let cliCommand = utils.cliJoin(cliPath, cliDeletePropertiesCommand, utils.quote(props));
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function handleGenericMove(cliPath, workDir, artifactoryService) {
    let cliCommand = utils.cliJoin(cliPath, cliMoveCommand);
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function handleGenericCopy(cliPath, workDir, artifactoryService) {
    let cliCommand = utils.cliJoin(cliPath, cliCopyCommand);
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function handleGenericDeleteArtifacts(cliPath, workDir, artifactoryService) {
    let cliCommand = utils.cliJoin(cliPath, cliDeleteArtifactsCommand);
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');
    performGenericTask(cliCommand, workDir, artifactoryService)
}

function performGenericTask(cliCommand, workDir, artifactoryService) {
    let specPath = path.join(workDir, 'genericSpec' + Date.now() + '.json');
    cliCommand = utils.addUrlAndCredentialsParams(cliCommand, artifactoryService);
    try {
        cliCommand = utils.addCommonGenericParams(cliCommand, specPath);
        // Execute the cli command.
        utils.executeCliCommand(cliCommand, workDir, null);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        // Remove created fileSpec from file system.
        try {
            tl.rmRF(specPath);
        } catch (fileException) {
            tl.setResult(tl.TaskResult.Failed, 'Failed cleaning temporary FileSpec file: ' + specPath);
        }
    }

    // Ignored if previously failed.
    tl.setResult(tl.TaskResult.Succeeded, 'Download Succeeded.');
}

function addDebParam(cliCommand) {
    let setDebianProps = tl.getBoolInput('setDebianProps');
    if (setDebianProps) {
        let distribution = tl.getInput('debDistribution', true).replace(/\//g, '\\/');
        let component = tl.getInput('debComponent', true).replace(/\//g, '\\/');
        let architecture = tl.getInput('debArchitecture', true).replace(/\//g, '\\/');
        let debValue = [distribution, component, architecture];
        cliCommand = utils.cliJoin(cliCommand, '--deb=' + utils.quote(debValue.join('/')));
    }
    return cliCommand;
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

    // Add project flag if provided
    cliCommand = utils.addProjectOption(cliCommand);
    cliCommand = utils.addUrlAndCredentialsParams(cliCommand, artifactoryService);

    try {
        utils.executeCliCommand(cliCommand, workDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Download Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

utils.executeCliTask(RunTaskCbk);
