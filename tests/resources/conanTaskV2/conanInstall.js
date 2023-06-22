const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME;
const BUILD_NUMBER = '2';

let variables = {
    'System.HostType': 'build',
    'System.DefinitionId': BUILD_NAME,
    'Build.BuildDirectory': '/tmp/' + BUILD_NAME,
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER,
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    conanCommand: 'Install',
    pathOrReference: '..',
    workingDirectory: path.join(__dirname, 'files', 'conan-install', 'build'),
    extraArguments: '--build missing',
    collectBuildInfo: true,
};

testUtils.runArtifactoryTask(testUtils.conan, variables, inputs);
