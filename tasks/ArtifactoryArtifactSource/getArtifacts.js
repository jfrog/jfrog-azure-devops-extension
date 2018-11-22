
const tl = require('vsts-task-lib/task');
const utils = require('artifactory-tasks-utils');

function RunTaskCbk(cliPath) {

    //connection
    let artifactoryService = tl.getInput("connection", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    console.log("artifactory: " + artifactoryUrl);
    //definition
    let buildName = tl.getInput("definition", false);
    console.log("Build name: " + buildName);
    //version
    let buildNumber = tl.getInput("version", false);
    console.log("Build number: " + buildNumber);

    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    let cliCommand = utils.cliJoin(cliPath, "-v");
    let taskRes = utils.executeCliCommand(cliCommand, workDir);

    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
    } else {
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }

}

utils.executeCliTask(RunTaskCbk);
