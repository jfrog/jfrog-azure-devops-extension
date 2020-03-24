let tl = require('azure-pipelines-task-lib');
const path = require('path');
let utils = require('artifactory-tasks-utils');
const cliGradleCommand = 'rt gradle';
let serverIdDeployer;
let serverIdResolver;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath) {
    let workDir = tl.getInput('workDir');
    if (!workDir) {
        workDir = tl.getVariable('System.DefaultWorkingDirectory');
        if (!workDir) {
            tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
            return;
        }
    }

    // Create Gradle config file.
    let configPath = path.join(workDir, '.jfrog', 'projects', 'gradle.yaml');
    try {
        createGradleConfigFile(configPath, cliPath, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        cleanup(cliPath, workDir);
        return;
    }

    // Running Gradle command
    let buildGradleFile = tl.getInput('buildFile');
    buildGradleFile = path.relative(workDir, buildGradleFile);
    let tasksAndOptions = tl.getInput('tasks');
    tasksAndOptions = utils.cliJoin(tasksAndOptions, '-b', buildGradleFile);
    let options = tl.getInput('options');
    if (options) {
        tasksAndOptions = utils.cliJoin(tasksAndOptions, options);
    }
    let gradleCommand = utils.cliJoin(cliPath, cliGradleCommand, utils.quote(tasksAndOptions));
    gradleCommand = utils.appendBuildFlagsToCliCommand(gradleCommand);

    try {
        utils.executeCliCommand(gradleCommand, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        cleanup(cliPath, workDir);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function createGradleConfigFile(configPath, cliPath, buildDir) {
    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput('artifactoryResolverService');
    let resolverObj = {};
    if (artifactoryResolver != null) {
        serverIdResolver = utils.assembleBuildToolServerId('gradle', 'resolver');
        utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        resolverObj = getResolverObj(tl.getInput('sourceRepo'), serverIdResolver);
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, throws on failure.
    let artifactoryDeployer = tl.getInput('artifactoryDeployService');
    serverIdDeployer = utils.assembleBuildToolServerId('gradle', 'deployer');
    utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);

    let deployerObj = getDeployerObj(
        tl.getInput('targetRepo'),
        serverIdDeployer,
        tl.getBoolInput('deployMavenDesc'),
        tl.getBoolInput('deployIvyDesc'),
        tl.getInput('ivyDescPattern'),
        tl.getInput('ivyArtifactsPattern')
    );
    let extraArgs = {
        usesPlugin: tl.getBoolInput('usesPlugin'),
        useWrapper: tl.getBoolInput('useWrapper')
    };
    utils.createBuildToolConfigFile(configPath, 'gradle', resolverObj, deployerObj, extraArgs);
}

function getResolverObj(repo, serverID) {
    return {
        repo: repo,
        serverID: serverID
    };
}

function getDeployerObj(repo, serverID, deployMavenDescriptors, deployIvyDescriptors, ivyPattern, artifactPattern) {
    return {
        repo: repo,
        serverID: serverID,
        deployMavenDescriptors: deployMavenDescriptors,
        deployIvyDescriptors: deployIvyDescriptors,
        ivyPattern: ivyPattern,
        artifactPattern: artifactPattern
    };
}

/**
 * Removes the cli server config and env variables set in ToolsInstaller task.
 * @throws In CLI execution failure.
 */
function removeExtractorDownloadVariables(cliPath, workDir) {
    let serverId = tl.getVariable('JFROG_CLI_JCENTER_REMOTE_SERVER');
    if (!serverId) {
        return;
    }
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_SERVER', '');
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_REPO', '');
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
