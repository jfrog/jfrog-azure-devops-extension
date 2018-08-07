const testUtils = require('../../../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const TEST_DIR = path.join(testUtils.testDataDir, TEST_NAME, "/");

uploadByCli();
downloadByTask();

function uploadByCli() {
    let uploadPattern = path.join(__dirname, "files", "/");
    let uploadCommand = "rt u " + uploadPattern + " " + testUtils.repoKey1 + "/";
    testUtils.execCli(uploadCommand);
}

function downloadByTask() {
    let testMain = path.join(__dirname, "..", "..", "..", "..", "..", "ArtifactoryGenericDownload", "downloadArtifacts.js");
    let variables = {};

    let inputs = {
        "fileSpec": JSON.stringify({
            files: [{
                pattern: testUtils.repoKey1 + '/a.in',
                target: TEST_DIR
            }]
        }),
        "failNoOp": true
    };

    testUtils.runTask(testMain, variables, inputs);
}
