const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "buildPromoteDryRun",
    "Build.BuildNumber": "3"
};
let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getTestLocalFilesDir(__dirname),
            target: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME)
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": true
};

testUtils.runTask(testUtils.upload, variables, inputs);