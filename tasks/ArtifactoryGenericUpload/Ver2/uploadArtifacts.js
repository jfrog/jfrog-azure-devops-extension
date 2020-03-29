const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');

const cliUploadCommand = 'rt u';

function addDebParam(cliCommand) {
    let setDebianProps = tl.getBoolInput('setDebianProps');
    if (setDebianProps) {
        let distribution = tl.getInput('debDistribution', true).replace(/\//g, "\\/");
        let component = tl.getInput('debComponent', true).replace(/\//g, "\\/");
        ;
        let architecture = tl.getInput('debArchitecture', true).replace(/\//g, "\\/");
        ;
        let debValue = [distribution, component, architecture];
        cliCommand = utils.cliJoin(cliCommand, '--deb=' + utils.quote(debValue.join('/')))
    }
    return cliCommand
}

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    let specPath = path.join(workDir, 'uploadSpec' + Date.now() + '.json');
    let artifactoryService = tl.getInput('artifactoryService', false);
    let cliCommand = utils.cliJoin(cliPath, cliUploadCommand);
    cliCommand = utils.addUrlAndCredentialsParams(cliCommand, artifactoryService);
    try {
        cliCommand = utils.addCommonGenericParams(cliCommand, specPath);
        // Add unique download flags
        cliCommand = utils.addBoolParam(cliCommand, 'symlinks', 'symlinks');
        cliCommand = addDebParam(cliCommand)
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
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

utils.executeCliTask(RunTaskCbk);
