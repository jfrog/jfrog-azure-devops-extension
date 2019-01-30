const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "buildName": "buildPromoteDryRun",
    "buildNumber": "3",
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME),
            target: testUtils.getLocalTestDir(TEST_NAME),
            flat: "true"
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": true
};

testUtils.runTask(testUtils.download, {}, inputs);
