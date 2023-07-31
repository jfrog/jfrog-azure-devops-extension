const testUtils = require('../../testUtils');
const basename = require('path').basename;
const join = require('path').join;

const TEST_NAME = basename(__dirname);
const BUILD_NAME = TEST_NAME;
const BUILD_NUMBER = '1';

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
    conanCommand: 'Create',
    createPath: join(__dirname, 'files', 'conan-min'),
    createReference: 'user/testing',
    extraArguments: '--build missing',
    collectBuildInfo: true,
};

testUtils.runArtifactoryTask(testUtils.conan, variables, inputs);
