const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const fs = require('fs');
const path = require('path');

let serverId;
RunJfrogCliCommand(RunTaskCbk);

function RunJfrogCliCommand(RunTaskCbk) {
    // If no custom version requested, run with the version of the rest of the pipeline.
    if (!tl.getBoolInput('useCustomVersion')) {
        utils.executeCliTask(RunTaskCbk);
        return;
    }
    let cliVersion = tl.getInput('cliVersion', true);

    // Custom version selected, but placeholder provided.
    if (cliVersion.localeCompare('$(jfrogCliVersion)') === 0) {
        utils.executeCliTask(RunTaskCbk);
        return;
    }

    // If the min version allowed is higher than the requested version we will fail the task.
    if (utils.compareVersions(utils.minCustomCliVersion, cliVersion) > 0) {
        tl.setResult(tl.TaskResult.Failed, 'Custom JFrog CLI Version must be at least ' + utils.minCustomCliVersion);
        return;
    }
    utils.executeCliTask(RunTaskCbk, cliVersion);
}

async function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Determine working directory for the cli.
    let inputWorkingDirectory = tl.getInput('workingDirectory', false);
    let requiredWorkDir = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);
    if (!fs.existsSync(requiredWorkDir) || !fs.lstatSync(requiredWorkDir).isDirectory()) {
        tl.setResult(tl.TaskResult.Failed, "Provided 'Working Directory': " + requiredWorkDir + ' neither exists nor a directory.');
        return;
    }

    // Set default build name and number environment variables
    process.env.JFROG_CLI_BUILD_NAME = tl.getVariable('Build.DefinitionName');
    process.env.JFROG_CLI_BUILD_NUMBER = tl.getVariable('Build.BuildNumber');

    serverId = utils.assembleUniqueServerId('jfrog_cli_cmd');
    await utils.configureDefaultJfrogServer(serverId, cliPath, requiredWorkDir);

    if (tl.getBoolInput('enablePackageAlias')) {
        setUpPackageAlias(cliPath, requiredWorkDir);
    }

    let cliCommandsList = tl.getInput('command', true).split('\n');
    try {
        for (let cliCommand of cliCommandsList) {
            cliCommand = cliCommand.trim();
            if (!cliCommand.startsWith(utils.jfrogCliToolName + ' ')) {
                tl.setResult(
                    tl.TaskResult.Failed,
                    "Unexpected JFrog CLI command prefix. Expecting the command to start with 'jf '. The command received is: " + cliCommand,
                );
                utils.taskDefaultCleanup(cliPath, requiredWorkDir, [serverId]);
                return;
            }
            // Remove 'jf' and space from the beginning of the command string, so we can use the CLI's path
            cliCommand = cliCommand.slice(utils.jfrogCliToolName.length + 1);
            cliCommand = utils.cliJoin(cliPath, cliCommand);
            if (utils.isServerIdEnvSupported()) {
                // Provide Server ID to JFrog CLI via environment variable
                process.env.JFROG_CLI_SERVER_ID = serverId;
            } else {
                // Provide Server ID to JFrog CLI via --server-id flag
                cliCommand = utils.addServerIdOption(cliCommand, serverId);
            }
            // Execute the cli command.
            utils.executeCliCommand(cliCommand, requiredWorkDir);
        }
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        utils.taskDefaultCleanup(cliPath, requiredWorkDir, [serverId]);
    }
    tl.setResult(tl.TaskResult.Succeeded, 'Command Succeeded.', cliPath);
}

/**
 * Installs JFrog CLI's package-alias ('Ghost Frog') shims and registers them on PATH,
 * so native build tool invocations for the rest of the pipeline job route through 'jf'.
 */
function setUpPackageAlias(cliPath, requiredWorkDir) {
    let cliVersion = tl.getVariable(utils.taskSelectedCliVersionEnv);
    if (utils.compareVersions(cliVersion, utils.minSupportedPackageAliasCliVersion) < 0) {
        console.warn(
            `Package Alias is not supported by JFrog CLI ${cliVersion}. Minimum required version is ${utils.minSupportedPackageAliasCliVersion}. Skipping.`,
        );
        return;
    }
    let packageAliasCommand = utils.cliJoin(cliPath, 'package-alias', 'install');
    let packageAliasTools = tl.getInput('packageAliasTools', false);
    if (packageAliasTools) {
        packageAliasCommand = utils.cliJoin(packageAliasCommand, '--packages=' + utils.quote(packageAliasTools));
    }
    utils.executeCliCommand(packageAliasCommand, requiredWorkDir);

    tl.prependPath(path.join(utils.getJfrogFolderPath(), 'package-alias', 'bin'));
    process.env.JFROG_CLI_GHOST_FROG = 'true';
    tl.setVariable('JFROG_CLI_GHOST_FROG', 'true');
}
