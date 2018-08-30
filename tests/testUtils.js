const tmrm = require('vsts-task-lib/mock-run');
const tl = require('vsts-task-lib/task');
const path = require('path');
const fs = require('fs');
const rmdir = require('rmdir-recursive');
const execSync = require('child_process').execSync;
const syncRequest = require('sync-request');
const testsDir = path.join(__dirname);
const testDataDir = path.join(__dirname, "testData");
let artifactoryUrl = process.env.VSTS_ARTIFACTORY_URL;
let artifactoryUsername = process.env.VSTS_ARTIFACTORY_USERNAME;
let artifactoryPassword = process.env.VSTS_ARTIFACTORY_PASSWORD;

module.exports = {
    repoKey1: "vsts-extension-test-repo1",
    repoKey2: "vsts-extension-test-repo2",
    remoteMaven: "vsts-extension-test-maven-remote",
    localMaven: "vsts-extension-test-maven-local",
    virtualNuget: "vsts-extension-test-nuget-virtual",
    remoteNuGet: "vsts-extension-test-nuget-remote",
    localNuGet: "vsts-extension-test-nuget-local",
    npmLocalRepoKey: "vsts-npm-local-test",
    npmRemoteRepoKey: "vsts-npm-remote-test",
    npmVirtualRepoKey: "vsts-npm-virtual-test",
    testDataDir: testDataDir,
    testsDir: testsDir,
    promote: path.join(__dirname, "..", "tasks", "ArtifactoryBuildPromotion", "buildPromotion.js"),
    download: path.join(__dirname, "..", "tasks", "ArtifactoryGenericDownload", "downloadArtifacts.js"),
    upload: path.join(__dirname, "..", "tasks", "ArtifactoryGenericUpload", "uploadArtifacts.js"),
    publish: path.join(__dirname, "..", "tasks", "ArtifactoryPublishBuildInfo", "publishBuildInfo.js"),
    npm: path.join(__dirname, "..", "tasks", "ArtifactoryNpm", "npmBuild.js"),
    maven: path.join(__dirname, "..", "tasks", "ArtifactoryMaven", "mavenBuild.js"),
    nuget: path.join(__dirname, "..", "tasks", "ArtifactoryNuget", "nugetBuild.js"),

    initTests: initTests,
    runTask: runTask,
    getTestName: getTestName,
    getTestLocalFilesDir: getTestLocalFilesDir,
    getLocalTestDir: getLocalTestDir,
    getRemoteTestDir: getRemoteTestDir,
    isRepoExists: isRepoExists,
    getBuild: getBuild,
    deleteBuild: deleteBuild,
    copyTestFilesToTestWorkDir: copyTestFilesToTestWorkDir,
    fixWinPath: fixWinPath,
    execCli: execCli,
    cleanUpAllTests: cleanUpAllTests,
    cleanUpBetweenTests: cleanUpBetweenTests
};

function initTests() {
    process.env.JFROG_CLI_OFFER_CONFIG = false;
    process.env.JFROG_CLI_LOG_LEVEL = "ERROR";
    tl.setVariable("Agent.WorkFolder", "");
    tl.setVariable("Agent.TempDirectory", "");
    tl.setVariable("Agent.ToolsDirectory", "");
    createTestRepositories();
    cleanUpRepositories();
    recreateTestDataDir();
}

function runTask(testMain, variables, inputs) {
    variables["Agent.WorkFolder"] = testDataDir;
    variables["Agent.TempDirectory"] = testDataDir;
    variables["Agent.ToolsDirectory"] = testDataDir;
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

function recreateTestDataDir() {
    if (fs.existsSync(testDataDir)) {
        rmdir.sync(testDataDir);
    }
    fs.mkdirSync(testDataDir);
}

function getBuild(buildName, buildNumber) {
    return syncRequest('GET', artifactoryUrl + "/api/build/" + buildName + "/" + buildNumber, {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64")
        }
    });
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
    createRepo(module.exports.localMaven, JSON.stringify({rclass: "local", packageType: "maven"}));
    createRepo(module.exports.remoteMaven, JSON.stringify({rclass: "remote", packageType: "nuget", url: "https://jcenter.bintray.com"}));
    createRepo(module.exports.localNuGet, JSON.stringify({rclass: "local", packageType: "nuget"}));
    createRepo(module.exports.virtualNuget, JSON.stringify({rclass: "virtual", packageType: "nuget", repositories: [module.exports.remoteNuGet, module.exports.localNuGet]}));
    createRepo(module.exports.npmLocalRepoKey, JSON.stringify({rclass: "local", packageType: "npm"}));
    createRepo(module.exports.npmRemoteRepoKey, JSON.stringify({rclass: "remote", packageType: "npm", url: "https://registry.npmjs.org"}));
    createRepo(module.exports.npmVirtualRepoKey, JSON.stringify({rclass: "virtual", packageType: "npm", repositories: ["vsts-npm-local-test", "vsts-npm-remote-test"]}));
}

function deleteRepositories() {
    deleteRepo(module.exports.repoKey1);
    deleteRepo(module.exports.repoKey2);
    deleteRepo(module.exports.localMaven);
    deleteRepo(module.exports.remoteMaven);
    deleteRepo(module.exports.localNuGet);
    deleteRepo(module.exports.virtualNuget);
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
    execCli("rt del " + module.exports.remoteMaven + '/*' + " --quiet");
    execCli("rt del " + module.exports.remoteNuGet + '/*' + " --quiet");
    execCli("rt del " + module.exports.localNuGet + '/*' + " --quiet");
    execCli("rt del " + module.exports.localMaven + '/*' + " --quiet");
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

function isRepoExists(repoName) {
    let res = syncRequest('GET', artifactoryUrl + "/api/repositories/" + repoName, {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64")
        }
    });
    return res.statusCode === 200;
}

function fixWinPath(path) {
    if (process.platform === "win32") {
        return path.replace(/(\\)/g, "\\\\")
    }
}