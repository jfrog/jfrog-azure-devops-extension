
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');

const cliBuildPublishCommand = "rt bp";

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let excludeEnvVars = tl.getInput("excludeEnvVars", false);

    let cliCommand = utils.cliJoin(cliPath, cliBuildPublishCommand, utils.quote(buildName), utils.quote(buildNumber), "--url=" + utils.quote(artifactoryUrl), "--env-exclude=" + utils.quote(excludeEnvVars));
    cliCommand = addBuildUrl(cliCommand);
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    let taskRes = utils.executeCliCommand(cliCommand, workDir);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        attachBuildInfoUrl(buildName, buildNumber, workDir);
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

function attachBuildInfoUrl(buildName, buildNumber, workDir) {
    let artifactory = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactory, false);
    let artifactoryUrlFile = path.join(workDir, "artifactoryUrlFile");
    let buildDetails = {
        artifactoryUrl: artifactoryUrl,
        buildName: buildName,
        buildNumber: buildNumber
    };

    tl.writeFile(artifactoryUrlFile, JSON.stringify(buildDetails));

    //Executes command to attach the file to build
    console.log("##vso[task.addattachment type=artifactoryType;name=buildDetails;]" + artifactoryUrlFile);
}

function addBuildUrl(cliCommand) {
    let collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    let projectName = tl.getVariable('System.TeamProject');
    let buildId = tl.getVariable('Build.BuildId');
    let releaseId = tl.getVariable('Release.ReleaseId');

    let buildUrl = collectionUri + projectName + "/_" + (releaseId ? "release?releaseId=" + releaseId : "build?buildId=" + buildId);
    cliCommand = utils.cliJoin(cliCommand, "--build-url=" + utils.quote(buildUrl));
    return cliCommand;
}

utils.executeCliTask(RunTaskCbk);
