const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
        }]
    }),
    "specSource": "taskConfiguration",
    "command": "set",
    "setProps": "propKey1=propVal1;propKey2=propVal2"
};

testUtils.runTask(testUtils.properties, {}, inputs);