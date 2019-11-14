
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');

const cliDownloadCommand = "rt dl";

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let artifactoryService = tl.getInput("connection", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);

    // Decide if the task runs as generic download or artifact-source.
    let definition = tl.getInput("definition", false);
    if (definition) {
        console.log("Artifact source download...");
        performArtifactSourceDownload(cliPath, workDir, artifactoryService, artifactoryUrl);
    } else {
        console.log("Generic download...");
        performGenericDownload(cliPath, workDir, artifactoryService, artifactoryUrl);
    }
}

function performArtifactSourceDownload(cliPath, workDir, artifactoryService, artifactoryUrl) {
    // 'ARTIFACTORY_RELEASE_BUILD_NUMBER' is used to support providing 'LATEST' version by the user.
    // When Azure DevOps Server supports Artifactory's LATEST version natively, this variable could be removed.
    let buildNumber = tl.getVariable('ARTIFACTORY_RELEASE_BUILD_NUMBER') || tl.getInput("version", true);
    let buildName = tl.getInput("definition", true);
    // 'downloadPath' is provided by server when artifact-source is used.
    let downloadPath = tl.getInput("downloadPath", true);
    if (!downloadPath.endsWith("/") && !downloadPath.endsWith("\\")) {
        downloadPath += "/";
    }
    downloadPath = utils.fixWindowsPaths(downloadPath);

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, utils.quote("*"), utils.quote(downloadPath), "--build=" + utils.quote(buildName + "/" + buildNumber), "--url=" + utils.quote(artifactoryUrl), "--flat=true");
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    try {
        utils.executeCliCommand(cliCommand, workDir);
        tl.setResult(tl.TaskResult.Succeeded, "Download Succeeded.");

    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

function performGenericDownload(cliPath, workDir, artifactoryService, artifactoryUrl) {
    let specPath = path.join(workDir, "downloadSpec" + Date.now() + ".json");

    // Get input parameters.
    let specSource = tl.getInput("specSource", false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    // Create download FileSpec.
    try {
        utils.writeSpecContentToSpecPath(specSource, specPath);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    // Build the cli command.
    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, "--url=" + utils.quote(artifactoryUrl), "--spec=" + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, "failNoOp", "fail-no-op");
    // Add build info collection.
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildName), "--build-number=" + utils.quote(buildNumber));
    }

    // Execute the cli command.
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
    tl.setResult(tl.TaskResult.Succeeded, "Download Succeeded.");
}

utils.executeCliTask(RunTaskCbk);
