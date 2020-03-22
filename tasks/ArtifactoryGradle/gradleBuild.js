let tl = require('azure-pipelines-task-lib');
const path = require('path');
let utils = require('artifactory-tasks-utils');
const cliGradleCommand = "rt gradle";
let serverIdDeployer;
let serverIdResolver;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath) {
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Create Gradle config file.
    let configPath = path.join(workDir, "config");
    try {
        createGradleConfigFile(configPath, cliPath, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        cleanup(cliPath, workDir);
        return;
    }

    // Running Gradle command
    let buildGradleFile = tl.getInput("buildFile");
    let tasksAndOptions = tl.getInput("tasks");
    tasksAndOptions = utils.cliJoin(tasksAndOptions, "-b", buildGradleFile);
    let options = tl.getInput("options");
    if (options) {
        tasksAndOptions = utils.cliJoin(tasksAndOptions, options)
    }
    let gradleCommand = utils.cliJoin(cliPath, cliGradleCommand, utils.quote(tasksAndOptions), configPath);
    gradleCommand = utils.appendBuildFlagsToCliCommand(gradleCommand);

    try {
        utils.executeCliCommand(gradleCommand, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        cleanup(cliPath, workDir);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.")
}

function createGradleConfigFile(configPath, cliPath, buildDir) {
    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput("artifactoryResolverService");
    let resolverObj = {};
    if (artifactoryResolver != null) {
        serverIdResolver = utils.assembleBuildToolServerId('gradle', 'resolver');
        utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        resolverObj = getDeployerResolverObj(tl.getInput("sourceRepo"), serverIdResolver);
    } else {
        console.log("Resolution from Artifactory is not configured");
    }

    // Configure deployer server, throws on failure.
    let artifactoryDeployer = tl.getInput("artifactoryDeployService");
    serverIdDeployer = utils.assembleBuildToolServerId('gradle', 'deployer');
    utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
    let deployerObj = getDeployerResolverObj(tl.getInput("targetRepo"), serverIdDeployer);
    utils.createBuildToolConfigFile(configPath, 'gradle', resolverObj, deployerObj);
}

function getDeployerResolverObj(repo, serverID) {
    return {repo: repo, serverID: serverID};
}

/**
 * Removes the cli server config and env variables set in ToolsInstaller task.
 * @throws In CLI execution failure.
 */
function removeExtractorDownloadVariables(cliPath, workDir) {
    let serverId = tl.getVariable("JFROG_CLI_JCENTER_REMOTE_SERVER");
    if (!serverId) {
        return;
    }
    tl.setVariable("JFROG_CLI_JCENTER_REMOTE_SERVER", "");
    tl.setVariable("JFROG_CLI_JCENTER_REMOTE_REPO", "");
    utils.deleteCliServers(cliPath, workDir, [serverId]);
}

function cleanup(cliPath, workDir) {
    // Delete servers.
    try {
        utils.deleteCliServers(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    } catch (deleteServersException) {
        tl.setResult(tl.TaskResult.Failed, deleteServersException);
    }
    // Remove extractor variables.
    try {
        removeExtractorDownloadVariables(cliPath, workDir);
    } catch (removeVariablesException) {
        tl.setResult(tl.TaskResult.Failed, removeVariablesException);
    }
}
