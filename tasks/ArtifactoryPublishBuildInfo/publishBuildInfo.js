const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const CliCommandBuilder = utils.CliCommandBuilder;

const cliBuildPublishCommand = "rt bp";

function RunTaskCbk(cliPath) {
    let buildName = utils.getBuildName();
    let buildNumber = utils.getBuildNumber();
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        throw new Error("Failed getting default working directory.");
    }

    // Get input parameters
    let excludeEnvVars = tl.getInput("excludeEnvVars", false);

    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliBuildPublishCommand)
        .addArguments(buildName, buildNumber)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addOption("env-exclude", excludeEnvVars)
        .addOption("build-url", getBuildUrl());

    utils.executeCliCommand(command.build(), workDir);
    attachBuildInfoUrl(buildName, buildNumber, workDir);
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
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

function getBuildUrl() {
    let collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    let projectName = tl.getVariable('System.TeamProject');
    let buildId = tl.getVariable('Build.BuildId');
    let releaseId = tl.getVariable('Release.ReleaseId');

    return collectionUri + projectName + "/_" + (releaseId ? "release?releaseId=" + releaseId : "build?buildId=" + buildId);
}

utils.executeCliTask(RunTaskCbk);
