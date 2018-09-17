const utils = require('artifactory-tasks-utils');
const GenericTaskExecutor = utils.GenericTaskExecutor;
const GENERIC_TASK_CONFIGURATION = utils.GENERIC_TASK_CONFIGURATION;

function RunTaskCbk(cliPath) {
    let genericTaskExecutor = new GenericTaskExecutor(GENERIC_TASK_CONFIGURATION.DOWNLOAD, cliPath);
    genericTaskExecutor.run();
}

utils.executeCliTask(RunTaskCbk);
