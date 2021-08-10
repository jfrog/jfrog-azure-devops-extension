const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils/utils.js');
const execSync = require('child_process').execSync;

const cliMavenCommand = 'rt mvn';
const mavenConfigCommand = 'rt mvnc';
let serverIdDeployer;
let serverIdResolver;
const MIN_CLI_VERSION_SUPPORTING_INCLUDE_PATTERNS = '1.51.0';

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

function createMavenConfigFile(cliPath, buildDir) {
    let cliCommand = utils.cliJoin(cliPath, mavenConfigCommand);

    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput('artifactoryResolverService');
    if (artifactoryResolver) {
        serverIdResolver = utils.assembleBuildToolServerId('maven', 'resolver');
        utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(serverIdResolver));
        cliCommand = utils.addStringParam(cliCommand, 'targetResolveReleaseRepo', 'repo-resolve-releases', true);
        cliCommand = utils.addStringParam(cliCommand, 'targetResolveSnapshotRepo', 'repo-resolve-snapshots', true);
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, skip if missing. This allows user to resolve dependencies from artifactory without deployment.
    let artifactoryDeployer = tl.getInput('artifactoryDeployService');
    if (artifactoryDeployer) {
        serverIdDeployer = utils.assembleBuildToolServerId('maven', 'deployer');
        utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-deploy=' + utils.quote(serverIdDeployer));
        cliCommand = utils.addStringParam(cliCommand, 'targetDeployReleaseRepo', 'repo-deploy-releases', true);
        cliCommand = utils.addStringParam(cliCommand, 'targetDeploySnapshotRepo', 'repo-deploy-snapshots', true);
        let filterDeployedArtifacts = tl.getBoolInput('filterDeployedArtifacts');
        if (filterDeployedArtifacts) {
            if (isMvnIncludePatternsSupported()) {
                cliCommand = utils.addStringParam(cliCommand, 'includePatterns', 'include-patterns', false);
                cliCommand = utils.addStringParam(cliCommand, 'excludePatterns', 'exclude-patterns', false);
            } else {
                tl.warning(
                    'Filtering Maven deployed artifacts is only supported with JFrog CLI version ' +
                        MIN_CLI_VERSION_SUPPORTING_INCLUDE_PATTERNS +
                        ' or above.'
                );
            }
        }
    } else {
        console.info('Deployment skipped since artifactoryDeployService was not set.');
    }
    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, buildDir, null);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
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

function isMvnIncludePatternsSupported() {
    let cliVersion = tl.getVariable(utils.taskSelectedCliVersionEnv);
    return utils.compareVersions(cliVersion, MIN_CLI_VERSION_SUPPORTING_INCLUDE_PATTERNS) >= 0;
}
