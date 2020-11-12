const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'Python Test',
    buildNumber: '17',
    command: 'install',
    arguments: '-r requirements.txt',
    rootPath: path.join(testUtils.getLocalTestDir(TEST_NAME)),
    targetResolveRepo: testUtils.getRepoKeys().pythonVirtualRepo,
    workingDirectory: TEST_NAME,
    collectBuildInfo: true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'install');
testUtils.runTask(testUtils.python, {}, inputs);
