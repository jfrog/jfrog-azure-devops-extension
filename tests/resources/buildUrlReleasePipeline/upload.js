const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "buildUrlReleasePipeline",
    "Build.BuildNumber": "3"
};
let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: "*.nothing",
            target: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME)
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": false
};

testUtils.runTask(testUtils.upload, variables, inputs);