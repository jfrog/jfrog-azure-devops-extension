const fs = require('fs-extra');
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const execSync = require('child_process').execSync;
const toolLib = require('azure-pipelines-tool-lib/tool');
const clientHandlers = require('typed-rest-client/Handlers');
const localTools = require('./tools');

const fileName = getCliExecutableName();
const toolName = "jfrog";
const btPackage = "jfrog-cli-" + getArchitecture();
const jfrogFolderPath = encodePath(path.join(tl.getVariable("Agent.WorkFolder"), "_jfrog"));
const jfrogCliVersion = "1.26.2";
const customCliPath = encodePath(path.join(jfrogFolderPath, "current", fileName)); // Optional - Customized jfrog-cli path.
const jfrogCliBintrayDownloadUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/' + jfrogCliVersion + '/' + btPackage + '/' + fileName + "?bt_package=" + btPackage;

let cliConfigCommand = "rt c";
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
    isToolExists: isToolExists,
    buildCliArtifactoryDownloadUrl: buildCliArtifactoryDownloadUrl,
    createAuthHandlers: createAuthHandlers,
    configureCliServer: configureCliServer,
    deleteCliServers: deleteCliServers,
    setResultFailedIfError: setResultFailedIfError,
    stripTrailingSlash: stripTrailingSlash
};

// Url and AuthHandlers are optional. Using jfrogCliBintrayDownloadUrl by default.
function executeCliTask(runTaskFunc, cliDownloadUrl, cliAuthHandlers) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = false;
    process.env.JFROG_CLI_REPORT_USAGE = false;
    // If unspecified, use the default cliDownloadUrl of Bintray.
    if (!cliDownloadUrl) {
        cliDownloadUrl = jfrogCliBintrayDownloadUrl;
        cliAuthHandlers = [];
    }

    runTaskCbk = runTaskFunc;
    getCliPath(cliDownloadUrl, cliAuthHandlers).then((cliPath) => {
        runCbk(cliPath);
        collectEnvVarsIfNeeded(cliPath);
    }).catch((error) => tl.setResult(tl.TaskResult.Failed, "Error occurred while executing task:\n" + error))
}

// Url and AuthHandlers are optional. Using jfrogCliBintrayDownloadUrl by default.
function getCliPath(cliDownloadUrl, cliAuthHandlers) {
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
                const errMsg = generateDownloadCliErrorMessage(cliDownloadUrl);
                createCliDirs();
                return downloadCli(cliDownloadUrl, cliAuthHandlers)
                    .then((cliPath) => resolve(cliPath))
                    .catch((error) => reject(errMsg + "\n" + error));
            }
        }
    );
}

function buildCliArtifactoryDownloadUrl(rtUrl, repoName) {
    if (rtUrl.slice(-1) !== '/') {
        rtUrl += '/';
    }
    return rtUrl + repoName + '/' + jfrogCliVersion + '/' + btPackage + '/' + fileName;
}

function createAuthHandlers(artifactoryService) {
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);
    // Check if Artifactory should be accessed anonymously.
    if (artifactoryUser === "") {
        return [];
    }
    return [new clientHandlers.BasicCredentialHandler(artifactoryUser, artifactoryPassword)];
}

function generateDownloadCliErrorMessage(downloadUrl) {
    let errMsg = "Failed while attempting to download JFrog CLI from " + downloadUrl + ". ";
    if (downloadUrl === jfrogCliBintrayDownloadUrl) {
        errMsg += "If this build agent cannot access the internet, you may use the 'Artifactory Tools Installer' task, to download JFrog CLI through an Artifactory repository, which proxies " + jfrogCliBintrayDownloadUrl + ". You ";
    } else {
        errMsg += "If the chosen Artifactory Service cannot access the internet, you ";
    }
    errMsg += "may also manually download version " + jfrogCliVersion + " of JFrog CLI and place it on the agent in the following path: " + customCliPath;
    return errMsg;
}

function executeCliCommand(cliCommand, runningDir, stdio) {
    if (!fs.existsSync(runningDir)) {
        return "JFrog CLI execution path doesn't exist: " + runningDir;
    }
    try {
        if (!stdio) {
            stdio = [0, 1, 2];
        }
        execSync(cliCommand, { cwd: runningDir, stdio: stdio });
    } catch (ex) {
        // Error occurred
        return ex.toString().replace(/--password=".*"/g, "--password=***");
    }
}

// Configuring a server in the cli config
function configureCliServer(artifactory, serverId, cliPath, buildDir) {
    let artifactoryUrl = tl.getEndpointUrl(artifactory);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactory, "username");
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactory, "password");

    let cliCommand = cliJoin(cliPath, cliConfigCommand, "--url=" + quote(artifactoryUrl), "--user=" + quote(artifactoryUser), "--password=" + quote(artifactoryPassword), "--interactive=false", quote(serverId));
    let taskRes = executeCliCommand(cliCommand, buildDir);
    if (taskRes) {
        return taskRes;
    }
}

// Removing the servers from the cli config
function deleteCliServers(cliPath, buildDir, serverIdArray) {
    let deleteServerIDCommand;
    let taskRes;
    for (let i = 0, len = serverIdArray.length; i < len; i++) {
        deleteServerIDCommand = cliJoin(cliPath, cliConfigCommand, "delete", quote(serverIdArray[i]), "--interactive=false");
        taskRes = executeCliCommand(deleteServerIDCommand, buildDir);
        if (taskRes) {
            return taskRes;
        }
    }
    return taskRes;
}

// Does not stop the task. If set to 'Failed', calls of setting to 'Succeeded' are ignored.
function setResultFailedIfError(taskRes, customMsg) {
    if (taskRes) {
        if (customMsg) {
            tl.setResult(tl.TaskResult.Failed, customMsg);
        } else {
            tl.setResult(tl.TaskResult.Failed, taskRes);
        }
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
    // Check if Artifactory should be accessed anonymously.
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

function logCliVersion(cliPath) {
    let cliCommand = cliJoin(cliPath, "--version");
    try {
        let res = execSync(cliCommand);
        let detectedVersion = String.fromCharCode.apply(null, res).split(' ')[2].trim();
        console.log("JFrog CLI version: " + detectedVersion);
    } catch (ex) {
        console.error("Failed to get JFrog CLI version: " + ex);
    }
}

function runCbk(cliPath) {
    console.log("Running jfrog-cli from " + cliPath + ".");
    logCliVersion(cliPath);
    runTaskCbk(cliPath)
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        fs.mkdirSync(jfrogFolderPath);
    }
}

// Url and AuthHandlers are optional. Using jfrogCliBintrayDownloadUrl by default.
function downloadCli(cliDownloadUrl, cliAuthHandlers) {
    // If unspecified, use the default cliDownloadUrl of Bintray.
    if (!cliDownloadUrl) {
        cliDownloadUrl = jfrogCliBintrayDownloadUrl;
        cliAuthHandlers = [];
    }
    return new Promise((resolve, reject) => {
        localTools.downloadTool(cliDownloadUrl, null, cliAuthHandlers).then((downloadPath) => {
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
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    let cliEnvVarsCommand = cliJoin(cliPath, "rt bce", quote(buildName), quote(buildNumber));
    return executeCliCommand(cliEnvVarsCommand, workDir);
}

function isWindows() {
    return process.platform.startsWith("win");
}

function isToolExists(toolName) {
    return !!tl.which(toolName, false);
}

const stripTrailingSlash = (str) => {
    return str.endsWith('/') ?
        str.slice(0, -1) :
        str;
};
