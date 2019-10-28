
const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const cliXrayScanCommand = "rt bs";

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let allowFailBuild = tl.getBoolInput("allowFailBuild", false);

    let cliCommand = utils.cliJoin(cliPath, cliXrayScanCommand, utils.quote(buildName), utils.quote(buildNumber), "--url=" + utils.quote(artifactoryUrl), "--fail=false");
    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);

    try {
        let taskRes = utils.executeCliCommand(cliCommand, process.cwd(), 'pipe');
        console.log(taskRes);
        // Check if should fail build.
        let resJson = JSON.parse(taskRes);
        if (allowFailBuild) {
            let buildFailed = resJson['summary']['fail_build'];
            if (buildFailed) {
                tl.setResult(tl.TaskResult.Failed, "Build scan returned 'Fail Build'.")
            }
        } else {
            tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
        }
    }
    catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

utils.executeCliTask(RunTaskCbk);
