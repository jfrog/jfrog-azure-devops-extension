const testUtils = require('../../../testUtils');
const path = require('path');

const TEST_NAME = "npm";

let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.npmLocalRepoKey,
            target: path.join(testUtils.getLocalTestDir(TEST_NAME), "2", "/"),
            flat: "true"
        }]
    }),
    "failNoOp": true
};

testUtils.runTask(testUtils.download, {}, inputs);
