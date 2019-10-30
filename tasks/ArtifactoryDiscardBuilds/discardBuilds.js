
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const cliDiscardCommand = "rt bdi";

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName', true);

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);

    let cliCommand = utils.cliJoin(cliPath, cliDiscardCommand, utils.quote(buildName), "--url=" + utils.quote(artifactoryUrl));
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, "maxDays", "max-days");
    cliCommand = utils.addStringParam(cliCommand, "maxBuilds", "max-builds");
    cliCommand = utils.addStringParam(cliCommand, "excludeBuilds", "exclude-builds");
    cliCommand = utils.addBoolParam(cliCommand, "deleteArtifacts", "delete-artifacts");
    cliCommand = utils.addBoolParam(cliCommand, "async", "async");

    try {
        utils.executeCliCommand(cliCommand, process.cwd());
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

utils.executeCliTask(RunTaskCbk);
