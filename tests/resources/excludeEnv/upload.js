const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "excludeEnv",
    "Build.BuildNumber": "3",
    "Build.password": "open-sesame",
    "Build.undefined": "undefined",
    "Build.null": "null"
};
let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getTestLocalFilesDir(__dirname),
            target: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME)
        }]
    }),
    "failNoOp": true,
    "includeEnvVars": true,
    "collectBuildInfo": true
};

testUtils.runTask(testUtils.upload, variables, inputs);