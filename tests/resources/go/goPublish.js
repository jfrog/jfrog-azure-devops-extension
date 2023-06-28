const testUtils = require('../../testUtils');
const TEST_NAME = testUtils.getTestName(__dirname);

let BUILD_NAME = 'Go Test';
let BUILD_NUMBER = '3';

let variables = {
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER,
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    targetRepo: testUtils.getRepoKeys().goLocalRepo,
    version: 'v0.4.2',
    command: 'publish',
    workingDirectory: TEST_NAME,
    collectBuildInfo: true,
};

testUtils.runArtifactoryTask(testUtils.go, variables, inputs);
