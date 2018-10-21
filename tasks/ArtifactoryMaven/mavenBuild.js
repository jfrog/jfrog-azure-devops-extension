const tl = require('vsts-task-lib/task');
const path = require('path');
const utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;
const execSync = require('child_process').execSync;

const cliConfigCommand = "rt c";
const cliMavenCommand = "rt mvn";
const CONFIGURATION = {
    'RESOLUTION': {
        RESPONSIBILITY: "resolver",
        SERVICE_NAME: "artifactoryResolverService",
        TARGET_SNAPSHOT_REPO: "targetResolveSnapshotRepo",
        TARGET_RELEASE_REPO: "targetResolveReleaseRepo"
    },
    'DEPLOYMENT': {
        RESPONSIBILITY: "deployer",
        SERVICE_NAME: "artifactoryDeployService",
        TARGET_SNAPSHOT_REPO: "targetDeploySnapshotRepo",
        TARGET_RELEASE_REPO: "targetDeployReleaseRepo"
    }
};

let serverIdDeployer;
let serverIdResolver;
let workDir = tl.getVariable('System.DefaultWorkingDirectory');

function RunTaskCbk(cliPath) {
    checkAndSetMavenHome();
    if (!workDir) {
        throw new Error("Failed getting default working directory.");
    }

    // Creating the config file for Maven
    let config;
    try {
        config = createMavenConfigFile(cliPath);
    } catch (e) {
        throw new Error("Maven configuration creation failed: " + e);
    }
    // Running Maven command
    try {
        execMavenCommand(cliPath, config);
    } catch (e) {
        throw new Error("Maven execution failed: " + e);
    }
    // Deleting Server Configuration
    try {
        deleteServer(cliPath, serverIdDeployer, serverIdResolver);
    } catch (e) {
        throw new Error("Maven post build cleanup failed: " + e);
    }
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.")
}

function checkAndSetMavenHome() {
    let m2HomeEnvVar = tl.getVariable('M2_HOME');
    if (!m2HomeEnvVar) {
        console.log("M2_HOME is not defined. Retrieving Maven home using mvn --version.");
        // The M2_HOME environment variable is not defined.
        // Since Maven installation can be located in different locations,
        // depending on the installation type and the OS (for example: For Mac with brew install: /usr/local/Cellar/maven/{version}/libexec or Ubuntu with debian: /usr/share/maven),
        // we need to grab the location using the mvn --version command
        let mvnCommand = "mvn --version";
        let res = execSync(mvnCommand);
        let mavenHomeLine = String.fromCharCode.apply(null, res).split('\n')[1].trim();
        let mavenHome = mavenHomeLine.split(" ")[2];
        console.log("The Maven home location: " + mavenHome);
        process.env["M2_HOME"] = mavenHome;
    }
}

function deleteServer(cliPath, serverIdDeployer, serverIdResolver) {
    // Now we need to delete the server(s):
    // Delete serverIdResolver even if serverIdDeployer delete failed.
    // Will throw an exception if one of the delete command fails.
    try {
        doDeleteServer(cliPath, serverIdDeployer);
    } catch (e) {
        // In case of error try to delete the resolver server
        if (serverIdResolver) {
            doDeleteServer(cliPath, serverIdResolver);
        }
        throw new Error(e);
    }
    if (serverIdResolver) {
        doDeleteServer(cliPath, serverIdResolver);
    }
}

/**
 * Delete by serverId. If fails, fail build and return failure response.
 * @private
 */
function doDeleteServer(cliPath, serverId) {
    let deleteCommand = new CliCommandBuilder(cliPath)
        .addCommand(cliConfigCommand)
        .addArguments("delete", serverId)
        .addOption("interactive", "false");

    utils.executeCliCommand(deleteCommand.build(), workDir);
}

function doAddToConfig(configInfo, name, snapshotRepo, releaseRepo, serverID) {
    configInfo += name + ":\n";
    configInfo += "  snapshotRepo: " + snapshotRepo + "\n";
    configInfo += "  releaseRepo: " + releaseRepo + "\n";
    configInfo += "  serverID: " + serverID + "\n";
    return configInfo
}

function configureServer(artifactoryService, serverId, cliPath) {
    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliConfigCommand)
        .addArguments(serverId)
        .addArtifactoryServerWithCredentials(artifactoryService)
        .addOption("interactive", "false");

    utils.executeCliCommand(command.build(), workDir);
}

function writeMavenConfigFile(config, cliPath, buildDefinition, buildNumber) {
    let configInfo = "version: 1\ntype: maven\n";
    // Get configured parameters
    let serverId = buildDefinition + "-" + buildNumber;

    // Configure deployer
    serverIdDeployer = serverId + "-" + CONFIGURATION.DEPLOYMENT.RESPONSIBILITY;
    addToConfig(CONFIGURATION.DEPLOYMENT, serverIdDeployer);

    // Configure resolver
    let artifactoryResolver = tl.getInput("artifactoryResolverService");
    if (artifactoryResolver) {
        serverIdResolver = serverId + "-" + CONFIGURATION.RESOLUTION.RESPONSIBILITY;
        addToConfig(CONFIGURATION.RESOLUTION, serverIdResolver);
    } else {
        console.log("Resolution from Artifactory is not configured");
    }
    console.log(configInfo);
    tl.writeFile(config, configInfo);

    function addToConfig(configuration, serverId) {
        configureServer(configuration.SERVICE_NAME, serverId, cliPath);
        let targetResolveSnapshotRepo = tl.getInput(configuration.TARGET_SNAPSHOT_REPO);
        let targetResolveReleaseRepo = tl.getInput(configuration.TARGET_RELEASE_REPO);
        configInfo = doAddToConfig(configInfo, configuration.RESPONSIBILITY, targetResolveSnapshotRepo, targetResolveReleaseRepo, serverId);
    }
}

function prepareGoals() {
    let pomFile = tl.getInput("mavenPOMFile");
    let goalsAndOptions = tl.getInput("goals");
    goalsAndOptions = utils.joinArgs(goalsAndOptions, "-f", pomFile);
    let options = tl.getInput("options");
    if (options) {
        goalsAndOptions = utils.joinArgs(goalsAndOptions, options)
    }
    return goalsAndOptions;
}

function createMavenConfigFile(cliPath) {
    let config = path.join(workDir, "config");
    let buildName = utils.getBuildName();
    let buildNumber = utils.getBuildNumber();
    writeMavenConfigFile(config, cliPath, buildName, buildNumber);
    return config;
}

function execMavenCommand(cliPath, config) {
    let goalsAndOptions = prepareGoals();
    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliMavenCommand)
        .addArguments(goalsAndOptions, config)
        .addBuildFlagsIfRequired();

    try {
        utils.executeCliCommand(command.build(), workDir);
    } catch (e) {
        try {
            deleteServer(cliPath, serverIdDeployer, serverIdResolver);
        } catch (deleteError) {
            throw new Error(e + "\n" + deleteError)
        }
        throw new Error(e);
    }
}

utils.executeCliTask(RunTaskCbk);