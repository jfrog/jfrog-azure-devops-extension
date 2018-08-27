const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.npmLocalRepoKey,
            target: path.join(testUtils.getLocalTestDir(TEST_NAME), "1", "/"),
            flat: "true"
        }]
    }),
    "failNoOp": true
};

testUtils.runTask(testUtils.download, {}, inputs);
