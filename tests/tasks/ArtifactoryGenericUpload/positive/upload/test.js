const testUtils = require('../../../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const TEST_DIR = path.join(testUtils.testDataDir, TEST_NAME, "/");

uploadByTask();
downloadByCli();

function uploadByTask() {
    let uploadPattern = path.join(__dirname, "files", "/", "a.in");
    let testMain = path.join(__dirname, "..", "..", "..", "..", "..", "ArtifactoryGenericUpload", "uploadArtifacts.js");
    let variables = {};

    let inputs = {
        "fileSpec": JSON.stringify({
            files: [{
                pattern: uploadPattern,
                target: testUtils.repoKey1
            }]
        }),
        "failNoOp": true
    };

    testUtils.runTask(testMain, variables, inputs);
}

function downloadByCli() {
    let downloadPath = testUtils.repoKey1 + "/a.in";
    let downloadCommand = "rt dl " + downloadPath + " " + TEST_DIR;
    testUtils.execCli(downloadCommand);
}
