const tmrm = require('vsts-task-lib/mock-run');
const tl = require('vsts-task-lib/task');
const path = require('path');
const fs = require('fs');
const rmdir = require('rmdir-recursive');
const execSync = require('child_process').execSync;
const syncRequest = require('sync-request');

const testDataDir = path.join(__dirname, "testData");
let artifactoryUrl = process.env.VSTS_ARTIFACTORY_URL;
let artifactoryUsername = process.env.VSTS_ARTIFACTORY_USERNAME;
let artifactoryPassword = process.env.VSTS_ARTIFACTORY_PASSWORD;

module.exports = {
    repoKey1: "vsts-extension-test-repo1",
    repoKey2: "vsts-extension-test-repo2",
    testDataDir: testDataDir,
    promote: path.join(__dirname, "..", "ArtifactoryPromote", "artifactoryPromote.js"),
    download: path.join(__dirname, "..", "ArtifactoryGenericDownload", "downloadArtifacts.js"),
    upload: path.join(__dirname, "..", "ArtifactoryGenericUpload", "uploadArtifacts.js"),
    publish: path.join(__dirname, "..", "ArtifactoryPublishBuildInfo", "publishBuildInfo.js"),

    initTests: initTests,
    runTask: runTask,
    getTestName: getTestName,
    getTestLocalFilesDir: getTestLocalFilesDir,
    getLocalTestDir: getLocalTestDir,
    getRemoteTestDir: getRemoteTestDir,
    isBuildExist: isBuildExist,
    deleteBuild: deleteBuild,
    cleanUpTests: cleanUpTests,
    execCli: execCli
};

function initTests() {
    process.env.JFROG_CLI_OFFER_CONFIG = false;
    tl.setVariable("Agent.WorkFolder", "");
    createTestRepositories();
    cleanUpTests();
    fs.mkdirSync(testDataDir);
}

function runTask(testMain, variables, inputs) {
    variables["Agent.WorkFolder"] = testDataDir;
    variables["System.DefaultWorkingDirectory"] = testDataDir;

    let tmr = new tmrm.TaskMockRunner(testMain);

    setVariables(variables);
    setArtifactoryCredentials();
    mockGetInputs(inputs);

    tmr.registerMock('vsts-task-lib/mock-task', tl);
    tmr.run();
}

function execCli(command) {
    command = command.replace(/\\/g, "\\\\");
    try {
        execSync("jfrog " + command + " --url=" + artifactoryUrl + " --user=" + artifactoryUsername + " --password=" + artifactoryPassword);
    } catch (ex) {
        console.error("Command failed", "jfrog " + command);
    }
}

function isBuildExist(buildName, buildNumber) {
    let res = syncRequest('GET', artifactoryUrl + "/api/build/" + buildName + "/" + buildNumber, {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64")
        }
    });
    return res.statusCode === 200;
}

function deleteBuild(buildName) {
    syncRequest('DELETE', artifactoryUrl + "/api/build/" + buildName + "?deleteAll=1", {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64")
        }
    });
}

function cleanUpTests() {
    if (fs.existsSync(testDataDir)) {
        rmdir.sync(testDataDir);
    }
    cleanUpRepositories();
}

function createTestRepositories() {
    createRepo(module.exports.repoKey1);
    createRepo(module.exports.repoKey2);
}

function createRepo(repoKey) {
    syncRequest('PUT', artifactoryUrl + "/api/repositories/" + repoKey, {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64"),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            rclass: "local"
        })
    });
}

function setArtifactoryCredentials() {
    tl.getEndpointUrl = () => {
        return artifactoryUrl;
    };
    tl.getEndpointAuthorizationParameter = (id, key, optional) => {
        if (key === "username") {
            return artifactoryUsername;
        }
        return artifactoryPassword;
    };
}

function setVariables(variables) {
    for (let [key, value] of Object.entries(variables)) {
        tl.setVariable(key, value);
    }
}

/**
 * Override tl.getInput(), tl.getBoolInput() and tl.getPathInput() functions.
 * The test will return inputs[name] instead of using the original functions.
 * @param inputs - (String) - Test inputs
 */
function mockGetInputs(inputs) {
    tl.getInput = tl.getBoolInput = tl.getPathInput = (name, required) => {
        return inputs[name];
    };
}

function cleanUpRepositories() {
    execCli("rt del " + module.exports.repoKey1 + '/*' + " --quiet");
    execCli("rt del " + module.exports.repoKey2 + '/*' + " --quiet");
}

function getTestName(testDir) {
    return path.basename(testDir);
}

function getLocalTestDir(testName) {
    return path.join(testDataDir, testName, "/");
}

function getTestLocalFilesDir(testDir) {
    return path.join(testDir, "files", "/")
}

function getRemoteTestDir(repo, testName) {
    return repo + "/" + testName + "/"
}
