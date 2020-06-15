const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

InstallCliAndExecuteCliTask(RunTaskCbk);

function InstallCliAndExecuteCliTask(RunTaskCbk) {
    let artifactoryService = tl.getInput('artifactoryService', true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, true);
    let cliInstallationRepo = tl.getInput('cliInstallationRepo', true);
    let cliVersion = utils.defaultJfrogCliVersion;
    // If a custom version was requested and provided (by a variable or a specific value) we will use it
    if (tl.getBoolInput('installCustomVersion') && tl.getInput('cliVersion', true).localeCompare('$(jfrogCliVersion)') !== 0) {
        cliVersion = tl.getInput('cliVersion', true);
        if (utils.comparVersions(cliVersion, utils.minCustomCliVersion) > 0) {
            tl.setResult(tl.TaskResult.Failed, 'Custom JFrog CLI Version must be at least ' + utils.minCustomCliVersion);
            return;
        }
    }

    let downloadUrl = utils.buildCliArtifactoryDownloadUrl(artifactoryUrl, cliInstallationRepo, cliVersion);
    let authHandlers = utils.createAuthHandlers(artifactoryService);
    utils.executeCliTask(RunTaskCbk, cliVersion, downloadUrl, authHandlers);
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
        utils.deleteCliServers(cliPath, workDir, [serverId]);

        return;
    }

    // Set the environment variables needed for the cli to download the extractor from artifactory
    // The extractor download will occur during the execution of the Artifactory Maven and Gradle tasks, then the config and environment variables will be removed
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_SERVER', serverId);
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_REPO', tl.getInput('extractorsInstallationRepo'));
    tl.setResult(tl.TaskResult.Succeeded, 'Tools installed successfully.');
}
