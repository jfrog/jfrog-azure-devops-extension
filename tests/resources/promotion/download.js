const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "buildName": "buildPromote",
    "buildNumber": "3",
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.repoKey2, TEST_NAME),
            target: testUtils.getLocalTestDir(TEST_NAME),
            flat: "true"
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": true,
    "specSource": "taskConfiguration"
};

testUtils.runTask(testUtils.download, {}, inputs);
