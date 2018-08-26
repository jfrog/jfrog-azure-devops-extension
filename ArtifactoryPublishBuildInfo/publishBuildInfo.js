
const tl = require('vsts-task-lib/task');
const utils = require('jfrog-utils');
const path = require('path');

const cliBuildPublishCommand = "rt bp";
const cliCollectEnvVarsCommand = "rt bce";

function RunTaskCbk(cliPath) {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let includeEnvVars = tl.getBoolInput("includeEnvVars");

    // Collect env vars
    if (includeEnvVars) {
        console.log("Collecting environment variables...");
        let cliEnvVarsCommand = utils.cliJoin(cliPath, cliCollectEnvVarsCommand, utils.quote(buildDefinition), utils.quote(buildNumber));

        let taskRes = utils.executeCliCommand(cliEnvVarsCommand, workDir);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
            return;
        }
    }

    let cliCommand = utils.cliJoin(cliPath, cliBuildPublishCommand, utils.quote(buildDefinition), utils.quote(buildNumber), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    let taskRes = utils.executeCliCommand(cliCommand, workDir);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        attachBuildInfoUrl(buildDefinition, buildNumber, workDir);
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

utils.executeCliTask(RunTaskCbk);
