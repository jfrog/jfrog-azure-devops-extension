
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const cliPromoteCommand = "rt bpr";

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let targetRepo = tl.getInput("targetRepo", true);

    let cliCommand = utils.cliJoin(cliPath, cliPromoteCommand, utils.quote(buildName), utils.quote(buildNumber), utils.quote(targetRepo), "--url=" + utils.quote(artifactoryUrl));

    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, "status", "status");
    cliCommand = utils.addStringParam(cliCommand, "comment", "comment");
    cliCommand = utils.addStringParam(cliCommand, "sourceRepo", "source-repo");
    cliCommand = utils.addBoolParam(cliCommand, "includeDependencies", "include-dependencies");
    cliCommand = utils.addBoolParam(cliCommand, "copy", "copy");
    cliCommand = utils.addBoolParam(cliCommand, "dryRun", "dry-run");

    let taskRes = utils.executeCliCommand(cliCommand, process.cwd());
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
