const testUtils = require('../../../../testUtils');
const path = require('path');

uploadByTask();

function uploadByTask() {
    let uploadPattern = path.join(__dirname, "files", "a.in");
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
