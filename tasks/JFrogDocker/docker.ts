import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

let serverId: string;

function isPodman(): boolean {
    try {
        const result: string = tl.execSync('docker', ['version']).stdout || '';
        tl.debug('docker version output: ' + result);
        return /podman/i.test(result);
    } catch {
        return false;
    }
}

function RunTaskCbk(cliPath: string): void {
    if (!utils.isToolExists('docker')) {
        tl.setResult(tl.TaskResult.Failed, 'Agent is missing required tool: docker.');
        return;
    }

    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') ?? '';
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    const imageName: string = tl.getInput('imageName', true) ?? '';
    const command: string = tl.getInput('command', true) ?? '';
    if (isPodman()) {
        // Route 'jf docker' subcommands through Podman inside the CLI.
        // The CLI reads this env var and will: invoke the 'podman' binary for push/pull/login,
        // skip the Docker daemon SDK call (no /var/run/docker.sock required), and resolve the
        // target repo via Artifactory's X-Artifactory-Docker-Registry header — which works for
        // path, subdomain, and port-based (reverse proxy) repository layouts.
        // Requires JFrog CLI >= <version-with-JFROG_CLI_CONTAINER_MANAGER-support>.
        process.env['JFROG_CLI_CONTAINER_MANAGER'] = 'podman';
        tl.debug('Podman detected. Setting JFROG_CLI_CONTAINER_MANAGER=podman.');
    }
    let cliCommand: string = utils.cliJoin(cliPath, 'docker', command.toLowerCase(), utils.quote(imageName));
    switch (command) {
        case 'Push':
        case 'Pull': {
            serverId = utils.configureDefaultArtifactoryServer('docker_' + command, cliPath, defaultWorkDir);
            cliCommand = utils.appendBuildFlagsToCliCommand(cliCommand);
            break;
        }
        case 'Scan': {
            serverId = utils.configureDefaultXrayServer('xray_docker_scan', cliPath, defaultWorkDir);
            cliCommand = utils.addBoolParam(cliCommand, 'allowFailBuild', 'fail');

            if (tl.getBoolInput('allowBypassArchiveLimits', false)) {
                cliCommand = utils.addBoolParam(cliCommand, 'allowBypassArchiveLimits', 'bypass-archive-limits');
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
