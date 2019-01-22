
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const fs = require('fs-extra');

const cliDownloadCommand = "rt dl";

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        setTaskResult("Failed getting default working directory.");
        return;
    }
    let artifactoryService = tl.getInput("connection", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);

    // Decide if the task runs as generic download or artifact-source
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
    let buildNumber = tl.getInput("version", true);
    let buildName = tl.getInput("definition", true);
    // 'downloadPath' is provided by server when artifact-source is used.
    let downloadPath = tl.getInput("downloadPath", true);
    if (!downloadPath.endsWith("/") && !downloadPath.endsWith("\\")) {
        downloadPath += "/";
    }
    downloadPath = utils.fixWindowsPaths(downloadPath);

    // Remove '/' as Artifactory's api returns build name and number with this prefix.
    buildName = buildName.replace(/^\//, '');
    buildNumber = buildNumber.replace(/^\//, '');

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, utils.quote("*"), utils.quote(downloadPath), "--build=" + utils.quote(buildName + "/" + buildNumber), "--url=" + utils.quote(artifactoryUrl), "--flat=true");
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    let taskRes = utils.executeCliCommand(cliCommand, workDir);

    setTaskResult(taskRes);
}

function performGenericDownload(cliPath, workDir, artifactoryService, artifactoryUrl) {
    let specPath = path.join(workDir, "downloadSpec" + Date.now() + ".json");

    // Get input parameters
    let specSource = tl.getInput("specSource", false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    // Create download FileSpec
    try {
        writeSpecContentToSpecPath(specSource, specPath);
    } catch (ex) {
        setTaskResult(ex);
        return;
    }

    // Build the cli command
    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, "--url=" + utils.quote(artifactoryUrl), "--spec=" + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, "failNoOp", "fail-no-op");
    // Add build info collection
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName',true);
        let buildNumber = tl.getInput('buildNumber',true);
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildName), "--build-number=" + utils.quote(buildNumber));
    }

    // Execute the cli command
    let taskRes = utils.executeCliCommand(cliCommand, workDir);

    // Remove created fileSpec from file system
    try {
        tl.rmRF(specPath);
    } catch (ex) {
        taskRes = "Failed cleaning temporary FileSpec file.";
    }

    setTaskResult(taskRes);
}

function writeSpecContentToSpecPath(specSource, specPath) {
    let fileSpec;
    if (specSource === "file") {
        let specInputPath = tl.getPathInput("file", true, true);
        console.log("Using file spec located at " + specInputPath);
        fileSpec = fs.readFileSync(specInputPath, "utf8");
    } else {
        fileSpec = tl.getInput("fileSpec", true);
    }
    fileSpec = utils.fixWindowsPaths(fileSpec);
    utils.validateSpecWithoutRegex(fileSpec);
    console.log("Using file spec:");
    console.log(fileSpec);
    // Write provided fileSpec to file
    tl.writeFile(specPath, fileSpec);
}

function setTaskResult(taskRes) {
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Download Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
