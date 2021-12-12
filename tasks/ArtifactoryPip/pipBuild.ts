import * as utils from '@jfrog/artifactory-tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

const cliPipInstallCommand: string = 'rt pip-install';
const pipConfigCommand: string = 'rt pip-config';
const disablePipCacheFlags: string = '--no-cache-dir --force-reinstall';

function RunTaskCbk(cliPath: string): void {
    const pipCommand: string = tl.getInput('command', true) || '';
    switch (pipCommand) {
        case 'install':
            performPipInstall(cliPath);
            break;
    }
}

function performPipInstall(cliPath: string): void {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) || '';
    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    const sourcePath: string = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);
    const pipArguments: string = buildPipCliArgs();
    let pipCommand: string = utils.cliJoin(cliPath, cliPipInstallCommand, pipArguments);
    const virtualEnvActivation: string | undefined = tl.getInput('virtualEnvActivation', false);
    if (virtualEnvActivation) {
        pipCommand = utils.cliJoin(virtualEnvActivation, '&&', pipCommand);
    }
    executeCliCommand(pipCommand, sourcePath, cliPath);
}

function executeCliCommand(cliCmd: string, buildDir: string, cliPath: string): void {
    const configuredServerIds: string[] = performPipConfig(cliPath, buildDir);
    const collectBuildInfo: boolean = tl.getBoolInput('collectBuildInfo');
    if (collectBuildInfo) {
        const buildName: string = tl.getInput('buildName', true) || '';
        const buildNumber: string = tl.getInput('buildNumber', true) || '';
        cliCmd = utils.cliJoin(cliCmd, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
        cliCmd = utils.addProjectOption(cliCmd);
    }
    try {
        utils.executeCliCommand(cliCmd, buildDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        if (configuredServerIds) {
            utils.deleteCliServers(cliPath, buildDir, configuredServerIds);
        }
    }
}

// Creates Python pip configuration and returns the configured resolver server ID
function performPipConfig(cliPath: string, requiredWorkDir: string): string[] {
    return utils.createBuildToolConfigFile(cliPath, 'artifactoryService', 'pip', requiredWorkDir, pipConfigCommand, 'targetResolveRepo', '');
}

// Creates the Python CLI arguments
function buildPipCliArgs(): string {
    let pipArguments: string = tl.getInput('arguments') || '';
    const noCache: boolean = tl.getBoolInput('noPipCache');
    if (noCache) {
        pipArguments = utils.cliJoin(pipArguments, disablePipCacheFlags);
    }
    return pipArguments;
}

utils.executeCliTask(RunTaskCbk);
