const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let variables = {
    "Build.DefinitionName": "buildPublish",
    "Build.BuildNumber": "3"
};
let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME),
            target: testUtils.getLocalTestDir(TEST_NAME),
            flat: "true"
        }]
    }),
    "failNoOp": true
};

testUtils.runTask(testUtils.download, variables, inputs);
