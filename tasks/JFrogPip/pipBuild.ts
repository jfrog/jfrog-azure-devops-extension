import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

const cliPipInstallCommand: string = 'pip install';
const pipConfigCommand: string = 'pip-config';
const disablePipCacheFlags: string = '--no-cache-dir --force-reinstall';

async function RunTaskCbk(cliPath: string): Promise<void> {
    const pipCommand: string = tl.getInput('command', true) ?? '';
    switch (pipCommand) {
        case 'install':
            await performPipInstall(cliPath);
            break;
    }
}

async function performPipInstall(cliPath: string): Promise<void> {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) ?? '';
    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    const sourcePath: string = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);
    const pipArguments: string = buildPipCliArgs();
    let pipCommand: string = utils.cliJoin(cliPath, cliPipInstallCommand, pipArguments);
    const virtualEnvActivation: string | undefined = tl.getInput('virtualEnvActivation', false);
    if (virtualEnvActivation) {
        pipCommand = utils.cliJoin(virtualEnvActivation, '&&', pipCommand);
    }
    await executeCliCommand(pipCommand, sourcePath, cliPath);
}

async function executeCliCommand(cliCmd: string, buildDir: string, cliPath: string): Promise<void> {
    const configuredServerIds: string[] = await performPipConfig(cliPath, buildDir);
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
async function performPipConfig(cliPath: string, requiredWorkDir: string): Promise<string[]> {
    return await utils.createBuildToolConfigFile(cliPath, 'pip', requiredWorkDir, pipConfigCommand, 'targetResolveRepo', '');
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
