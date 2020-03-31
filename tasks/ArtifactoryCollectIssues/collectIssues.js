const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');
const path = require('path');
const fs = require('fs-extra');

const cliCollectIssuesCommand = 'rt bag';

function RunTaskCbk(cliPath) {
    let defaultWorkDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!defaultWorkDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Get input parameters.
    let artifactoryService = tl.getInput('artifactoryService', false);
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let configSource = tl.getInput('configSource', false);

    // Create config yaml.
    let configPath = path.join(defaultWorkDir, 'issuesConfig_' + Date.now() + '.yaml');
    try {
        writeConfigFile(configSource, configPath);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    utils.configureCliServer(artifactoryService, artifactoryService, cliPath, defaultWorkDir);
    let cliCommand = utils.cliJoin(
        cliPath,
        cliCollectIssuesCommand,
        utils.quote(buildName),
        utils.quote(buildNumber),
        '--config=' + utils.quote(configPath),
        '--server-id=' + utils.quote(artifactoryService)
    );

    try {
        utils.executeCliCommand(cliCommand, defaultWorkDir);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        utils.deleteCliServers(cliPath, defaultWorkDir, [artifactoryService]);
        // Remove created config file from file system.
        try {
            tl.rmRF(configPath);
        } catch (fileException) {
            tl.setResult(tl.TaskResult.Failed, 'Failed cleaning temporary config file.');
        }
    }

    // Ignored if previously failed.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function writeConfigFile(configSourceInput, configPath) {
    let configContent;
    if (configSourceInput === 'file') {
        let configInputPath = tl.getPathInput('file', true, true);
        console.log('Using config file located at ' + configInputPath);
        configContent = fs.readFileSync(configInputPath, 'utf8');
    } else if (configSourceInput === 'taskConfiguration') {
        configContent = tl.getInput('taskConfig', true);
    } else {
        throw 'Failed creating config file, since the provided Config source value is invalid.';
    }
    console.log('Using config:');
    console.log(configContent);
    // Write provided config to file.
    tl.writeFile(configPath, configContent, 'utf8');
}

utils.executeCliTask(RunTaskCbk);
