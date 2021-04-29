const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME;
const BUILD_NUMBER = '1';

let variables = {
    'System.HostType': 'release',
    'Build.DefinitionId': BUILD_NAME,
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    conanCommand: 'Upload',
    patternOrReference: 'Conan-min*',
    extraArguments: '-r artifactory --all',
    collectBuildInfo: true
};

testUtils.runArtifactoryTask(testUtils.conan, variables, inputs);
