import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

const cliDockerCommand: string = 'docker';
let serverId: string;

function RunTaskCbk(cliPath: string): void {
    // Validate docker exists on agent
    if (!utils.isToolExists('docker')) {
        tl.setResult(tl.TaskResult.Failed, 'Agent is missing required tool: docker.');
        return;
    }

    let defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') ?? '';
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    const imageName: string = tl.getInput('imageName', true) ?? '';
    const command: string = tl.getInput('command', true) ?? '';
    let cliCommand: string = utils.cliJoin(cliPath, cliDockerCommand, command.toLowerCase(), utils.quote(imageName));
    switch (command) {
        case 'Push':
        case 'Pull': {
            serverId = utils.configureDefaultArtifactoryServer('docker_' + command, cliPath, defaultWorkDir);
            cliCommand = utils.appendBuildFlagsToCliCommand(cliCommand);
            break;
        }
        case 'Scan': {
            serverId = utils.configureDefaultXrayServer('xray_docker_scan', cliPath, defaultWorkDir);
            if (tl.getBoolInput('allowFailBuild', false)) {
                cliCommand = utils.addBoolParam(cliCommand, 'allowFailBuild', 'fail');
            }
            // Add watches source if provided.
            const watchesSource: string = tl.getInput('watchesSource', false) ?? '';
            switch (watchesSource) {
                // Having a dash (-) in a param name in a visible rule is failing verification on Azure Server (TFS).
                // For that reason we do not use a dash in repo-path, and handle this param separately (not passing the option blindly to the CLI).
                case 'repoPath':
                    cliCommand = utils.addStringParam(cliCommand, 'repoPath', 'repo-path', true);
                    break;
                case 'watches':
                case 'project':
                    cliCommand = utils.addStringParam(cliCommand, watchesSource, watchesSource, true);
                    break;
                case 'none':
                    if (tl.getBoolInput('licenses', false)) {
                        cliCommand = utils.addBoolParam(cliCommand, 'licenses', 'licenses');
                    }
                    break;
            }
            break;
        }
        default:
            tl.setResult(tl.TaskResult.Failed, 'Command not supported: ' + command);
    }

    cliCommand = utils.addServerIdOption(cliCommand, serverId);
    if (tl.getBoolInput('skipLogin', false)) {
        cliCommand = utils.addBoolParam(cliCommand, 'skipLogin', 'skip-login');
    }

    try {
        utils.executeCliCommand(cliCommand, defaultWorkDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        utils.taskDefaultCleanup(cliPath, defaultWorkDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
