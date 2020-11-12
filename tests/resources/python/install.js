const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'Python Test',
    buildNumber: '17',
    command: 'install',
    arguments: '-r requirements.txt --module=jfrog-python-example',
    workingDirectory: path.join(testUtils.getLocalTestDir(TEST_NAME)),
    targetResolveRepo: testUtils.getRepoKeys().pythonVirtualRepo,
    collectBuildInfo: true,
    noPipCache: true

};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'install');
testUtils.runTask(testUtils.python, {}, inputs);
