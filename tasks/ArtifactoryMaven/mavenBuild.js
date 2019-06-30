let tl = require('azure-pipelines-task-lib/task');
const path = require('path');
let utils = require('artifactory-tasks-utils');
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

function RunTaskCbk(cliPath) {
    checkAndSetMavenHome();

    let buildName = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
        return;
    }

    // Creating the config file for Maven
    let config = path.join(workDir, "config");
    let taskRes = createMavenConfigFile(config, cliPath, workDir, buildName, buildNumber);
    if (taskRes) {
        utils.setResultFailedIfError(taskRes);
        taskRes = utils.deleteCliServers(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
        utils.setResultFailedIfError(taskRes);
        taskRes = removeExtractorDownloadVariables(cliPath, workDir);
        utils.setResultFailedIfError(taskRes);
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
    if (collectBuildInfo) {
        // Overwrite build name & number with custom values if collectBuildInfo is selected.
        buildName = tl.getInput('buildName', true);
        buildNumber = tl.getInput('buildNumber', true);
        mavenCommand = utils.cliJoin(mavenCommand, "--build-name=" + utils.quote(buildName), "--build-number=" + utils.quote(buildNumber));
    }

    taskRes = utils.executeCliCommand(mavenCommand, workDir);
    utils.setResultFailedIfError(taskRes);
    taskRes = utils.deleteCliServers(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    utils.setResultFailedIfError(taskRes);
    taskRes = removeExtractorDownloadVariables(cliPath, workDir);
    utils.setResultFailedIfError(taskRes);
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.")
}

function addToConfig(configInfo, name, snapshotRepo, releaseRepo, serverID) {
    configInfo += name + ":\n";
    configInfo += "  snapshotRepo: " + snapshotRepo + "\n";
    configInfo += "  releaseRepo: " + releaseRepo + "\n";
    configInfo += "  serverID: " + serverID + "\n";
    return configInfo
}

function createMavenConfigFile(config, cliPath, buildDir, buildName, buildNumber) {
    let configInfo = "version: 1\ntype: maven\n";
    // Get configured parameters
    let artifactoryDeployer = tl.getInput("artifactoryDeployService");
    let serverId = buildName + "-" + buildNumber;
    serverIdDeployer = serverId + "-deployer";
    let taskRes = utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
    if (taskRes) {
        return taskRes
    }
    let artifactoryResolver = tl.getInput("artifactoryResolverService");

    if (artifactoryResolver != null) {
        serverIdResolver = serverId + "-resolver";
        taskRes = utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
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

// Removes the cli server config and env variables set in ToolsInstaller task
function removeExtractorDownloadVariables(cliPath, workDir) {
    let taskRes;
    let serverId = tl.getVariable("JFROG_CLI_JCENTER_REMOTE_SERVER");
    if (serverId && serverId !== "") {
        taskRes = utils.deleteCliServers(cliPath, workDir, [serverId]);
        tl.setVariable("JFROG_CLI_JCENTER_REMOTE_SERVER", "");
        tl.setVariable("JFROG_CLI_JCENTER_REMOTE_REPO", "");
    }
    return taskRes;
}
