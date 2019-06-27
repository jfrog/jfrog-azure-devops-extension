
const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs-extra');
const utils = require('artifactory-tasks-utils');
const npmUtils = require('./npmUtils');

const npmInstallCommand = "rt npmi";
const npmPublishCommand = "rt npmp";
const npmCiCommand = "rt npmci";

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    // Determine working directory for the cli
    let inputWorkingFolder = tl.getInput("workingFolder", false);
    let requiredWorkDir = npmUtils.determineCliWorkDir(defaultWorkDir, inputWorkingFolder);
    if (!fs.existsSync(requiredWorkDir)) {
        tl.setResult(tl.TaskResult.Failed, "Provided 'Working folder with package.json' does not exist.");
        return;
    }

    // Determine npm command
    let inputCommand = tl.getInput("command", true);
    switch(inputCommand) {
        case 'install':
            performNpmInstallCi(npmInstallCommand, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir);
            break;
        case 'ci':
            performNpmInstallCi(npmCiCommand, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir);
            break;
        case 'pack and publish':
            performNpmPublish(npmPublishCommand, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir);
            break;
    }
}

function performNpmInstallCi(cliNpmCommand, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir) {
    let npmRepository = tl.getInput("sourceRepo", true);

    // Build the cli command
    let cliCommand = utils.cliJoin(cliPath, cliNpmCommand, utils.quote(npmRepository), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, "arguments", "npm-args");

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, getCollectBuildInfoFlags(true));
    }

    executeNpmTask(cliCommand, requiredWorkDir);
}

function performNpmPublish(cliNpmCommand, cliPath, artifactoryUrl, artifactoryService, collectBuildInfo, requiredWorkDir) {
    let npmRepository = tl.getInput("targetRepo", true);

    // Build the cli command
    let cliCommand = utils.cliJoin(cliPath, cliNpmCommand, utils.quote(npmRepository), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, "arguments", "npm-args");

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, getCollectBuildInfoFlags(false));
    }

    executeNpmTask(cliCommand, requiredWorkDir);
}

function getCollectBuildInfoFlags(addThreads) {
    // Construct the build-info collection flags.
    let buildName = tl.getInput('buildName',true);
    let buildNumber = tl.getInput('buildNumber',true);
    let commandAddition = utils.cliJoin("--build-name=" + utils.quote(buildName), "--build-number=" + utils.quote(buildNumber));

    // Check if need to add threads.
    if (addThreads) {
        let buildInfoThreads = tl.getInput("threads");
        commandAddition = utils.cliJoin(commandAddition, "--threads=" + utils.quote(buildInfoThreads));
    }

    return commandAddition;
}

function executeNpmTask(cliCommand, requiredWorkDir) {
    let taskRes = utils.executeCliCommand(cliCommand, requiredWorkDir);

    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
