const fs = require('fs-extra');
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const execSync = require('child_process').execSync;
const toolLib = require('azure-pipelines-tool-lib/tool');

const fileName = getCliExecutableName();
const toolName = "jfrog";
const btPackage = "jfrog-cli-" + getArchitecture();
const jfrogFolderPath = encodePath(path.join(tl.getVariable("Agent.WorkFolder"), "_jfrog"));
const jfrogCliVersion = "1.22.0";
const customCliPath = encodePath(path.join(jfrogFolderPath, "current", fileName)); // Optional - Customized jfrog-cli path.
const jfrogCliDownloadUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/' + jfrogCliVersion + '/' + btPackage + '/' + fileName + "?bt_package=" + btPackage;
const jfrogCliDownloadErrorMessage = "Failed while attempting to download JFrog CLI from " + jfrogCliDownloadUrl +
    ". If this build agent cannot access the internet, you can manually download version " + jfrogCliVersion +
    " of JFrog CLI and place it on the agent in the following path: " + customCliPath;

let runTaskCbk = null;

module.exports = {
    executeCliTask: executeCliTask,
    executeCliCommand: executeCliCommand,
    downloadCli: downloadCli,
    cliJoin: cliJoin,
    quote: quote,
    addArtifactoryCredentials: addArtifactoryCredentials,
    addStringParam: addStringParam,
    addBoolParam: addBoolParam,
    fixWindowsPaths: fixWindowsPaths,
    validateSpecWithoutRegex: validateSpecWithoutRegex,
    encodePath: encodePath,
    getArchitecture: getArchitecture,
    isToolExists: isToolExists
};

function executeCliTask(runTaskFunc) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = false;

    runTaskCbk = runTaskFunc;
    getCliPath().then((cliPath) => {
        runCbk(cliPath);
        collectEnvVarsIfNeeded(cliPath);
    }).catch((error) => tl.setResult(tl.TaskResult.Failed, "Error occurred while executing task:\n" + error))
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
                    .catch((error) => reject(jfrogCliDownloadErrorMessage + "\n" + error));
            }
        }
    );
}

function executeCliCommand(cliCommand, runningDir, stdio) {
    try {
        if (!stdio) {
            stdio = [0, 1, 2];
        }
        execSync(cliCommand, {cwd: runningDir, stdio: stdio});
    } catch (ex) {
        // Error occurred
        return ex.toString().replace(/--password=".*"/g, "--password=***");
    }
}

function cliJoin() {
    let command = "";
    for (let i = 0; i < arguments.length; ++i) {
        let arg = arguments[i];
        if (arg.length > 0) {
            command += (command === "") ? arg : (" " + arg);
        }
    }
    return command;
}

function quote(str) {
    return "\"" + str + "\"";
}

function addArtifactoryCredentials(cliCommand, artifactoryService) {
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);
    // Check if should make anonymous access to artifactory
    if (artifactoryUser === "") {
        artifactoryUser = "anonymous";
        cliCommand = cliJoin(cliCommand, "--user=" + quote(artifactoryUser));
    } else {
        cliCommand = cliJoin(cliCommand, "--user=" + quote(artifactoryUser), "--password=" + quote(artifactoryPassword));
    }
    return cliCommand
}

function addStringParam(cliCommand, inputParam, cliParam) {
    let val = tl.getInput(inputParam, false);
    if (val !== null) {
        cliCommand = cliJoin(cliCommand, "--" + cliParam + "=" + quote(val))
    }
    return cliCommand
}

function addBoolParam(cliCommand, inputParam, cliParam) {
    let val = tl.getBoolInput(inputParam, false);
    cliCommand = cliJoin(cliCommand, "--" + cliParam + "=" + val);
    return cliCommand
}

function checkCliVersion(cliPath) {
    let cliCommand = cliJoin(cliPath, "--version");
    try {
        let res = execSync(cliCommand);
        let detectedVersion = String.fromCharCode.apply(null, res).split(' ')[2].trim();
        if (detectedVersion === jfrogCliVersion) {
            console.log("JFrog CLI version: " + detectedVersion);
        } else {
            console.warn("Expected to find version " + jfrogCliVersion + " of JFrog CLI at " + cliPath + ". Found version " + detectedVersion + " instead.");
        }
    } catch (ex) {
        console.error("Failed to get JFrog CLI version: " + ex);
    }
}

function runCbk(cliPath) {
    console.log("Running jfrog-cli from " + cliPath + ".");
    checkCliVersion(cliPath);
    runTaskCbk(cliPath)
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        fs.mkdirSync(jfrogFolderPath);
    }
}

function downloadCli() {
    return new Promise((resolve, reject) => {
        toolLib.downloadTool(jfrogCliDownloadUrl).then((downloadPath) => {
            toolLib.cacheFile(downloadPath, fileName, toolName, jfrogCliVersion).then((cliDir) => {
                let cliPath = path.join(cliDir, fileName);
                if (!isWindows()) {
                    fs.chmodSync(cliPath, 0o555);
                }
                tl.debug("Finished downloading JFrog cli.");
                resolve(cliPath);
            })
        }).catch((err) => {
            reject(err);
        });
    });
}

function getArchitecture() {
    let platform = process.platform;
    if (platform.startsWith("win")) {
        return "windows-amd64"
    }
    if (platform.includes("darwin")) {
        return "mac-386"
    }
    if (process.arch.includes("64")) {
        return "linux-amd64"
    }
    return "linux-386"
}

function getCliExecutableName() {
    let executable = "jfrog";
    if (isWindows()) {
        executable += ".exe"
    }
    return executable
}

/**
 * Escape single backslashes in a string.
 * / -> //
 * // -> //
 * @param string (String) - The string to escape
 * @returns (String) - The string after escaping
 */
function fixWindowsPaths(string) {
    return isWindows() ? string.replace(/([^\\])\\(?!\\)/g, '$1\\\\') : string;
}

function validateSpecWithoutRegex(fileSpec) {
    if (!isWindows()) {
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
 * Encodes spaces with quotes in a path.
 * a/b/Program Files/c --> a/b/"Program Files"/c
 * @param str (String) - The path to encoded.
 * @returns {string} - The encoded path.
 */
function encodePath(str) {
    let encodedPath = "";
    let arr = str.split(path.sep);
    let count = 0;
    for (let section of arr) {
        if (section.length === 0) {
            continue;
        }
        count++;
        if (section.indexOf(" ") > 0 && !section.startsWith("\"") && !section.endsWith("\"")) {
            section = quote(section);
        }
        encodedPath += section + path.sep;
    }
    if (count > 0 && !str.endsWith(path.sep)) {
        encodedPath = encodedPath.substring(0, encodedPath.length - 1);
    }
    if (str.startsWith(path.sep)) {
        encodedPath = path.sep + encodedPath;
    }

    return encodedPath;
}

/**
 * Runs collect environment variables JFrog CLI command if includeEnvVars is configured to true.
 * @param cliPath - (String) - The cli path.
 */
function collectEnvVarsIfNeeded(cliPath) {
    let includeEnvVars = tl.getBoolInput("includeEnvVars");
    if (includeEnvVars) {
        let taskRes = collectEnvVars(cliPath);
        if (taskRes) {
            tl.setResult(tl.TaskResult.Failed, taskRes);
        }
    }
}

/**
 * Runs collect environment variables JFrog CLI command.
 * @param cliPath - (String) - The cli path.
 * @returns (String|void) - String with error message or void if passes successfully.
 */
function collectEnvVars(cliPath) {
    console.log("Collecting environment variables...");
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    let cliEnvVarsCommand = cliJoin(cliPath, "rt bce", quote(buildDefinition), quote(buildNumber));
    return executeCliCommand(cliEnvVarsCommand, workDir);
}

function isWindows() {
    return process.platform.startsWith("win");
}

function isToolExists(toolName) {
    return !!tl.which(toolName, false);
}
