const testUtils = require('../../../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const TEST_DIR = path.join(testUtils.testDataDir, TEST_NAME, "/");

downloadByTask();

function downloadByTask() {
    let testMain = path.join(__dirname, "..", "..", "..", "..", "..", "ArtifactoryGenericDownload", "downloadArtifacts.js");
    let variables = {};

    let inputs = {
        "fileSpec": JSON.stringify({
            files: [{
                pattern: testUtils.repoKey1 + '/should_not_exists',
                target: TEST_DIR
            }]
        }),
        "failNoOp": true
    };

    testUtils.runTask(testMain, variables, inputs);
}
