const cliCommandBuilder = require('./cliCommandBuilder');
const genericTaskExecutor = require('./genericTaskExecutor');
const stringUtils = require('./stringUtils');
const osUtils = require('./osUtils');
const taskUtils = require('./taskUtils');

module.exports = {
    CliCommandBuilder: cliCommandBuilder.CliCommandBuilder,
    getBuildName: cliCommandBuilder.getBuildName,
    getBuildNumber: cliCommandBuilder.getBuildNumber,
    executeCliTask: taskUtils.executeCliTask,
    executeCliCommand: taskUtils.executeCliCommand,
    prepareFileSpec: taskUtils.prepareFileSpec,
    isToolExists: taskUtils.isToolExists,
    joinArgs: stringUtils.joinArgs,
    quote: stringUtils.quote,
    fixWindowsPaths: stringUtils.fixWindowsPaths,
    encodePath: stringUtils.encodePath,
    getArchitecture: osUtils.getArchitecture,
    isWindows: osUtils.isWindows,
    GENERIC_TASK_CONFIGURATION: genericTaskExecutor.GENERIC_TASK_CONFIGURATION,
    GenericTaskExecutor: genericTaskExecutor.GenericTaskExecutor
};