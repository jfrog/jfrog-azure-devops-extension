const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME) + 'b.in'
        }]
    }),
    "specSource": "taskConfiguration",
    "command": "delete",
    "deleteProps": "propKey1"
};

testUtils.runTask(testUtils.properties, {}, inputs);