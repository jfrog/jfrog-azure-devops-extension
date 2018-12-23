let tl = require('azure-pipelines-task-lib/task');
const path = require('path');
let utils = require('artifactory-tasks-utils');
const cliConfigCommand = "rt c";
const cliMavenCommand = "rt mvn";
let serverIdDeployer;
let serverIdResolver;
const execSync = require('child_process').execSync;

utils.executeCliTask(RunTaskCbk);

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

// Removing the servers from the config
function deleteServer(cliPath, buildDir, serverIdDeployer, serverIdResolver) {
    // Now we need to delete the server(s):
    let deleteServerIDCommand = utils.cliJoin(cliPath, cliConfigCommand, "delete", utils.quote(serverIdDeployer), "--interactive=false");
    let taskRes = utils.executeCliCommand(deleteServerIDCommand, buildDir);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
        return taskRes;
    }
    if (serverIdResolver) {
        deleteServerIDCommand = utils.cliJoin(cliPath, cliConfigCommand, "delete", utils.quote(serverIdResolver), "--interactive=false");
        taskRes = utils.executeCliCommand(deleteServerIDCommand, buildDir);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
        }
    }
    return taskRes;
}

function RunTaskCbk(cliPath) {
    checkAndSetMavenHome();

    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Creating the config file for Maven
    let config = path.join(workDir, "config");
    let taskRes = createMavenConfigFile(config, cliPath, workDir, buildDefinition, buildNumber);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
        taskRes = deleteServer(cliPath, workDir, serverIdDeployer, serverIdResolver);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
        }
        return;
    }

    // Running Maven command
    let pomFile = tl.getInput("mavenPOMFile");
    let goalsAndOptions = tl.getInput("goals");
    goalsAndOptions = utils.cliJoin(goalsAndOptions, "-f", pomFile);
    let options = tl.getInput("options");
    if (options) {
        goalsAndOptions = utils.cliJoin(goalsAndOptions, options)
    }
    let mavenCommand = utils.cliJoin(cliPath, cliMavenCommand, utils.quote(goalsAndOptions), config);
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");
    if (collectBuildInfo) {
        mavenCommand = utils.cliJoin(mavenCommand, "--build-name=" + utils.quote(buildDefinition), "--build-number=" + utils.quote(buildNumber));
    }

    taskRes = utils.executeCliCommand(mavenCommand, workDir);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
        taskRes = deleteServer(cliPath, workDir, serverIdDeployer, serverIdResolver);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
        }
        return;
    }

    taskRes = deleteServer(cliPath, workDir, serverIdDeployer, serverIdResolver);
    if (taskRes) {
        tl.setResult(tl.TaskResult.Failed, taskRes);
        return;
    }
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.")
}

function addToConfig(configInfo, name, snapshotRepo, releaseRepo, serverID) {
    configInfo += name + ":\n";
    configInfo += "  snapshotRepo: " + snapshotRepo + "\n";
    configInfo += "  releaseRepo: " + releaseRepo + "\n";
    configInfo += "  serverID: " + serverID + "\n";
    return configInfo
}

function configureServer(artifactory, serverId, cliPath, buildDir) {
    let artifactoryUrl = tl.getEndpointUrl(artifactory);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactory, "username");
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactory, "password");

    let cliCommand = utils.cliJoin(cliPath, cliConfigCommand, "--url=" + utils.quote(artifactoryUrl), "--user=" + utils.quote(artifactoryUser), "--password=" + utils.quote(artifactoryPassword), "--interactive=false", utils.quote(serverId));
    let taskRes = utils.executeCliCommand(cliCommand, buildDir);
    if (taskRes) {
        return taskRes;
    }
}

function createMavenConfigFile(config, cliPath, buildDir, buildDefinition, buildNumber) {
    let configInfo = "version: 1\ntype: maven\n";
    // Get configured parameters
    let artifactoryDeployer = tl.getInput("artifactoryDeployService");
    let serverId = buildDefinition + "-" + buildNumber;
    serverIdDeployer = serverId + "-deployer";
    let taskRes = configureServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
    if (taskRes) {
        return taskRes
    }
    let artifactoryResolver = tl.getInput("artifactoryResolverService");

    if (artifactoryResolver != null) {
        serverIdResolver = serverId + "-resolver";
        taskRes = configureServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        if (taskRes) {
            return taskRes
        }
        let targetResolveReleaseRepo = tl.getInput("targetResolveReleaseRepo");
        let targetResolveSnapshotRepo = tl.getInput("targetResolveSnapshotRepo");
        configInfo = addToConfig(configInfo, "resolver", targetResolveSnapshotRepo, targetResolveReleaseRepo, serverIdResolver);
    } else {
        console.log("Resolution from Artifactory is not configured");

    }

    let targetDeployReleaseRepo = tl.getInput("targetDeployReleaseRepo");
    let targetDeploySnapshotRepo = tl.getInput("targetDeploySnapshotRepo");
    configInfo = addToConfig(configInfo, "deployer", targetDeploySnapshotRepo, targetDeployReleaseRepo, serverIdDeployer);
    console.log(configInfo);
    try {
        tl.writeFile(config, configInfo);
    } catch (ex) {
        return ex
    }
}
