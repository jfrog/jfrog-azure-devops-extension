
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const cliXrayScanCommand = "rt bs";

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName',true);
    let buildNumber = tl.getInput('buildNumber',true);

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);

    let cliCommand = utils.cliJoin(cliPath, cliXrayScanCommand, utils.quote(buildName), utils.quote(buildNumber), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addBoolParam(cliCommand, "allowFailBuild", "fail");

    let taskRes = utils.executeCliCommand(cliCommand, process.cwd());
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

utils.executeCliTask(RunTaskCbk);
