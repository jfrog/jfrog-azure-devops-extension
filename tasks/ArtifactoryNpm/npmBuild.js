const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;
const npmUtils = require('./npmUtils');

const npmInstallCommand = "rt npmi";
const npmPublishCommand = "rt npmp";
let cliNpmCommand;
let npmRepository;

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        throw new Error("Failed getting default working directory.");
    }

    // Determine working directory for the cli and npm command
    let inputWorkingFolder = tl.getInput("workingFolder", false);
    let requiredWorkDir = npmUtils.determineCliWorkDir(defaultWorkDir, inputWorkingFolder);
    configureCommand();

    // Build the cli command
    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliNpmCommand)
        .addArguments(npmRepository)
        .addArtifactoryServerWithCredentials("artifactoryService")
        .addStringOptionFromParam("arguments", "npm-args")
        .addBuildFlagsIfRequired();

    utils.executeCliCommand(command.build(), requiredWorkDir);
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

function configureCommand() {
    let inputCommand = tl.getInput("command", true);
    switch (inputCommand) {
        case "install":
            cliNpmCommand = npmInstallCommand;
            npmRepository = tl.getInput("sourceRepo", true);
            break;
        case "pack and publish":
            cliNpmCommand = npmPublishCommand;
            npmRepository = tl.getInput("targetRepo", true);
            break;
        default:
            throw new Error("Received invalid npm command: " + inputCommand);
    }
}

utils.executeCliTask(RunTaskCbk);
