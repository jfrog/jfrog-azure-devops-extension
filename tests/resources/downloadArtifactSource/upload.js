const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "downloadArtifactSource",
    "Build.BuildNumber": "5"
};
let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getTestLocalFilesDir(__dirname),
            target: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME)
        }]
    }),
    "failNoOp": true,
    "collectBuildInfo": true
};

testUtils.runTask(testUtils.upload, variables, inputs);