
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;

const dockerPushCommand = "rt dp";

function RunTaskCbk(cliPath) {
    // Validate docker exists on agent
    if (!utils.isToolExists("docker")) {
        throw new Error("Agent is missing required tool: docker.");
    }

    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        throw new Error("Failed getting default working directory.");
    }

    // Get input parameters
    let targetRepository = tl.getInput("targetRepo", true);
    let imageTag = tl.getInput("imageName", true);
    let command = new CliCommandBuilder(cliPath)
        .addCommand(dockerPushCommand)
        .addArguments(imageTag, targetRepository)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addBuildFlagsIfRequired();

    utils.executeCliCommand(command.build(), defaultWorkDir);
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

utils.executeCliTask(RunTaskCbk);
