
const tl = require('vsts-task-lib/task');
const utils = require('jfrog-utils');
const path = require('path');

const cliBuildPublishCommand = "rt bp";
const cliCollectEnvVarsCommand = "rt bce";

function RunTaskCbk(cliPath) {
    let buildDir = tl.getVariable('Agent.BuildDirectory');
    let buildDefinition = tl.getVariable('BUILD.DEFINITIONNAME');
    let buildNumber = tl.getVariable('BUILD_BUILDNUMBER');

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let includeEnvVars = tl.getBoolInput("includeEnvVars");

    // Collect env vars
    if (includeEnvVars) {
        console.log("Collecting environment variables...");
        let cliEnvVarsCommand = utils.cliJoin(cliPath, cliCollectEnvVarsCommand, utils.quote(buildDefinition), utils.quote(buildNumber));
        utils.executeCliCommand(cliEnvVarsCommand, buildDir);
    }

    let cliCommand = utils.cliJoin(cliPath, cliBuildPublishCommand, utils.quote(buildDefinition), utils.quote(buildNumber), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    utils.executeCliCommand(cliCommand, buildDir);
    attachBuildInfoUrl(buildDefinition, buildNumber);

    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

function attachBuildInfoUrl(buildName, buildNumber) {
    let buildDir = tl.getVariable('Agent.BuildDirectory');
    let artifactory = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactory, false);
    let artifactoryUrlFile = path.join(buildDir, "artifactoryUrlFile");
    let buildDetails = {
        artifactoryUrl: artifactoryUrl,
        buildName: buildName,
        buildNumber: buildNumber
    };

    tl.writeFile(artifactoryUrlFile, JSON.stringify(buildDetails));

    //Executes command to attach the file to build
    console.log("##vso[task.addattachment type=artifactoryType;name=buildDetails;]" + artifactoryUrlFile);
}

utils.executeCliTask(RunTaskCbk);
