const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let variables = {
    "Build.DefinitionName": "npmTest",
    "Build.BuildNumber": "1"
};

let inputs = {
    "collectBuildInfo": true,
    "workingFolder": "npm",
    "command": "pack and publish",
    "targetRepo": testUtils.npmLocalRepoKey,
    "arguments": ""
};

testUtils.runTask(testUtils.npm, variables, inputs);
