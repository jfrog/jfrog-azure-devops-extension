const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME
const BUILD_NUMBER = "1"

let variables = {
    "System.HostType": "build",
    "System.DefinitionId": BUILD_NAME,
    "Build.DefinitionName": BUILD_NAME,
    "Build.BuildDirectory": "/tmp/" + BUILD_NAME,
    "Build.BuildNumber": BUILD_NUMBER
};

let inputs = {
    "conanCommand": "Upload",
    "patternOrReference": "Conan-min*",
    "extraArguments": "-r artifactory --all",
    "collectBuildInfo": true
};

testUtils.runTask(testUtils.conan, variables, inputs);
