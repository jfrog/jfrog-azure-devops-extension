const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils/utils.js');
const path = require('path');
const fs = require('fs');

const cliDownloadCommand = 'rt dl';

function RunTaskCbk(cliPath) {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    let specPath = path.join(workDir, 'downloadSpec' + Date.now() + '.json');

    // Get input parameters.
    let artifactoryService = tl.getInput('artifactoryService', false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let specSource = tl.getInput('specSource', false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');

    try {
        let fileSpec;
        if (specSource === 'file') {
            let specInputPath = tl.getPathInput('file', true, true);
            console.log('Using file spec located at ' + specInputPath);
            fileSpec = fs.readFileSync(specInputPath, 'utf8');
        } else {
            fileSpec = tl.getInput('fileSpec', true);
        }
        fileSpec = utils.fixWindowsPaths(fileSpec);
        console.log('Using file spec:');
        console.log(fileSpec);
        // Write provided fileSpec to file.
        tl.writeFile(specPath, fileSpec);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, '--url=' + utils.quote(artifactoryUrl), '--spec=' + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, 'failNoOp', 'fail-no-op');

    // Add build info collection.
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, '--build-name=' + utils.quote(buildDefinition), '--build-number=' + utils.quote(buildNumber));
    }

    try {
        utils.executeCliCommand(cliCommand, workDir);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
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
