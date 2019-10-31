
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');

const setPropsCommand = "rt sp";
const deletePropsCommand = "rt delp";

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let specPath = path.join(workDir, "propsSpec" + Date.now() + ".json");

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let command = tl.getInput("command", false);
    let specSource = tl.getInput("specSource", false);

    // Get file properties.
    let fileProps;
    let propsCommand;
    if (command === "set") {
        propsCommand = setPropsCommand;
        fileProps = tl.getInput("setProps", false);
    } else {
        propsCommand = deletePropsCommand;
        fileProps = tl.getInput("deleteProps", false);
    }

    // Create file-spec.
    try {
        utils.writeSpecContentToSpecPath(specSource, specPath);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    let cliCommand = utils.cliJoin(cliPath, propsCommand, utils.quote(fileProps), "--url=" + utils.quote(artifactoryUrl), "--spec=" + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    try {
        utils.executeCliCommand(cliCommand, workDir);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        // Remove created fileSpec from file system.
        try {
            tl.rmRF(specPath);
        } catch (fileException) {
            tl.setResult(tl.TaskResult.Failed, "Failed cleaning temporary FileSpec file.");
        }
    }

    // Ignored if previously failed.
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

utils.executeCliTask(RunTaskCbk);
