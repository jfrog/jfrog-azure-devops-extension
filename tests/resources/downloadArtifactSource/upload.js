const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "buildName": "downloadArtifactSource",
    "buildNumber": "5",
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getTestLocalFilesDir(__dirname),
            target: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME)
        }]
    }),
    "failNoOp": true,
    "collectBuildInfo": true,
    "specSource": "taskConfiguration"
};

testUtils.runTask(testUtils.upload, {}, inputs);