const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    "buildName": "buildPublish",
    "buildNumber": "3",
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME),
            target: testUtils.getLocalTestDir(TEST_NAME),
            flat: "true"
        }]
    }),
    "failNoOp": true,
    "specSource": "taskConfiguration"
};

testUtils.runTask(testUtils.download, {}, inputs);
