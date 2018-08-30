
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const fs = require('fs-extra');

const cliDownloadCommand = "rt dl";

function RunTaskCbk(cliPath) {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let specPath = path.join(workDir, "downloadSpec.json");

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let specSource = tl.getInput("specSource", false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    try {
        let fileSpec;
        if (specSource === "file") {
            specPath = tl.getPathInput("file", true, true);
            fileSpec = fs.readFileSync(specPath, "utf8");
        } else {
            fileSpec = tl.getInput("fileSpec", true);
        }
        fileSpec = utils.fixWindowsPaths(fileSpec);
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

        // Collect env vars
        let taskRes = utils.collectEnvIfRequested(cliPath, buildDefinition, buildNumber, workDir);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
            return;
        }
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
