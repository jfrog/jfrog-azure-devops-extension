const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    "buildName": "npmTest",
    "buildNumber": "1",
    "collectBuildInfo": true,
    "workingFolder": "npm",
    "command": "pack and publish",
    "targetRepo": testUtils.npmLocalRepoKey,
    "arguments": ""
};

testUtils.runTask(testUtils.npm, {}, inputs);
