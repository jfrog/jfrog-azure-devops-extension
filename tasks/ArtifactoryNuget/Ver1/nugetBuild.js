const tl = require('azure-pipelines-task-lib/task');
const toolLib = require('azure-pipelines-tool-lib/tool');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');
const NUGET_TOOL_NAME = 'NuGet';
const NUGET_EXE_FILENAME = 'nuget.exe';
const async = require('asyncawait/async');
const await = require('asyncawait/await');
const solutionPathUtil = require('./util/solutionPathUtil');
const NUGET_VERSION = '4.7.1';
const path = require('path');
const cliNuGetCommand = 'rt nuget';
const cliUploadCommand = 'rt u';
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
let downloadAndRunNuget = async (cliPath, nugetCommand) => {
    let downloadPath = await toolLib.downloadTool('https://dist.nuget.org/win-x86-commandline/v' + NUGET_VERSION + '/nuget.exe');
    toolLib.cacheFile(downloadPath, NUGET_EXE_FILENAME, NUGET_TOOL_NAME, NUGET_VERSION);
    addToPathAndExec(cliPath, nugetCommand, NUGET_VERSION);
};

// This triggered after downloading the CLI.
// First we will check for NuGet in the Env Path. If exists, this one will be used.
// Secondly, we will check the local cache and use the latest version in the caceh.
// If not exists in the cache, we will download the NuGet executable from NuGet
let RunTaskCbk = async(function(cliPath) {
    if (process.platform !== 'win32') {
        tl.setResult(tl.TaskResult.Failed, 'This task currently supports Windows agents only.');
        return;
    }
    let nugetCommand = tl.getInput('command');
    let nugetExec = tl.which('nuget', false);
    if (!nugetExec && nugetCommand.localeCompare('restore') === 0) {
        let localVersions = toolLib.findLocalToolVersions(NUGET_TOOL_NAME);
        if (localVersions === undefined || localVersions.length === 0) {
            await(downloadAndRunNuget(cliPath, nugetCommand));
        } else {
            console.log('The following version/s ' + localVersions + ' were found on the build agent');
            addToPathAndExec(cliPath, nugetCommand, localVersions[localVersions.length - 1]);
        }
    } else {
        exec(cliPath, nugetCommand);
    }
});

utils.executeCliTask(RunTaskCbk);

// Executing JFrog CLI with NuGet
function exec(cliPath, nugetCommand) {
    utils.deprecatedTaskMessage('ArtifactoryNuGet@1', 'ArtifactoryNuGet@2');
    let buildDir = tl.getVariable('System.DefaultWorkingDirectory');
    // Get configured parameters
    let nugetCommandCli;
    if (nugetCommand.localeCompare('restore') === 0) {
        // Perform restore command.
        let solutionPattern = tl.getInput('solutionPath');
        let filesList = solutionPathUtil.resolveFilterSpec(solutionPattern, tl.getVariable('System.DefaultWorkingDirectory') || process.cwd());
        filesList.forEach(solutionFile => {
            let solutionPath;
            if (!fs.lstatSync(solutionFile).isDirectory()) {
                solutionPath = path.dirname(solutionFile);
            } else {
                solutionPath = solutionFile;
            }
            let targetResolveRepo = tl.getInput('targetResolveRepo');
            let nugetArguments = addNugetArgsToCommands();
            nugetCommandCli = utils.cliJoin(
                cliPath,
                cliNuGetCommand,
                nugetCommand,
                targetResolveRepo,
                '--solution-root=' + utils.quote(solutionPath),
                '--nuget-args=' + utils.quote(nugetArguments)
            );
            runNuGet(nugetCommandCli, cliPath, buildDir);
        });
    } else {
        // Perform push command.
        let targetDeployRepo = tl.getInput('targetDeployRepo');
        let pathToNupkg = utils.fixWindowsPaths(tl.getPathInput('pathToNupkg', true, false));
        nugetCommandCli = utils.cliJoin(cliPath, cliUploadCommand, pathToNupkg, targetDeployRepo);
        nugetCommandCli = utils.addStringParam(nugetCommandCli, 'props', 'props');
        runNuGet(nugetCommandCli, cliPath, buildDir);
    }
}

function runNuGet(nugetCommandCli, cliPath, buildDir) {
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');

    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        nugetCommandCli = utils.cliJoin(nugetCommandCli, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
    }

    nugetCommandCli = addArtifactoryServer(nugetCommandCli);
    try {
        utils.executeCliCommand(nugetCommandCli, buildDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

// Adds the Artifactory information to the command
function addArtifactoryServer(nugetCommandCli) {
    let artifactoryService = tl.getInput('artifactoryService', false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);

    nugetCommandCli = utils.cliJoin(nugetCommandCli, '--url=' + utils.quote(artifactoryUrl));
    nugetCommandCli = utils.addArtifactoryCredentials(nugetCommandCli, artifactoryService);
    return nugetCommandCli;
}

// Creates the Nuget arguments
function addNugetArgsToCommands() {
    let nugetArguments = tl.getInput('arguments');
    if (!nugetArguments) {
        nugetArguments = '';
    }
    let noNuGetCache = tl.getInput('noNuGetCache');
    if (noNuGetCache) {
        nugetArguments = utils.cliJoin(nugetArguments, '-NoCache');
    }

    let packagesDirectory = utils.fixWindowsPaths(tl.getInput('packagesDirectory'));
    if (packagesDirectory) {
        nugetArguments = utils.cliJoin(nugetArguments, '-PackagesDirectory', packagesDirectory);
    }

    let verbosityRestore = tl.getInput('verbosityRestore');
    nugetArguments = utils.cliJoin(nugetArguments, '-Verbosity', verbosityRestore);

    return nugetArguments;
}
