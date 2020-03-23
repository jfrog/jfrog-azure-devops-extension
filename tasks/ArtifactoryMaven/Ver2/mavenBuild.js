let tl = require('azure-pipelines-task-lib/task');
let utils = require('artifactory-tasks-utils');
const cliMavenCommand = 'rt mvn';
const mavenConfigCommand = 'rt mvnc';

let serverIdDeployer;
let serverIdResolver;
const execSync = require('child_process').execSync;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath) {
    checkAndSetMavenHome();
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Create Maven config file.
    try {
        createMavenConfigFile(cliPath, workDir);
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
    let mavenCommand = utils.cliJoin(cliPath, cliMavenCommand, goalsAndOptions);
    mavenCommand = utils.appendBuildFlagsToCliCommand(mavenCommand);

    try {
        utils.executeCliCommand(mavenCommand, workDir);
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

function createMavenConfigFile(cliPath, buildDir) {
    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput('artifactoryResolverService');
    let targetResolveReleaseRepo = '';
    let targetResolveSnapshotRepo = '';
    if (artifactoryResolver != null) {
        serverIdResolver = utils.assembleBuildToolServerId('maven', 'resolver');
        utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        targetResolveReleaseRepo = tl.getInput('targetResolveReleaseRepo');
        targetResolveSnapshotRepo = tl.getInput('targetResolveSnapshotRepo');
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, throws on failure.
    let artifactoryDeployer = tl.getInput('artifactoryDeployService');
    serverIdDeployer = utils.assembleBuildToolServerId('maven', 'deployer');
    utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
    let targetDeployReleaseRepo = tl.getInput('targetDeployReleaseRepo');
    let targetDeploySnapshotRepo = tl.getInput('targetDeploySnapshotRepo');
    // Build the cli config command.
    let cliCommand = utils.cliJoin(
        cliPath,
        mavenConfigCommand,
        '--server-id-resolve=' + utils.quote(serverIdResolver),
        '--repo-resolve-releases=' + utils.quote(targetResolveReleaseRepo),
        '--repo-resolve-snapshots=' + utils.quote(targetResolveSnapshotRepo),
        '--server-id-deploy=' + utils.quote(serverIdDeployer),
        '--repo-deploy-releases=' + utils.quote(targetDeployReleaseRepo),
        '--repo-deploy-snapshots=' + utils.quote(targetDeploySnapshotRepo)
    );

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, buildDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
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
