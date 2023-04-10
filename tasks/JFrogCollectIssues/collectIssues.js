const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const path = require('path');
const fs = require('fs');

const cliCollectIssuesCommand = 'rt bag';
let serverId;

function RunTaskCbk(cliPath) {
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

    // Get input parameters.
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let configSource = tl.getInput('configSource', false);

    // Create config yaml.
    let configPath = path.join(requiredWorkDir, 'issuesConfig_' + Date.now() + '.yaml');
    try {
        writeConfigFile(configSource, configPath);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }

    serverId = utils.configureDefaultArtifactoryServer('collect_issues', cliPath, requiredWorkDir);

    let cliCommand = utils.cliJoin(
        cliPath,
        cliCollectIssuesCommand,
        utils.quote(buildName),
        utils.quote(buildNumber),
        '--config=' + utils.quote(configPath)
    );
    cliCommand = utils.addProjectOption(cliCommand);
    cliCommand = utils.addServerIdOption(cliCommand, serverId);

    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir);
    } catch (executionException) {
        tl.setResult(tl.TaskResult.Failed, executionException);
    } finally {
        utils.taskDefaultCleanup(cliPath, requiredWorkDir, [serverId]);
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
