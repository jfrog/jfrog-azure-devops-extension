
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const fs = require('fs-extra');

const cliDownloadCommand = "rt dl";

function RunTaskCbk(cliPath) {

    let definition = tl.getInput("definition", false);
    if (definition) {
        console.log("Artifact source download...");
        performArtifactSourceDownload(cliPath);
    } else {
        console.log("Generic download...");
        performGenericDownload(cliPath);
    }
}

function performArtifactSourceDownload(cliPath) {
    let artifactoryService = tl.getInput("connection", false);
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let specPath = path.join(workDir, "downloadSpec" + Date.now() + ".json");
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    console.log("ARTIFACTORY= " + artifactoryUrl);

    let buildName = tl.getInput("definition", false);
    buildName = buildName.substr(1);
    console.log("BUILD NAME= " + buildName);

    let buildNumber = tl.getInput("version", false);
    console.log("BUILD NUMBER= " + buildNumber);

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, utils.quote("*"), "--build=", buildName + buildNumber, "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    let taskRes = utils.executeCliCommand(cliCommand, workDir);

    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Download Succeeded.");
    }
}

function performGenericDownload(cliPath) {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let specPath = path.join(workDir, "downloadSpec" + Date.now() + ".json");

    // Get input parameters
    let artifactoryService = tl.getInput("connection", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let specSource = tl.getInput("specSource", false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    try {
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
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, "--url=" + utils.quote(artifactoryUrl), "--spec=" + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, "failNoOp", "fail-no-op");

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildDefinition), "--build-number=" + utils.quote(buildNumber));
    }

    let taskRes = utils.executeCliCommand(cliCommand, workDir);

    // Remove created fileSpec from file system
    try {
        tl.rmRF(specPath);
    } catch (ex) {
        taskRes = "Failed cleaning temporary FileSpec file.";
    }

    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
