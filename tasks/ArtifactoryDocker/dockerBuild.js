
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const dockerPushCommand = "rt dp";

function RunTaskCbk(cliPath) {
    // Validate docker exists on agent
    if (!utils.isToolExists("docker")) {
        tl.setResult(tl.TaskResult.Failed, "Agent is missing required tool: docker.");
        return;
    }

    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");
    let targetRepository = tl.getInput("targetRepo", true);
    let imageName = tl.getInput("imageName", true);

    // Build the cli command
    let cliCommand = utils.cliJoin(cliPath, dockerPushCommand, utils.quote(imageName), utils.quote(targetRepository), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildDefinition), "--build-number=" + utils.quote(buildNumber));
    }

    let taskRes = utils.executeCliCommand(cliCommand, defaultWorkDir);

    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
