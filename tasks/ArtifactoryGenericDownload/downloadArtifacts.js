
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;
const path = require('path');

const cliCommand = "rt dl";

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    let specPath = path.join(workDir, "downloadSpec" + Date.now() + ".json");
    let error = utils.prepareFileSpec(specPath);
    if (error) {
        return;
    }

    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliCommand)
        .addOption("spec", specPath)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addBoolOptionFromParam("failNoOp", "fail-no-op")
        .addBuildFlagsIfRequired();

    let taskRes = utils.executeCliCommand(command.build(), workDir);
    // Remove created fileSpec from file system
    try {
        tl.rmRF(specPath);
    } catch (ex) {
        taskRes = "Failed cleaning temporary FileSpec file.";
        tl.setResult(tl.TaskResult.Failed, taskRes);
    }

    if (taskRes) {
        return;
    }
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

utils.executeCliTask(RunTaskCbk);
