
const tl = require('vsts-task-lib/task');
const utils = require('jfrog-utils');
const path = require('path');

const cliDownloadCommand = "rt dl";

function RunTaskCbk(cliPath) {
    let buildDir = tl.getVariable('Agent.BuildDirectory');
    let buildDefinition = tl.getVariable('BUILD.DEFINITIONNAME');
    let buildNumber = tl.getVariable('BUILD_BUILDNUMBER');
    let specPath = path.join(buildDir, "downloadSpec.json");

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let fileSpec = tl.getInput("fileSpec", false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    console.log("Using file spec:");
    console.log(fileSpec);
    // Write provided fileSpec to file
    try {
        tl.writeFile(specPath, fileSpec);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return
    }

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, "--url=" + utils.quote(artifactoryUrl), "--spec=" + utils.quote(specPath));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, "failNoOp", "fail-no-op");

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildDefinition), "--build-number=" + utils.quote(buildNumber));
    }

    let taskRes = utils.executeCliCommand(cliCommand, buildDir);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
