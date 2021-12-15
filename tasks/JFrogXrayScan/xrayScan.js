const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');
const path = require('path');

const cliXrayBuildScanCommand = 'bs'; // todo
let serverId;

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);

    serverId = utils.assembleUniqueServerId('xray_build_scan');
    if (!utils.configureDefaultJfrogServer(serverId, cliPath, workDir)) {
        utils.configureDefaultXrayServer(serverId, cliPath, workDir);
    }

    // Get input parameters
    let allowFailBuild = tl.getBoolInput('allowFailBuild', false);

    let cliCommand = utils.cliJoin(cliPath, cliXrayBuildScanCommand, utils.quote(buildName), utils.quote(buildNumber), '--fail=false');
    cliCommand = utils.addProjectOption(cliCommand);
    utils.addServerIdOption(cliCommand, serverId);

    try {
        let taskRes = utils.executeCliCommand(cliCommand, process.cwd(), 'pipe');
        console.log('Scan result:\n' + taskRes);
        let resJson = JSON.parse(taskRes);
        let scanUrl = resJson['summary']['more_details_url'];
        if (scanUrl) {
            persistScanUrl(scanUrl);
        }

        // Check if should fail build.
        if (allowFailBuild) {
            let buildFailed = resJson['summary']['fail_build'];
            if (buildFailed) {
                tl.setResult(tl.TaskResult.Failed, "Build scan returned 'Fail Build'.");
            }
        } else {
            tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
        }
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    }
}

// Persist the result scan url.
// It is required for creating a scan link in the build's 'Artifactory' summary tab.
function persistScanUrl(scanUrl) {
    // Save build-scan link to a file.
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        throw new Error('Failed getting default working directory.');
    }
    let scanUrlFile = path.join(workDir, 'scanUrlFile');
    tl.writeFile(scanUrlFile, JSON.stringify(scanUrl));

    // Persist file.
    console.log('##vso[task.addattachment type=xrayType;name=scanDetails;]' + scanUrlFile);
}

utils.executeCliTask(RunTaskCbk);
