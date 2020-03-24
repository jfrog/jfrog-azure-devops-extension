const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

InstallCliAndExecuteCliTask(RunTaskCbk);

function InstallCliAndExecuteCliTask(RunTaskCbk) {
    let artifactoryService = tl.getInput('artifactoryService', true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, true);
    let cliInstallationRepo = tl.getInput('cliInstallationRepo', true);

    let downloadUrl = utils.buildCliArtifactoryDownloadUrl(artifactoryUrl, cliInstallationRepo);
    let authHandlers = utils.createAuthHandlers(artifactoryService);
    utils.executeCliTask(RunTaskCbk, downloadUrl, authHandlers);
}

function RunTaskCbk(cliPath) {
    let installExtractors = tl.getBoolInput('installExtractors');
    if (!installExtractors) {
        tl.setResult(tl.TaskResult.Succeeded, 'Tools installed successfully.');
        return;
    }
    console.log('Installing Maven and Gradle Extractors...');

    // Get inputs and variables
    let artifactoryService = tl.getInput('artifactoryService');
    let buildName = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Config a temporary serverId for maven and Gradle extractors download:
    let serverId = buildName + '-' + buildNumber + '-forextractorsdownload';
    try {
        utils.configureCliServer(artifactoryService, serverId, cliPath, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        try {
            utils.deleteCliServers(cliPath, workDir, [serverId]);
        } catch (deleteServersException) {
            tl.setResult(tl.TaskResult.Failed, deleteServersException);
        }
        return;
    }

    // Set the environment variables needed for the cli to download the extractor from artifactory
    // The extractor download will occur during the execution of the Artifactory Maven and Gradle tasks, then the config and environment variables will be removed
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_SERVER', serverId);
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_REPO', tl.getInput('extractorsInstallationRepo'));
    tl.setResult(tl.TaskResult.Succeeded, 'Tools installed successfully.');
}
