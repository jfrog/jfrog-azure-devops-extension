const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const solutionPathUtil = require('artifactory-tasks-utils/solutionPathUtil');
const cliDotnetCoreRestoreCommand = 'rt dotnet restore';
const cliUploadCommand = 'rt u';
const dotnetConfigCommand = 'rt dotnetc';

// The .NET Core CLI is included in all Azure-hosted agents
function RunTaskCbk(cliPath) {
    let dotnetCommand = tl.getInput('command', true);
    switch (dotnetCommand) {
        case 'restore':
            performDotnetRestore(cliPath);
            break;
        case 'push':
            performDotnetNugetPush(cliPath);
            break;
    }
}

function performDotnetRestore(cliPath) {
    let sourcesPattern = tl.getInput('rootPath');
    let filesList = solutionPathUtil.resolveFilterSpec(sourcesPattern, tl.getVariable('System.DefaultWorkingDirectory') || process.cwd());
    // A source file is a solution or csproj file.
    filesList.forEach(sourceFile => {
        let sourcePath;
        if (!fs.lstatSync(sourceFile).isDirectory()) {
            sourcePath = path.dirname(sourceFile);
        } else {
            sourcePath = sourceFile;
        }
        let configuredServerId = performDotnetConfig(cliPath, sourcePath, 'targetResolveRepo', null);
        let dotnetArguments = buildDotnetCliArgs();
        let dotnetCommand = utils.cliJoin(cliPath, cliDotnetCoreRestoreCommand, dotnetArguments);
        runDotnet(dotnetCommand, sourcePath, cliPath, configuredServerId);
    });
}

function performDotnetNugetPush(cliPath) {
    let buildDir = tl.getVariable('System.DefaultWorkingDirectory');
    let targetRepo = tl.getInput('targetDeployRepo', true);
    let nupkgPath = utils.fixWindowsPaths(tl.getPathInput('pathToNupkg', true, false));
    let uploadCommand = utils.cliJoin(cliPath, cliUploadCommand, utils.quote(nupkgPath), targetRepo);
    let artifactoryService = tl.getInput('artifactoryService', true);
    uploadCommand = utils.addUrlAndCredentialsParams(uploadCommand, artifactoryService);
    runDotnet(uploadCommand, buildDir, cliPath);
}

function runDotnet(nugetCommandCli, buildDir, cliPath, configuredServerId) {
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        nugetCommandCli = utils.cliJoin(nugetCommandCli, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
    }
    try {
        utils.executeCliCommand(nugetCommandCli, buildDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        if (configuredServerId) {
            utils.deleteCliServers(cliPath, buildDir, configuredServerId);
        }
    }
}

// Create dotnet config
function performDotnetConfig(cliPath, requiredWorkDir, repoResolve, repoDeploy) {
    configuredServerId = utils.createBuildToolConfigFile(
        cliPath,
        'artifactoryService',
        'dotnet',
        requiredWorkDir,
        dotnetConfigCommand,
        repoResolve,
        null
    );
}

// Creates the .NET Core CLI arguments
function buildDotnetCliArgs() {
    let nugetArguments = '';

    let noNuGetCache = tl.getBoolInput('noNuGetCache');
    if (noNuGetCache) {
        nugetArguments = utils.cliJoin(nugetArguments, '--no-cache');
    }

    let packagesDirectory = tl.getPathInput('packagesDirectory');
    if (!tl.filePathSupplied('packagesDirectory')) {
        packagesDirectory = null;
    }
    if (packagesDirectory) {
        nugetArguments = utils.cliJoin(nugetArguments, '--packages', packagesDirectory);
    }

    let verbosity = tl.getInput('verbosityRestore');
    if (verbosity && verbosity !== 'None') {
        nugetArguments = utils.cliJoin(nugetArguments, '--verbosity', verbosity);
    }

    let additionalArguments = tl.getInput('arguments');
    if (additionalArguments) {
        nugetArguments = utils.cliJoin(nugetArguments, additionalArguments);
        ;
    }
    return nugetArguments;
}

utils.executeCliTask(RunTaskCbk);
