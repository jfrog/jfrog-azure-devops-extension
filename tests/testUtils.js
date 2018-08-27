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
    npmLocalRepoKey: "vsts-npm-local-test",
    npmRemoteRepoKey: "vsts-npm-remote-test",
    npmVirtualRepoKey: "vsts-npm-virtual-test",
    testDataDir: testDataDir,
    promote: path.join(__dirname, "..", "ArtifactoryPromote", "artifactoryPromote.js"),
    download: path.join(__dirname, "..", "ArtifactoryGenericDownload", "downloadArtifacts.js"),
    upload: path.join(__dirname, "..", "ArtifactoryGenericUpload", "uploadArtifacts.js"),
    publish: path.join(__dirname, "..", "ArtifactoryPublishBuildInfo", "publishBuildInfo.js"),
    npm: path.join(__dirname, "..", "ArtifactoryNpm", "npmBuild.js"),

    initTests: initTests,
    runTask: runTask,
    getTestName: getTestName,
    getTestLocalFilesDir: getTestLocalFilesDir,
    getLocalTestDir: getLocalTestDir,
    getRemoteTestDir: getRemoteTestDir,
    isBuildExist: isBuildExist,
    deleteBuild: deleteBuild,
    cleanUpAllTests: cleanUpAllTests,
    copyTestFilesToTestWorkDir: copyTestFilesToTestWorkDir,
    cleanUpBetweenTests: cleanUpBetweenTests
};

function initTests() {
    process.env.JFROG_CLI_OFFER_CONFIG = false;
    tl.setVariable("Agent.WorkFolder", "");
    createTestRepositories();
    cleanUpRepositories();
    recreateTestDataDir();
}

function runTask(testMain, variables, inputs) {
    variables["Agent.WorkFolder"] = testDataDir;
    variables["System.DefaultWorkingDirectory"] = testDataDir;

    let tmr = new tmrm.TaskMockRunner(testMain);

    setVariables(variables);
    setArtifactoryCredentials();
    setInputs(inputs);

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

function recreateTestDataDir() {
    if (fs.existsSync(testDataDir)) {
        rmdir.sync(testDataDir);
    }
    fs.mkdirSync(testDataDir);
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

function cleanUpAllTests() {
    if (fs.existsSync(testDataDir)) {
        rmdir.sync(testDataDir);
    }
    deleteRepositories();
}

function createTestRepositories() {
    createRepo(module.exports.repoKey1, JSON.stringify({rclass: "local", packageType: "generic"}));
    createRepo(module.exports.repoKey2, JSON.stringify({rclass: "local", packageType: "generic"}));
    createRepo(module.exports.npmLocalRepoKey, JSON.stringify({rclass: "local", packageType: "npm"}));
    createRepo(module.exports.npmRemoteRepoKey, JSON.stringify({rclass: "remote", packageType: "npm", url: "https://registry.npmjs.org"}));
    createRepo(module.exports.npmVirtualRepoKey, JSON.stringify({rclass: "virtual", packageType: "npm", repositories: ["vsts-npm-local-test", "vsts-npm-remote-test"]}));
}

function deleteRepositories() {
    deleteRepo(module.exports.repoKey1);
    deleteRepo(module.exports.repoKey2);
    deleteRepo(module.exports.npmVirtualRepoKey);
    deleteRepo(module.exports.npmLocalRepoKey);
    deleteRepo(module.exports.npmRemoteRepoKey);
}

function createRepo(repoKey, body) {
    syncRequest('PUT', artifactoryUrl + "/api/repositories/" + repoKey, {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64"),
            "Content-Type": "application/json"
        },
        body: body
    });
}

function deleteRepo(repoKey) {
    syncRequest('DELETE', artifactoryUrl + "/api/repositories/" + repoKey, {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64"),
            "Content-Type": "application/json"
        }
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

/**
 * Returns an array of files contained in folderToCopy
 */
function getResourcesFiles(folderToCopy) {
    let dir = path.join(__dirname, "resources", folderToCopy);
    let files = fs.readdirSync(dir);
    let fullFilesPath = [];
    for (let i = 0; i < files.length; i++) {
        fullFilesPath.push(path.join(dir, files[i]))
    }
    return fullFilesPath;
}

/**
 * Copies all files exists in "tests/<testDirName>/<folderToCopy>" to a corresponding folder under "testDataDir/<testDirName>"
 * @param testDirName - test directory
 * @param folderToCopy - the folder to copy from the test
 */
function copyTestFilesToTestWorkDir(testDirName, folderToCopy) {
    let files = getResourcesFiles(path.join(testDirName, folderToCopy));

    if (!fs.existsSync(path.join(testDataDir, testDirName))) {
        fs.mkdirSync(path.join(testDataDir, testDirName));
    }

    for (let i = 0; i < files.length; i++) {
        fs.copyFileSync(files[i], path.join(getLocalTestDir(testDirName), path.basename(files[i])));
    }
}

function setVariables(variables) {
    for (let [key, value] of Object.entries(variables)) {
        tl.setVariable(key, value);
    }
}

function setInputs(inputs) {
    tl.getInput = tl.getBoolInput = (name, required) => {
        return inputs[name];
    };
}

function cleanUpBetweenTests() {
    recreateTestDataDir();
    cleanUpRepositories();
}

function cleanUpRepositories() {
    execCli("rt del " + module.exports.repoKey1 + '/*' + " --quiet");
    execCli("rt del " + module.exports.repoKey2 + '/*' + " --quiet");
    execCli("rt del " + module.exports.npmLocalRepoKey + '/*' + " --quiet");
    execCli("rt del " + module.exports.npmRemoteRepoKey + '/*' + " --quiet");
    execCli("rt del " + module.exports.npmVirtualRepoKey + '/*' + " --quiet");
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
