const testUtils = require('../../testUtils');
const TEST_NAME = testUtils.getTestName(__dirname);

let BUILD_NAME = 'Go Test';
let BUILD_NUMBER = '3';

let variables = {
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    resolutionRepo: testUtils.getRepoKeys().goVirtualRepo,
    command: 'build',
    workingDirectory: TEST_NAME,
    collectBuildInfo: true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runArtifactoryTask(testUtils.go, variables, inputs);
