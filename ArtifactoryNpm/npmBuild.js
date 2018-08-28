
const tl = require('vsts-task-lib/task');
const utils = require('jfrog-utils');

const npmInstallCommand = "rt npmi";
const npmPublishCommand = "rt npmp";

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");
    let npmRepository;

    // Determine working directory for the cli
    let inputWorkingFolder = tl.getInput("workingFolder", false);
    let requiredWorkDir = determineCliWorkDir(defaultWorkDir, inputWorkingFolder);

    // Determine npm command
    let inputCommand = tl.getInput("command", true);
    let cliNpmCommand;
    if (inputCommand === "install") {
        cliNpmCommand = npmInstallCommand;
        npmRepository = tl.getInput("sourceRepo", true);
    } else if (inputCommand === "pack and publish") {
        cliNpmCommand = npmPublishCommand;
        npmRepository = tl.getInput("targetRepo", true);
    } else {
        tl.setResult(tl.TaskResult.Failed, "Received invalid npm command: "+ inputCommand);
        return;
    }

    // Build the cli command
    let cliCommand = utils.cliJoin(cliPath, cliNpmCommand, utils.quote(npmRepository), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, "arguments", "npm-args");

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + utils.quote(buildDefinition), "--build-number=" + utils.quote(buildNumber));

        // Collect env vars
        let taskRes = utils.collectEnvIfRequested(cliPath, buildDefinition, buildNumber, requiredWorkDir);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
            return;
        }
    }

    let taskRes = utils.executeCliCommand(cliCommand, requiredWorkDir);

    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

// Determines the required working directory for running the cli.
// Decision is based on the default path to run, and the provided path by the user.
function determineCliWorkDir(defaultPath, providedPath) {
    if (providedPath) {
        if (path.isAbsolute()) {
            return providedPath;
        }
        return path.join(defaultPath, providedPath);
    }
    return defaultPath;
}

utils.executeCliTask(RunTaskCbk);
