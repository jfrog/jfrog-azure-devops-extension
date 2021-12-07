const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const utils = require('@jfrog/artifactory-tasks-utils/utils.js');
const fs = require('fs');
const yaml = require('js-yaml');
const buildToolsConfigVersion = 1;
const cliMavenCommand = 'rt mvn';
const execSync = require('child_process').execSync;

let serverIdDeployer;
let serverIdResolver;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath) {
    utils.deprecatedTaskMessage('1', '2');
    checkAndSetMavenHome();
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Create Maven config file.
    let configPath = path.join(workDir, 'config');
    try {
        createMavenConfigFile(configPath, cliPath, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        cleanup(cliPath, workDir);
        return;
    }

    // Running Maven command
    let pomFile = tl.getInput('mavenPOMFile');
    let goalsAndOptions = tl.getInput('goals');
    goalsAndOptions = utils.cliJoin(goalsAndOptions, '-f', pomFile);
    let options = tl.getInput('options');
    if (options) {
        goalsAndOptions = utils.cliJoin(goalsAndOptions, options);
    }
    let mavenCommand = utils.cliJoin(cliPath, cliMavenCommand, utils.quote(goalsAndOptions), configPath);
    mavenCommand = utils.appendBuildFlagsToCliCommand(mavenCommand);
    try {
        utils.executeCliCommand(mavenCommand, workDir, null);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        cleanup(cliPath, workDir);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function checkAndSetMavenHome() {
    let m2HomeEnvVar = tl.getVariable('M2_HOME');
    if (!m2HomeEnvVar) {
        console.log('M2_HOME is not defined. Retrieving Maven home using mvn --version.');
        // The M2_HOME environment variable is not defined.
        // Since Maven installation can be located in different locations,
        // depending on the installation type and the OS (for example: For Mac with brew install: /usr/local/Cellar/maven/{version}/libexec or Ubuntu with debian: /usr/share/maven),
        // we need to grab the location using the mvn --version command
        let mvnCommand = 'mvn --version';
        let res = execSync(mvnCommand);
        let mavenHomeLine = String.fromCharCode
            .apply(null, res)
            .split('\n')[1]
            .trim();
        let mavenHome = mavenHomeLine.split(' ')[2];
        console.log('The Maven home location: ' + mavenHome);
        process.env['M2_HOME'] = mavenHome;
    }
}

function createMavenConfigFile(configPath, cliPath, buildDir) {
    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput('artifactoryResolverService');
    let resolverObj = {};
    if (artifactoryResolver != null) {
        serverIdResolver = utils.assembleBuildToolServerId('maven', 'resolver');
        utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        let targetResolveReleaseRepo = tl.getInput('targetResolveReleaseRepo');
        let targetResolveSnapshotRepo = tl.getInput('targetResolveSnapshotRepo');
        resolverObj = getDeployerResolverObj(targetResolveSnapshotRepo, targetResolveReleaseRepo, serverIdResolver);
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, throws on failure.
    let artifactoryDeployer = tl.getInput('artifactoryDeployService');
    serverIdDeployer = utils.assembleBuildToolServerId('maven', 'deployer');
    utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
    let targetDeployReleaseRepo = tl.getInput('targetDeployReleaseRepo');
    let targetDeploySnapshotRepo = tl.getInput('targetDeploySnapshotRepo');
    let deployerObj = getDeployerResolverObj(targetDeploySnapshotRepo, targetDeployReleaseRepo, serverIdDeployer);
    createYamlFile(configPath, 'maven', resolverObj, deployerObj);
}

function getDeployerResolverObj(snapshotRepo, releaseRepo, serverID) {
    return { snapshotRepo: snapshotRepo, releaseRepo: releaseRepo, serverId: serverID };
}

function cleanup(cliPath, workDir) {
    // Delete servers.
    utils.deleteCliServers(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    // Remove extractor variables.
    try {
        utils.removeExtractorsDownloadVariables(cliPath, workDir);
    } catch (removeVariablesException) {
        tl.setResult(tl.TaskResult.Failed, removeVariablesException);
    }
}

/**
 * Creates a Maven config file at a desired absolute path.
 * Resolver / Deployer object should consist serverID and repos according to the build tool used. For example,:
 * {snapshotRepo: 'jcenter', releaseRepo: 'jcenter', serverID: 'local'}
 */
function createYamlFile(configPath, buildToolType, resolverObj, deployerObj) {
    let yamlDocument = {};
    yamlDocument.version = buildToolsConfigVersion;
    yamlDocument.type = buildToolType;
    if (resolverObj && Object.keys(resolverObj).length > 0) {
        yamlDocument.resolver = resolverObj;
    }
    if (deployerObj && Object.keys(deployerObj).length > 0) {
        yamlDocument.deployer = deployerObj;
    }
    let configInfo = yaml.safeDump(yamlDocument);
    console.log(configInfo);
    fs.writeFileSync(configPath, configInfo);
}
