const tl = require('vsts-task-lib/task');
const toolLib = require('vsts-task-tool-lib/tool');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;
const NUGET_TOOL_NAME = 'NuGet';
const NUGET_EXE_FILENAME = 'nuget.exe';
const async = require('asyncawait/async');
const await = require('asyncawait/await');
const solutionPathUtil = require('./util/solutionPathUtil');
const NUGET_VERSION = "4.7.1";
const path = require('path');

const cliNuGetCommand = "rt nuget";
const cliUploadCommand = "rt u";

// This triggered after downloading the CLI.
// First we will check for NuGet in the Env Path. If exists, this one will be used.
// Secondly, we will check the local cache and use the latest version in the cache.
// If not exists in the cache, we will download the NuGet executable from NuGet
let RunTaskCbk = async(function (cliPath) {
    let nugetCommand = tl.getInput("command");
    let nugetExec = tl.which("nuget", false);
    if (nugetExec || nugetCommand.localeCompare("restore") !== 0) {
        exec(cliPath, nugetCommand);
        return;
    }

    let localVersions = toolLib.findLocalToolVersions(NUGET_TOOL_NAME);
    if (localVersions === undefined || localVersions.length === 0) {
        await(downloadAndRunNuget(cliPath, nugetCommand));
        return;
    }
    console.log("The following version/s " + localVersions + " were found on the build agent");
    addToPathAndExec(cliPath, nugetCommand, localVersions[localVersions.length - 1]);
});

/**
 * Adds the nuget executable to the Path and execute the CLI.
 * @param cliPath - The path to JFrog CLI
 * @param nugetCommand - The NuGet command that configured for the task
 * @param nugetVersion - The NuGet version to add to Path.
 */
function addToPathAndExec(cliPath, nugetCommand, nugetVersion) {
    let toolPath = toolLib.findLocalTool(NUGET_TOOL_NAME, nugetVersion);
    toolLib.prependPath(toolPath);
    exec(cliPath, nugetCommand);
}

/**
 * Download NuGet version, adds to the path and executes.
 */
let downloadAndRunNuget = async(function (cliPath, nugetCommand) {
    console.log("NuGet not found in Path. Downloading...");
    let downloadPath = await(toolLib.downloadTool("https://dist.nuget.org/win-x86-commandline/v" + NUGET_VERSION + "/nuget.exe"));
    toolLib.cacheFile(downloadPath, NUGET_EXE_FILENAME, NUGET_TOOL_NAME, NUGET_VERSION);
    addToPathAndExec(cliPath, nugetCommand, NUGET_VERSION);
});

// Executing JFrog CLI with NuGet
function exec(cliPath, nugetCommand) {
    let buildDir = tl.getVariable('System.DefaultWorkingDirectory');
    // Get configured parameters
    let command = new CliCommandBuilder(cliPath);
    if (nugetCommand.localeCompare("restore") === 0) {
        execRestoreCommand(command, nugetCommand, cliPath, buildDir);
        return;
    }
    execPushCommand(command, cliPath, buildDir);
}

function runNuGet(command, cliPath, buildDir) {
    command
        .addBuildFlagsIfRequired()
        .addArtifactoryServerWithCredentials("artifactoryService");
    let taskRes = utils.executeCliCommand(command.build(), buildDir);
    if (taskRes) {
        return;
    }
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.")
}

// Creates the Nuget arguments
function addNugetArgsToCommands() {
    let nugetArguments = tl.getInput("arguments");
    if (!nugetArguments) {
        nugetArguments = "";
    }
    let noNuGetCache = tl.getInput("noNuGetCache");
    if (noNuGetCache) {
        nugetArguments = utils.joinArgs(nugetArguments, "-NoCache");
    }

    let packagesDirectory = utils.fixWindowsPaths(tl.getInput("packagesDirectory"));
    if (packagesDirectory) {
        nugetArguments = utils.joinArgs(nugetArguments, "-PackagesDirectory", packagesDirectory);
    }

    let verbosityRestore = tl.getInput("verbosityRestore");
    nugetArguments = utils.joinArgs(nugetArguments, "-Verbosity", verbosityRestore);

    return nugetArguments;
}

function execRestoreCommand(command, nugetCommand, cliPath, buildDir) {
    let solutionPattern = tl.getInput("solutionPath");
    let filesList = solutionPathUtil.resolveFilterSpec(solutionPattern, tl.getVariable("System.DefaultWorkingDirectory") || process.cwd());
    filesList.forEach(solutionFile => {
        let solutionPath;
        if (!fs.lstatSync(solutionFile).isDirectory()) {
            solutionPath = path.dirname(solutionFile);
        } else {
            solutionPath = solutionFile;
        }
        let targetResolveRepo = tl.getInput("targetResolveRepo");
        let nugetArguments = addNugetArgsToCommands();
        command
            .addCommand(cliNuGetCommand)
            .addArguments(nugetCommand, targetResolveRepo)
            .addOption("solution-root", solutionPath)
            .addOption("nuget-args", nugetArguments);
        runNuGet(command, cliPath, buildDir);
    });
}

function execPushCommand(command, cliPath, buildDir) {
    let targetDeployRepo = tl.getInput("targetDeployRepo");
    let pathToNupkg = utils.fixWindowsPaths(tl.getPathInput("pathToNupkg", true, false));
    command.addCommand(cliUploadCommand).addArguments(pathToNupkg, targetDeployRepo);
    runNuGet(command, cliPath, buildDir);
}

if (utils.isWindows()) {
    tl.setResult(tl.TaskResult.Failed, "This task currently supports Windows agents only.");
    return;
}

utils.executeCliTask(RunTaskCbk);