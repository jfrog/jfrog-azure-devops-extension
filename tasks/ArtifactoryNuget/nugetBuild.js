const tl = require('azure-pipelines-task-lib/task');
const toolLib = require('azure-pipelines-tool-lib/tool');
const fs = require('fs');
const utils = require('artifactory-tasks-utils/utils.js');
const NUGET_TOOL_NAME = 'NuGet';
const NUGET_EXE_FILENAME = 'nuget.exe';
const NUGET_VERSION = '5.4.0';
const path = require('path');
const solutionPathUtil = require('artifactory-tasks-utils/solutionPathUtil');
const cliNuGetCommand = 'rt nuget';
const cliUploadCommand = 'rt u';
const nugetConfigCommand = 'rt nugetc';

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
function downloadAndRunNuget(cliPath, nugetCommand) {
    console.log('NuGet not found in Path. Downloading...');
    toolLib.downloadTool('https://dist.nuget.org/win-x86-commandline/v' + NUGET_VERSION + '/nuget.exe').then(downloadPath => {
        fs.chmodSync(downloadPath, 0o555);
        toolLib.cacheFile(downloadPath, NUGET_EXE_FILENAME, NUGET_TOOL_NAME, NUGET_VERSION);
        addToPathAndExec(cliPath, nugetCommand, NUGET_VERSION);
    });
}

// This triggered after downloading the CLI.
// First we will check for NuGet in the Env Path. If exists, this one will be used.
// Secondly, we will check the local cache and use the latest version in the caceh.
// If not exists in the cache, we will download the NuGet executable from NuGet
function RunTaskCbk(cliPath) {
    let nugetCommand = tl.getInput('command', true);
    let nugetExec = tl.which('nuget', false);
    if (!nugetExec && nugetCommand.localeCompare('restore') === 0) {
        let localVersions = toolLib.findLocalToolVersions(NUGET_TOOL_NAME);
        if (localVersions === undefined || localVersions.length === 0) {
            downloadAndRunNuget(cliPath, nugetCommand);
        } else {
            console.log('The following version/s ' + localVersions + ' were found on the build agent');
            addToPathAndExec(cliPath, nugetCommand, localVersions[localVersions.length - 1]);
        }
    } else {
        exec(cliPath, nugetCommand);
    }
}

utils.executeCliTask(RunTaskCbk);

// Executing JFrog CLI with NuGet
function exec(cliPath, nugetCommand) {
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
            let nugetArguments = addNugetArgsToCommands();
            nugetCommandCli = utils.cliJoin(cliPath, cliNuGetCommand, nugetCommand, nugetArguments);
            let resolverServerId = performNugetConfig(cliPath, solutionPath, 'targetResolveRepo');
            runNuGet(nugetCommandCli, solutionPath, cliPath, [resolverServerId]);
        });
    } else {
        // Perform push command.
        let targetPath = tl.getInput('targetDeployRepo', true);
        let relativeTargetPath = tl.getInput('targetDeployPath');
        if (relativeTargetPath) {
            targetPath = utils.addTrailingSlashIfNeeded(targetPath) + utils.addTrailingSlashIfNeeded(relativeTargetPath);
        }
        let pathToNupkg = utils.fixWindowsPaths(tl.getPathInput('pathToNupkg', true, false));
        nugetCommandCli = utils.cliJoin(cliPath, cliUploadCommand, utils.quote(pathToNupkg), utils.quote(targetPath));
        nugetCommandCli = addArtifactoryServer(nugetCommandCli);
        runNuGet(nugetCommandCli, buildDir, cliPath);
    }
}

function runNuGet(nugetCommandCli, buildDir, cliPath, configuredServerIdsArray) {
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');

    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        nugetCommandCli = utils.cliJoin(nugetCommandCli, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
        nugetCommandCli = utils.addProjectOption(nugetCommandCli);
    }
    try {
        utils.executeCliCommand(nugetCommandCli, buildDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        if (configuredServerIdsArray) {
            utils.deleteCliServers(cliPath, buildDir, configuredServerIdsArray);
        }
    }
}

// Adds the Artifactory information to the command
function addArtifactoryServer(nugetCommandCli) {
    let artifactoryService = tl.getInput('artifactoryService', true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, true);

    nugetCommandCli = utils.cliJoin(nugetCommandCli, '--url=' + utils.quote(artifactoryUrl));
    nugetCommandCli = utils.addServiceConnectionCredentials(nugetCommandCli, artifactoryService);
    return nugetCommandCli;
}

// Create nuget config
function performNugetConfig(cliPath, requiredWorkDir, repoResolve) {
    const artService = tl.getInput('artifactoryService');
    let cliCommand = utils.cliJoin(cliPath, nugetConfigCommand);

    // Create serverId
    let serverIdResolve = utils.assembleBuildToolServerId('nuget', tl.getInput('command', true) + 'Resolve');
    utils.configureCliServer(artService, serverIdResolve, cliPath, requiredWorkDir);
    // Add serverId and repo to config command
    cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(serverIdResolve));
    cliCommand = utils.addStringParam(cliCommand, repoResolve, 'repo-resolve', true);

    // Using Nuget protocol v2 by default. // todo maybe change
    let nugetProtocolVersion = tl.getInput('nugetProtocolVersion', false);
    if (!nugetProtocolVersion || nugetProtocolVersion === 'v2') {
        cliCommand = utils.cliJoin(cliCommand, '--nuget-v2');
    }

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir, null);
        return serverIdResolve;
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

// Creates the Nuget arguments
function addNugetArgsToCommands() {
    let nugetArguments = tl.getInput('arguments');
    if (!nugetArguments) {
        nugetArguments = '';
    }
    let noNuGetCache = tl.getBoolInput('noNuGetCache');
    if (noNuGetCache) {
        nugetArguments = utils.cliJoin(nugetArguments, '-NoCache');
    }
    let packagesDirectory = utils.fixWindowsPaths(tl.getInput('packagesDirectory'));
    if (packagesDirectory) {
        nugetArguments = utils.cliJoin(nugetArguments, '-PackagesDirectory', utils.quote(packagesDirectory));
    }
    let verbosityRestore = tl.getInput('verbosityRestore');
    nugetArguments = utils.cliJoin(nugetArguments, '-Verbosity', utils.quote(verbosityRestore));
    return nugetArguments;
}
