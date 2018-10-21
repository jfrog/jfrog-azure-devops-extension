const CliCommandBuilder = require('./cliCommandBuilder').CliCommandBuilder;
const fs = require('fs-extra');
const tl = require('vsts-task-lib/task');
const path = require('path');
const execSync = require('child_process').execSync;
const toolLib = require('vsts-task-tool-lib/tool');
const osUtils = require('./osUtils');
const stringUtils = require('./stringUtils');

const fileName = getCliExecutableName();
const toolName = "jfrog";
const btPackage = "jfrog-cli-" + osUtils.getArchitecture();
const jfrogFolderPath = stringUtils.encodePath(path.join(tl.getVariable("Agent.WorkFolder"), "_jfrog"));
const jfrogCliVersion = "1.19.1";
const customCliPath = stringUtils.encodePath(path.join(jfrogFolderPath, "current", fileName)); // Optional - Customized jfrog-cli path.
const jfrogCliDownloadUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/' + jfrogCliVersion + '/' + btPackage + '/' + fileName + "?bt_package=" + btPackage;
const jfrogCliDownloadErrorMessage = "Failed while attempting to download JFrog CLI from " + jfrogCliDownloadUrl +
    ". If this build agent cannot access the internet, you can manually download version " + jfrogCliVersion +
    " of JFrog CLI and place it on the agent in the following path: " + customCliPath;

let runTaskCbk = null;

module.exports = {
    executeCliTask,
    executeCliCommand,
    prepareFileSpec,
    isToolExists,
    getBuildName,
    getBuildNumber,
    createCliDirs,
    downloadCli
};

function runCbk(cliPath) {
    console.log("Running jfrog-cli from " + cliPath);
    checkCliVersion(cliPath);
    runTaskCbk(cliPath)
}

function executeCliTask(runTaskFunc) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = false;

    runTaskCbk = runTaskFunc;
    getCliPath().then((cliPath) => {
        runCbk(cliPath);
        collectEnvVarsIfNeeded(cliPath);
    }).catch((error) => tl.setResult(tl.TaskResult.Failed, error))
}

function getCliPath() {
    return new Promise(
        function (resolve, reject) {
            let cliDir = toolLib.findLocalTool(toolName, jfrogCliVersion);
            if (fs.existsSync(customCliPath)) {
                tl.debug("Using cli from custom cli path: " + customCliPath);
                resolve(customCliPath);
            } else if (cliDir) {
                let cliPath = path.join(cliDir, fileName);
                tl.debug("Using existing versioned cli path: " + cliPath);
                resolve(cliPath);
            } else {
                createCliDirs();
                return downloadCli()
                    .then((cliPath) => resolve(cliPath))
                    .catch((error) => {
                        tl.setResult(tl.TaskResult.Failed, jfrogCliDownloadErrorMessage + "\n" + error);
                        reject(error)
                    });
            }
        }
    );
}

function executeCliCommand(cliCommand, runningDir, stdio) {
    try {
        if (!stdio) {
            stdio = [0, 1, 2];
        }
        tl.debug("Executing the command: " + cliCommand.replace(/--password=".*"/g, "--password=***"));
        tl.debug("Working directory: " + runningDir);
        execSync(cliCommand, {cwd: runningDir, stdio: stdio});
    } catch (ex) {
        // Error occurred
        throw ex.toString().replace(/--password=".*"/g, "--password=***");
    }
}

function checkCliVersion(cliPath) {
    let command = new CliCommandBuilder(cliPath).addArguments("--version");
    try {
        let res = execSync(command.build());
        let detectedVersion = String.fromCharCode.apply(null, res).split(' ')[2].trim();
        if (detectedVersion === jfrogCliVersion) {
            console.log("JFrog CLI version: " + detectedVersion);
            return;
        }
        console.warn("Expected to find version " + jfrogCliVersion + " of JFrog CLI at " + cliPath + ". Found version " + detectedVersion + " instead.");
    } catch (ex) {
        console.error("Failed to get JFrog CLI version: " + ex);
    }
}

function prepareFileSpec(specPath) {
    let specSource = tl.getInput("specSource", false);
    let fileSpec;
    if (specSource === "file") {
        let specInputPath = tl.getPathInput("file", true, true);
        console.log("Using file spec located at " + specInputPath);
        fileSpec = fs.readFileSync(specInputPath, "utf8");
    } else {
        fileSpec = tl.getInput("fileSpec", true);
    }
    fileSpec = stringUtils.fixWindowsPaths(fileSpec);
    validateSpecWithoutRegex(fileSpec);
    console.log("Using file spec:");
    console.log(fileSpec);
    // Write provided fileSpec to file
    tl.writeFile(specPath, fileSpec);
}

function isToolExists(toolName) {
    return !!tl.which(toolName, false);
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        fs.mkdirSync(jfrogFolderPath);
    }

    if (!fs.existsSync(path.join(jfrogFolderPath, jfrogCliVersion))) {
        fs.mkdirSync(path.join(jfrogFolderPath, jfrogCliVersion));
    }
}

function downloadCli() {
    return new Promise((resolve, reject) => {
        toolLib.downloadTool(jfrogCliDownloadUrl).then((downloadPath) => {
            toolLib.cacheFile(downloadPath, fileName, toolName, jfrogCliVersion).then((cliDir) => {
                let cliPath = path.join(cliDir, fileName);
                if (!osUtils.isWindows()) {
                    fs.chmodSync(cliPath, 0o555);
                }
                tl.debug("Finished downloading JFrog cli.");
                resolve(cliPath);
            })
        }).catch((err) => {
            reject(err);
        })
    });
}


function getCliExecutableName() {
    let executable = "jfrog";
    if (osUtils.isWindows()) {
        executable += ".exe"
    }
    return executable
}

function validateSpecWithoutRegex(fileSpec) {
    if (!osUtils.isWindows()) {
        return;
    }
    let files = JSON.parse(fileSpec)["files"];
    for (const file of Object.keys(files)) {
        let values = files[file];
        let regexp = values["regexp"];
        if (regexp && regexp.toLowerCase() === "true") {
            throw ("The File Spec includes 'regexp: true' which is currently not supported.");
        }
    }
}

/**
 * Runs collect environment variables JFrog CLI command if includeEnvVars is configured to true.
 * @param cliPath - (String) - The cli path.
 */
function collectEnvVarsIfNeeded(cliPath) {
    let includeEnvVars = tl.getBoolInput("includeEnvVars");
    if (includeEnvVars) {
        collectEnvVars(cliPath);
    }
}

/**
 * Runs collect environment variables JFrog CLI command.
 * @param cliPath - (String) - The cli path.
 * @returns (String|void) - String with error message or void if passes successfully.
 */
function collectEnvVars(cliPath) {
    console.log("Collecting environment variables...");
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    let command = new CliCommandBuilder(cliPath)
        .addCommand("rt bce")
        .addArguments(getBuildName(), getBuildNumber());
    executeCliCommand(command.build(), workDir);
}

/**
 * Returns the build name. In case of release, the param "Release.DefinitionName" will be used, "Build.DefinitionName" will be used otherwise.
 *
 * @returns {String} - The build name of the task. In case of release, the param "Release.DefinitionName" will be used, "Build.DefinitionName" will be used otherwise.
 */
function getBuildName() {
    let bn = tl.getVariable('Release.DefinitionName');
    if (bn) {
        return bn;
    }
    return tl.getVariable('Build.DefinitionName')
}

/**
 * Returns the build number of the task. In case of release, the param "Release.DeploymentID" will be used, "Build.BuildNumber" will be used otherwise.
 *
 * @returns {String} - The build number of the task. In case of release, the param "Release.DeploymentID" will be used, "Build.BuildNumber" will be used otherwise.
 */
function getBuildNumber() {
    let bn = tl.getVariable('Release.DeploymentID');
    if (bn) {
        return bn;
    }
    return tl.getVariable('Build.BuildNumber')
}
