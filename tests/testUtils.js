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
    createTestDataDir: createTestDataDir,
    runTask: runTask,
    repoKey1: "vsts-extension-test-repo1",
    repoKey2: "vsts-extension-test-repo2",
    testDataDir: testDataDir,
    execCli: execCli,
    cleanUp: cleanUp,
    deleteBuild: deleteBuild
};

function runTask(testMain, variables, inputs) {
    variables["Agent.WorkFolder"] = testDataDir;
    variables["Agent.BuildDirectory"] = testDataDir;

    let tmr = new tmrm.TaskMockRunner(testMain);

    setVariables(variables);
    setArtifactoryCredentials();
    setInputs(inputs);

    tmr.registerMock('vsts-task-lib/mock-task', tl);
    tmr.run();
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

function setInputs(inputs) {
    tl.getInput = tl.getBoolInput = (name, required) => {
        return inputs[name];
    };
}

function execCli(command) {
    command = command.replace(/\\/g, "\\\\");
    execSync("jfrog " + command + " --url=" + artifactoryUrl + " --user=" + artifactoryUsername + " --password=" + artifactoryPassword);
}

function createTestDataDir() {
    fs.mkdirSync(testDataDir);
}

function cleanUpRepositories() {
    execCli("rt del " + module.exports.repoKey1 + '/*' + " --quiet");
    execCli("rt del " + module.exports.repoKey2 + '/*' + " --quiet");
}

function cleanUp() {
    if (fs.existsSync(testDataDir)) {
        rmdir.sync(testDataDir);
    }
    cleanUpRepositories();
}

function deleteBuild(buildName) {
    syncRequest('DELETE', artifactoryUrl + "/api/build/" + buildName + "?deleteAll=1", {
        headers: {
            "Authorization": "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64")
        }
    });
}