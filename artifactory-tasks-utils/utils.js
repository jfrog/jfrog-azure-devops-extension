const os = require('os');
const fs = require('fs-extra');
const tl = require('vsts-task-lib/task');
const crypto = require('crypto');
const path = require('path');
const request = require('request-promise-lite');
const execSync = require('child_process').execSync;

const fileName = getCliExecutableName();
const btPackage = "jfrog-cli-" + getArchitecture();
const jfrogFolderPath = encodePath(path.join(tl.getVariable("Agent.WorkFolder"), "_jfrog"));
const jfrogCliVersion = "1.17.1";
const versionedCliPath = encodePath(path.join(jfrogFolderPath, jfrogCliVersion, fileName)); // Path that depends on jfrog-cli version. The default behaviour.
const customCliPath = encodePath(path.join(jfrogFolderPath, "current", fileName)); // Optional - Customized jfrog-cli path.
const jfrogCliDownloadUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/' + jfrogCliVersion + '/' + btPackage + '/' + fileName + "?bt_package=" + btPackage;
const MAX_CLI_DOWNLOADS_RETRIES = 10;
const jfrogCliDownloadErrorMessage = "Failed while attempting to download JFrog CLI from " + jfrogCliDownloadUrl +
    ". If this build agent cannot access the internet, you can manually download version " + jfrogCliVersion +
    " of JFrog CLI and place it on the agent in the following path: " + customCliPath;

let runTaskCbk = null;

module.exports = {
    executeCliTask: executeCliTask,
    executeCliCommand: executeCliCommand,
    cliJoin: cliJoin,
    quote: quote,
    addArtifactoryCredentials: addArtifactoryCredentials,
    addStringParam: addStringParam,
    addBoolParam: addBoolParam,
    fixWindowsPaths: fixWindowsPaths,
    encodePath: encodePath,
    getArchitecture: getArchitecture
};

function executeCliTask(runTaskFunc) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = false;

    runTaskCbk = runTaskFunc;
    if (fs.existsSync(customCliPath)) {
        runCbk(customCliPath);
    } else if (fs.existsSync(versionedCliPath)) {
        runCbk(versionedCliPath);
    } else {
        createCliDirs();
        downloadCli(0).then(() => {
            runCbk(versionedCliPath);
        });
    }
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

    if (!fs.existsSync(path.join(jfrogFolderPath, jfrogCliVersion))) {
        fs.mkdirSync(path.join(jfrogFolderPath, jfrogCliVersion));
    }
}

function downloadCli(attemptNumber) {
    return new Promise((resolve, reject) => {
        let handleError = (err) => {
            if (attemptNumber <= MAX_CLI_DOWNLOADS_RETRIES) {
                console.log("Attempt #" + attemptNumber + " to download jfrog-cli failed with message:\n" + err + "\nRetrying download.");
                downloadCli(++attemptNumber);
            } else {
                console.error(jfrogCliDownloadErrorMessage);
                reject(err);
            }
        };

        const cliTmpPath = encodePath(versionedCliPath + ".tmp");

        // Perform download
        request.get(jfrogCliDownloadUrl, {json: false, resolveWithFullResponse: true}).then((response) => {
            // Check valid response
            if (response.statusCode < 200 || response.statusCode >= 300) {
                handleError("Received http response code " + response.statusCode);
            }

            // Write body to file
            fs.writeFileSync(cliTmpPath, response.body);

            // Validate checksum
            let stream = fs.createReadStream(cliTmpPath);
            let digest = crypto.createHash('sha256');

            stream.on('data', function (data) {
                digest.update(data, 'utf8')
            });

            stream.on('end', function () {
                let hex = digest.digest('hex');
                let rawChecksum = response.headers['x-checksum-sha256'];
                if (!rawChecksum) {
                    handleError("Checksum header is missing from http response, cannot validate downloaded jfrog cli.");
                }

                let trimmedChecksum = rawChecksum.split(',')[0];
                if (hex === trimmedChecksum) {
                    fs.move(cliTmpPath, versionedCliPath).then(() => {
                        if (!process.platform.startsWith("win")) {
                            fs.chmodSync(versionedCliPath, 0o555);
                        }
                        console.log("Finished downloading jfrog cli.");
                        resolve();
                    });
                } else {
                    handleError("Checksum mismatch for downloaded jfrog cli.");
                }
            });
        }).catch((err) => {
            console.error(jfrogCliDownloadErrorMessage);
            tl.setResult(tl.TaskResult.Failed, err.message);
        })
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
    if (process.platform.startsWith("win")) {
        executable += ".exe"
    }
    return executable
}

/**
 * Escape single backslashes in fileSpec.
 * / -> //
 * // -> //
 * @param fileSpec (String) - The file spec to escape
 * @returns fileSpec (String) - The file spec after escaping
 */
function fixWindowsPaths(fileSpec) {
    if (os.type() === "Windows_NT") {
        fileSpec = fileSpec.replace(/([^\\])\\(?!\\)/g, '$1\\\\');
        validateSpecWithoutRegex(fileSpec);
        return fileSpec
    }
    return fileSpec;
}

function validateSpecWithoutRegex(fileSpec) {
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