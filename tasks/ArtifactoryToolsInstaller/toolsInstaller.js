const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

InstallCliAndExecuteCliTask(RunTaskCbk);

function InstallCliAndExecuteCliTask(RunTaskCbk) {
    let artifactoryService = tl.getInput("artifactoryService", true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, true);
    let cliInstallationRepo = tl.getInput("cliInstallationRepo", true);

    let downloadUrl = utils.buildCliArtifactoryDownloadUrl(artifactoryUrl,cliInstallationRepo);
    let authHandlers = utils.createAuthHandlers(artifactoryService);
    utils.executeCliTask(RunTaskCbk, downloadUrl, authHandlers);
}

function RunTaskCbk(cliPath) {
    let installMavenExtractor = tl.getBoolInput("installMavenExtractor");
    if (!installMavenExtractor) {
        tl.setResult(tl.TaskResult.Succeeded, "Tools installed successfully.");
        return;
    }
    console.log("Installing Maven Extractor...");

    // Get inputs and variables
    let artifactoryService = tl.getInput("artifactoryService");
    let buildName = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Config a temporary serverId for maven extractor download:
    let serverId = buildName + "-" + buildNumber + "-forextractordownload";
    let taskRes = utils.configureCliServer(artifactoryService, serverId, cliPath, workDir);
    if (taskRes) {
        utils.setResultFailedIfError(taskRes);
        taskRes = utils.deleteCliServers(cliPath, workDir, [serverId]);
        utils.setResultFailedIfError(taskRes);
        return;
    }

    // Set the environment variables needed for the cli to download the extractor from artifactory
    // The extractor download will occur during the execution of the Artifactory Maven task, then the config and environment variables will be removed
    tl.setVariable("JFROG_CLI_JCENTER_REMOTE_SERVER", serverId);
    tl.setVariable("JFROG_CLI_JCENTER_REMOTE_REPO", tl.getInput("mavenInstallationRepo"));
    tl.setResult(tl.TaskResult.Succeeded, "Tools installed successfully.")
}