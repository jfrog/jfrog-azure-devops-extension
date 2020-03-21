const testUtils = require('../../testUtils');
const TEST_NAME = testUtils.getTestName(__dirname);

let BUILD_NAME = 'Go test';
let BUILD_NUMBER = '3';

let variables = {
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    artifactoryService: 'mock-service',
    resolutionRepo: testUtils.getRepoKeys().goVirtualRepo,
    command: 'build',
    workingDirectory: TEST_NAME,
    collectBuildInfo: true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.go, variables, inputs);
