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
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Get input parameters
    let excludeEnvVars = tl.getInput("excludeEnvVars", false);
    if (!excludeEnvVars) {
        excludeEnvVars = "_"; // This is a workaround - jfrog-cli v1.18 doesn't support empty env-exclude patterns.
    }

    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliBuildPublishCommand)
        .addArguments(buildName, buildNumber)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addOption("env-exclude", excludeEnvVars);

    let taskRes = utils.executeCliCommand(command.build(), workDir);
    if (taskRes) {
        return;
    }

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

utils.executeCliTask(RunTaskCbk);
