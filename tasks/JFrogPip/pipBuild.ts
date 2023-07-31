import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

const cliPipInstallCommand: string = 'pip install';
const pipConfigCommand: string = 'pip-config';
const disablePipCacheFlags: string = '--no-cache-dir --force-reinstall';

function RunTaskCbk(cliPath: string): void {
    const pipCommand: string = tl.getInput('command', true) ?? '';
    switch (pipCommand) {
        case 'install':
            performPipInstall(cliPath);
            break;
    }
}

function performPipInstall(cliPath: string): void {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) ?? '';
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
    cliCmd = utils.appendBuildFlagsToCliCommand(cliCmd);
    try {
        utils.executeCliCommand(cliCmd, buildDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        if (configuredServerIds) {
            utils.taskDefaultCleanup(cliPath, buildDir, configuredServerIds);
        }
    }
}

// Creates Python pip configuration and returns the configured resolver server ID
function performPipConfig(cliPath: string, requiredWorkDir: string): string[] {
    return utils.createBuildToolConfigFile(cliPath, 'pip', requiredWorkDir, pipConfigCommand, 'targetResolveRepo', '');
}

// Creates the Python CLI arguments
function buildPipCliArgs(): string {
    let pipArguments: string = tl.getInput('arguments') ?? '';
    const noCache: boolean = tl.getBoolInput('noPipCache');
    if (noCache) {
        pipArguments = utils.cliJoin(pipArguments, disablePipCacheFlags);
    }
    return pipArguments;
}

utils.executeCliTask(RunTaskCbk);
