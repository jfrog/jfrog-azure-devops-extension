
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const fs = require('fs-extra');

const cliUploadCommand = "rt u";

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let specPath = path.join(workDir, "uploadSpec" + Date.now() + ".json");

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
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

    let cliCommand = utils.cliJoin(cliPath, cliUploadCommand, "--url=" + utils.quote(artifactoryUrl), "--spec=" + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, "failNoOp", "fail-no-op");

    // Add build info collection
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildName), "--build-number=" + utils.quote(buildNumber));
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
