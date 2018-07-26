const fs = require('fs');
const tl = require('vsts-task-lib/task');
const checksumStream = require('checksum-stream');
const path = require('path');
const requestPromise = require('request-promise');

const fileName = getFileName();
const btPackage = "jfrog-cli-" + getArchitecture();
const folderPath = path.join(tl.getVariable("Agent.WorkFolder"), "_jfrog");
const version = "1.17.1";
const cliPath = path.join(folderPath, version, fileName);
const cliTmpPath = cliPath + ".tmp";
const cliUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/' + version + '/' + btPackage + '/' + fileName + "?bt_package=" + btPackage;
const MAX_RETRIES = 10;

let runTaskCbk = null;

module.exports = {
    executeCliTask: executeCliTask,
    cliJoin: cliJoin,
    quote: quote,
    addArtifactoryCredentials: addArtifactoryCredentials
};

function executeCliTask (runTaskFunc) {
    process.env.JFROG_CLI_HOME = path.join(folderPath, version);
    process.env.JFROG_CLI_OFFER_CONFIG = false;

    runTaskCbk = runTaskFunc;
    if (!fs.existsSync(cliPath)) {
        createCliDirs();
        downloadCli().then(runCbk)
    } else {
        console.log("JFrog CLI  " + version + " exists locally.");
        runCbk();
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

function runCbk() {
    if (runTaskCbk != null) {
        runTaskCbk(cliPath);
    }
}

function createCliDirs() {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    if (!fs.existsSync(path.join(folderPath, version))) {
        fs.mkdirSync(path.join(folderPath, version));
    }
}

function downloadCli(attemptNumber) {
    return new Promise((resolve, reject) => {
        function handleError(err) {
            if (attemptNumber <= MAX_RETRIES) {
                console.log("Attempt #" + attemptNumber + " to download jfrog-cli failed, trying again.");
                downloadCli(++attemptNumber);
            } else {
                reject(err);
            }
        }

        let req = requestPromise.get(cliUrl);
        req.on('response', (res) => {
            res.pipe(
                checksumStream({
                    algorithm: 'sha256',
                    digest: res.headers['X-Checksum-Sha256'],
                    size: res.headers['content-length']
                }).on('error', handleError)
                    .on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            fs.rename(cliTmpPath, cliPath, () => {
                                if (!process.platform.startsWith("win")) {
                                    fs.chmodSync(cliPath, 0o555)
                                }
                                console.log("Finished downloading jfrog cli");
                                resolve();
                            });
                        }
                    })
            ).pipe(
                fs.createWriteStream(cliTmpPath)
            )
        }).catch(handleError)
    }).catch((err) => {
        tl.setResult(tl.TaskResult.Failed, err.message);
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

function getFileName() {
    let executable = "jfrog";
    if (process.platform.startsWith("win")) {
        executable += ".exe"
    }
    return executable
}