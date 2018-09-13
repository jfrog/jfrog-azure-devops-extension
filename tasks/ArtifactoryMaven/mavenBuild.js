let tl = require('vsts-task-lib/task');
const path = require('path');
let utils = require('artifactory-tasks-utils');
const CliCommandBuilder = utils.CliCommandBuilder;
const cliConfigCommand = "rt c";
const cliMavenCommand = "rt mvn";
let serverIdDeployer;
let serverIdResolver;
const execSync = require('child_process').execSync;

function RunTaskCbk(cliPath) {
    checkAndSetMavenHome();

    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Creating the config file for Maven
    let {config, commandRes} = createMavenConfigFile(workDir, cliPath);
    if (commandRes) {
        return;
    }

    // Running Maven command
    commandRes = execMavenCommand(cliPath, config, commandRes, workDir);
    if (commandRes) {
        return;
    }

    commandRes = deleteServer(cliPath, workDir, serverIdDeployer, serverIdResolver);
    if (commandRes) {
        return;
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

function deleteServer(cliPath, buildDir, serverIdDeployer, serverIdResolver) {
    // Now we need to delete the server(s):
    // Delete serverIdResolver even if serverIdDeployer delete failed.
    // Will return at least one failure if one of the delete command fails.
    let commandRes = doDeleteServer(cliPath, serverIdDeployer, buildDir);
    if (serverIdResolver) {
        let commandRes = doDeleteServer(cliPath, serverIdResolver, buildDir);
        if (commandRes) {
            return commandRes;
        }
    }
    return commandRes;
}

/**
 * Delete by serverId. If fails, fail build and return failure response.
 * @private
 */
function doDeleteServer(cliPath, serverId, buildDir) {
    let deleteCommand = new CliCommandBuilder(cliPath)
        .addArguments(cliConfigCommand, "delete", serverId)
        .addOption("interactive", "false");

    return utils.executeCliCommand(deleteCommand.build(), buildDir);
}

function addToConfig(configInfo, name, snapshotRepo, releaseRepo, serverID) {
    configInfo += name + ":\n";
    configInfo += "  snapshotRepo: " + snapshotRepo + "\n";
    configInfo += "  releaseRepo: " + releaseRepo + "\n";
    configInfo += "  serverID: " + serverID + "\n";
    return configInfo
}

function configureServer(artifactoryService, serverId, cliPath, buildDir) {
    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliConfigCommand)
        .addArguments(serverId)
        .addArtifactoryServerWithCredentials(artifactoryService)
        .addOption("interactive", "false");

    return utils.executeCliCommand(command.build(), buildDir);
}

function writeMavenConfigFile(config, cliPath, buildDir, buildDefinition, buildNumber) {
    let configInfo = "version: 1\ntype: maven\n";
    // Get configured parameters
    let serverId = buildDefinition + "-" + buildNumber;
    // Configure deployer
    serverIdDeployer = serverId + "-deployer";
    let commandRes = configureServer("artifactoryDeployService", serverIdDeployer, cliPath, buildDir);
    if (commandRes) {
        return commandRes
    }
    let targetDeployReleaseRepo = tl.getInput("targetDeployReleaseRepo");
    let targetDeploySnapshotRepo = tl.getInput("targetDeploySnapshotRepo");
    configInfo = addToConfig(configInfo, "deployer", targetDeploySnapshotRepo, targetDeployReleaseRepo, serverIdDeployer);

    // Configure resolver
    let artifactoryResolver = tl.getInput("artifactoryResolverService");
    if (artifactoryResolver != null) {
        serverIdResolver = serverId + "-resolver";
        commandRes = configureServer("artifactoryResolverService", serverIdResolver, cliPath, buildDir);
        if (commandRes) {
            return commandRes
        }
        let targetResolveReleaseRepo = tl.getInput("targetResolveReleaseRepo");
        let targetResolveSnapshotRepo = tl.getInput("targetResolveSnapshotRepo");
        configInfo = addToConfig(configInfo, "resolver", targetResolveSnapshotRepo, targetResolveReleaseRepo, serverIdResolver);
    } else {
        console.log("Resolution from Artifactory is not configured");
    }
    console.log(configInfo);
    try {
        tl.writeFile(config, configInfo);
    } catch (ex) {
        return ex
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

function createMavenConfigFile(workDir, cliPath) {
    let config = path.join(workDir, "config");
    let buildName = utils.getBuildName();
    let buildNumber = utils.getBuildNumber();
    let commandRes = writeMavenConfigFile(config, cliPath, workDir, buildName, buildNumber);
    if (commandRes) {
        tl.setResult(tl.TaskResult.Failed, commandRes);
        deleteServer(cliPath, workDir, serverIdDeployer, serverIdResolver);
    }
    return {config, commandRes};
}

function execMavenCommand(cliPath, config, commandRes, workDir) {
    let goalsAndOptions = prepareGoals();
    let command = new CliCommandBuilder(cliPath)
        .addCommand(cliMavenCommand)
        .addArguments(goalsAndOptions, config)
        .addBuildFlagsIfRequired();

    commandRes = utils.executeCliCommand(command.build(), workDir);
    if (commandRes) {
        deleteServer(cliPath, workDir, serverIdDeployer, serverIdResolver);
    }
    return commandRes;
}

utils.executeCliTask(RunTaskCbk);