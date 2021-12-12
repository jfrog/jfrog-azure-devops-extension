const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/artifactory-tasks-utils/utils.js');
const path = require('path');

const cliUploadCommand = 'rt u';

function RunTaskCbk(cliPath) {
    utils.deprecatedTaskMessage('1', '2');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    let specPath = path.join(workDir, 'uploadSpec' + Date.now() + '.json');

    // Get input parameters
    let artifactoryService = tl.getInput('artifactoryService', false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let specSource = tl.getInput('specSource', false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');

    // Create upload FileSpec.
    try {
        utils.writeSpecContentToSpecPath(specSource, specPath);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    let cliCommand = utils.cliJoin(cliPath, cliUploadCommand, '--url=' + utils.quote(artifactoryUrl), '--spec=' + utils.quote(specPath));
    cliCommand = utils.addServiceConnectionCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, 'failNoOp', 'fail-no-op');

    // Add build info collection
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCommand = utils.cliJoin(cliCommand, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
    }

    try {
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
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

utils.executeCliTask(RunTaskCbk);
