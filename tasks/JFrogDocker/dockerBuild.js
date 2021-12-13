const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');

const dockerPushCommand = 'rt dp';
const dockerPullCommand = 'rt dpl';

function RunTaskCbk(cliPath) {
    // Validate docker exists on agent
    if (!utils.isToolExists('docker')) {
        tl.setResult(tl.TaskResult.Failed, 'Agent is missing required tool: docker.');
        return;
    }

    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Get input parameters
    let artifactoryService = tl.getInput('artifactoryService', false);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');
    let imageName = tl.getInput('imageName', true);
    let dockerRepository;

    // Determine docker command
    let inputCommand = tl.getInput('command', true);
    let cliDockerCommand;
    if (inputCommand === 'push') {
        cliDockerCommand = dockerPushCommand;
        dockerRepository = tl.getInput('targetRepo', true);
    } else if (inputCommand === 'pull') {
        cliDockerCommand = dockerPullCommand;
        dockerRepository = tl.getInput('sourceRepo', true);
    } else {
        tl.setResult(tl.TaskResult.Failed, 'Received invalid docker command: ' + inputCommand);
        return;
    }

    // Build the cli command
    let cliCommand = utils.cliJoin(
        cliPath,
        cliDockerCommand,
        utils.quote(imageName),
        utils.quote(dockerRepository),
        '--url=' + utils.quote(artifactoryUrl)
    );
    cliCommand = utils.addServiceConnectionCredentials(cliCommand, artifactoryService);

    // Add build info collection
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCommand = utils.cliJoin(cliCommand, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
        cliCommand = utils.addProjectOption(cliCommand);
    }

    try {
        utils.executeCliCommand(cliCommand, defaultWorkDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

utils.executeCliTask(RunTaskCbk);
