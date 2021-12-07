const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/artifactory-tasks-utils/utils.js');

const cliPromoteCommand = 'rt bpr';

function RunTaskCbk(cliPath) {
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);

    // Get input parameters
    let artifactoryService = tl.getInput('artifactoryService', false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let targetRepo = tl.getInput('targetRepo', true);

    let cliCommand = utils.cliJoin(
        cliPath,
        cliPromoteCommand,
        utils.quote(buildName),
        utils.quote(buildNumber),
        utils.quote(targetRepo),
        '--url=' + utils.quote(artifactoryUrl)
    );

    cliCommand = utils.addServiceConnectionCredentials(cliCommand, artifactoryService);
    cliCommand = utils.addStringParam(cliCommand, 'status', 'status');
    cliCommand = utils.addStringParam(cliCommand, 'comment', 'comment');
    cliCommand = utils.addStringParam(cliCommand, 'sourceRepo', 'source-repo');
    cliCommand = utils.addBoolParam(cliCommand, 'includeDependencies', 'include-dependencies');
    cliCommand = utils.addBoolParam(cliCommand, 'copy', 'copy');
    cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');
    cliCommand = utils.addProjectOption(cliCommand);

    try {
        utils.executeCliCommand(cliCommand, process.cwd());
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

utils.executeCliTask(RunTaskCbk);
