const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const path = require('path');

const cliBuildPublishCommand = 'rt bp';
let serverId;

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Get input parameters
    serverId = utils.configureDefaultArtifactoryServer('build_publish', cliPath, workDir);
    let excludeEnvVars = tl.getInput('excludeEnvVars', false);

    let cliCommand = utils.cliJoin(
        cliPath,
        cliBuildPublishCommand,
        utils.quote(buildName),
        utils.quote(buildNumber),
        excludeEnvVars ? '--env-exclude=' + utils.quote(excludeEnvVars) : ''
    );
    cliCommand = addBuildUrl(cliCommand);
    cliCommand = utils.addProjectOption(cliCommand);
    cliCommand = utils.addServerIdOption(cliCommand, serverId);

    try {
        let taskRes = utils.executeCliCommand(cliCommand, workDir, 'pipe');
        let resJson = JSON.parse(taskRes);
        let buildInfoUrl = resJson['buildInfoUiUrl'];
        if (buildInfoUrl) {
            attachBuildInfoUrl(buildInfoUrl, workDir);
        }
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.taskDefaultCleanup(cliPath, workDir, [serverId]);
    }
}

function attachBuildInfoUrl(buildInfoUrl, workDir) {
    let artifactoryUrlFile = path.join(workDir, 'artifactoryUrlFile');
    let buildDetails = {
        buildInfoUiUrl: buildInfoUrl
    };

    tl.writeFile(artifactoryUrlFile, JSON.stringify(buildDetails));

    //Executes command to attach the file to build
    console.log('##vso[task.addattachment type=artifactoryType;name=buildDetails;]' + artifactoryUrlFile);
}

function addBuildUrl(cliCommand) {
    let collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    let projectName = tl.getVariable('System.TeamProject');
    if (collectionUri && projectName) {
        let buildId = tl.getVariable('Build.BuildId');
        let releaseId = tl.getVariable('Release.ReleaseId');

        let buildUrl = collectionUri + projectName + '/_' + (releaseId ? 'release?releaseId=' + releaseId : 'build?buildId=' + buildId);
        cliCommand = utils.cliJoin(cliCommand, '--build-url=' + utils.quote(buildUrl));
    }
    return cliCommand;
}

utils.executeCliTask(RunTaskCbk);
