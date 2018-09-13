
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;

const cliPromoteCommand = "rt bpr";

function RunTaskCbk(cliPath) {
    let buildName = utils.getBuildName();
    let buildNumber = utils.getBuildNumber();
    let targetRepo = tl.getInput("targetRepo", true);

    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliPromoteCommand)
        .addArguments(buildName, buildNumber, targetRepo)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addStringOptionFromParam("status")
        .addStringOptionFromParam("comment")
        .addStringOptionFromParam("sourceRepo", "source-repo")
        .addBoolOptionFromParam("copy")
        .addBoolOptionFromParam("includeDependencies", "include-dependencies")
        .addBoolOptionFromParam("dryRun", "dry-run");

    let taskRes = utils.executeCliCommand(command.build(), process.cwd());
    if (taskRes) {
        return;
    }
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

utils.executeCliTask(RunTaskCbk);
