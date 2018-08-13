const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME
const BUILD_NUMBER = "2"

let variables = {
    "Build.DefinitionName": BUILD_NAME,
    "Build.BuildDirectory": "/tmp/" + BUILD_NAME,
    "Build.BuildNumber": BUILD_NUMBER
};

let inputs = {
    "conanCommand": "Custom",
    "customArguments": "remote list",
    "conanUserHome": "/tmp/" + BUILD_NAME + "/",
    "collectBuildInfo": true
};

testUtils.runTask(testUtils.conan, variables, inputs);
