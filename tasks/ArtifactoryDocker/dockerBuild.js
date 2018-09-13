
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;

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

    // Get input parameters
    let targetRepository = tl.getInput("targetRepo", true);
    let imageTag = tl.getInput("imageTag", true);
    let command = new CliCommandBuilder(cliPath)
        .addCommand(dockerPushCommand)
        .addArguments(imageTag, targetRepository)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addBuildFlagsIfRequired();

    let taskRes = utils.executeCliCommand(command.build(), defaultWorkDir);
    if (taskRes) {
        return;
    }
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

utils.executeCliTask(RunTaskCbk);
