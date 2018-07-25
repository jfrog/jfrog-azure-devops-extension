
const tl = require('vsts-task-lib/task');
const execSync = require('child_process').execSync;
const utils = require('jfrog-utils');
const path = require('path');

const cliDownloadCommand = "rt u";

function RunTaskCbk(cliPath) {
    let buildDir = tl.getVariable('Agent.BuildDirectory');
    let buildDefinition = tl.getVariable('BUILD.DEFINITIONNAME');
    let buildNumber = tl.getVariable('BUILD_BUILDNUMBER');
    let specPath = path.join(buildDir, "uploadSpec.json");

    // Get configured parameters
    let artifactory = tl.getInput("artifactoryService", true);
    let artifactoryUrl = tl.getEndpointUrl(artifactory);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactory, "username", true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactory, "password", true);
    let filespec = tl.getInput("filespec", true);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");

    // Write provided filespec to file
    try {
        tl.writeFile(specPath, filespec);
    } catch (ex) {
        handleException(ex);
    }

    let cliCommand = utils.cliJoin(cliPath, cliDownloadCommand, "--url=" + artifactoryUrl, "--spec=" + specPath);

    // Check if should make anonymous access to artifactory
    if (artifactoryUser === "") {
        artifactoryUser = "anonymous";
        cliCommand = utils.cliJoin(cliCommand, "--user=" + artifactoryUser);
    } else {
        cliCommand = utils.cliJoin(cliCommand, "--user=" + artifactoryUser, "--password=" + artifactoryPassword);
    }

    // Add build info collection
    if (collectBuildInfo) {
        cliCommand = utils.cliJoin(cliCommand, "--build-name=" + buildDefinition, "--build-number=" + buildNumber);
    }

    executeCliCommand(cliCommand, buildDir);

    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

function executeCliCommand(cliCommand, runningDir) {
    try {
        execSync(cliCommand, {cwd:runningDir, stdio:[0,1,2]});
    } catch (ex) {
        // Error occurred
        handleException(ex);
    }
}

function handleException (ex) {
    console.log(ex);
    tl.setResult(tl.TaskResult.Failed);
    process.exit(1);
}

utils.executeCliTask(RunTaskCbk);
