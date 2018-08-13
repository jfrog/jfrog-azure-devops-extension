const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "buildPromote",
    "Build.BuildNumber": "3"
};
let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.repoKey2, TEST_NAME),
            target: testUtils.getLocalTestDir(TEST_NAME),
            flat: "true"
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": true
};

testUtils.runTask(testUtils.download, variables, inputs);
