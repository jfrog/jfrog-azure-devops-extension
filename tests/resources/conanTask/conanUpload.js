const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME
const BUILD_NUMBER = "1"

let variables = {
    "Build.DefinitionName": BUILD_NAME,
    "Build.BuildDirectory": "/tmp/" + BUILD_NAME,
    "Build.BuildNumber": BUILD_NUMBER
};

let inputs = {
    "conanCommand": "Upload",
    "patternOrReference": "Conan-min/0.0.1@user/testing",
    "extraArguments": "-r artifactory --all --confirm",
    "collectBuildInfo": true,
    "conanUserHome": "/tmp/" + BUILD_NAME + "/" + BUILD_NUMBER
};

testUtils.runTask(testUtils.conan, variables, inputs);
