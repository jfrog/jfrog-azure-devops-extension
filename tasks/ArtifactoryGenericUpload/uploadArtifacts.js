
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;
const path = require('path');
const fs = require('fs-extra');

const cliCommand = "rt u";

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let specPath = path.join(workDir, "uploadSpec" + Date.now() + ".json");

    // Get input parameters
    let specSource = tl.getInput("specSource", false);

    try {
        let fileSpec;
        if (specSource === "file") {
            let specInputPath = tl.getPathInput("file", true, true);
            console.log("Using file spec located at " + specInputPath);
            fileSpec = fs.readFileSync(specInputPath, "utf8");
        } else {
            fileSpec = tl.getInput("fileSpec", true);
        }
        fileSpec = utils.fixWindowsPaths(fileSpec);
        utils.validateSpecWithoutRegex(fileSpec);
        console.log("Using file spec:");
        console.log(fileSpec);
        // Write provided fileSpec to file
        tl.writeFile(specPath, fileSpec);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
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
