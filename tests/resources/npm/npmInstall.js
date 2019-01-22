const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    "buildName": "npmTest",
    "buildNumber": "1",
    "collectBuildInfo": true,
    "workingFolder": "npm",
    "command": "install",
    "sourceRepo": testUtils.npmVirtualRepoKey,
    "arguments": ""
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, "resources");
testUtils.runTask(testUtils.npm, {}, inputs);
