
const tl = require('vsts-task-lib/task');
const execSync = require('child_process').execSync;
const utils = require('jfrog-utils');

const cliPromoteCommand = "rt bpr";

function RunTaskCbk(cliPath) {
    process.env["JFROG_CLI_OFFER_CONFIG"] = false;

    let buildDir = tl.getVariable('Agent.BuildDirectory');
    let buildDefinition = tl.getVariable('BUILD.DEFINITIONNAME');
    let buildNumber = tl.getVariable('BUILD_BUILDNUMBER');

    // Get input parameters
    let artifactoryService = tl.getInput("artifactoryService", false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let targetRepo = tl.getInput("targetRepo", true);

    let cliCommand = utils.cliJoin(cliPath, cliPromoteCommand, utils.quote(buildDefinition), utils.quote(buildNumber), utils.quote(targetRepo), "--url=" + utils.quote(artifactoryUrl));

    cliCommand = utils.addArtifactoryCredentials(cliCommand, artifactoryService);
    cliCommand = addStringParam(cliCommand, "status", "status");
    cliCommand = addStringParam(cliCommand, "comment", "comment");
    cliCommand = addStringParam(cliCommand, "sourceRepo", "source-repo");
    cliCommand = addBoolParam(cliCommand, "includeDependencies", "include-dependencies");
    cliCommand = addBoolParam(cliCommand, "copy", "copy");
    cliCommand = addBoolParam(cliCommand, "dryRun", "dry-run");

    executeCliCommand(cliCommand, buildDir);
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
}

function addStringParam(cliCommand, inputParam, cliParam) {
    let val = tl.getInput(inputParam, false);
    if (val !== null) {
        cliCommand = utils.cliJoin(cliCommand, "--" + cliParam + "='" + val + "'")
    }
    return cliCommand
}

function addBoolParam(cliCommand, inputParam, cliParam) {
    let val = tl.getBoolInput(inputParam, false);
    cliCommand = utils.cliJoin(cliCommand, "--" + cliParam + "=" + val);
    return cliCommand
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
    tl.setResult(tl.TaskResult.Failed, ex);
    process.exit(1);
}

utils.executeCliTask(RunTaskCbk);
