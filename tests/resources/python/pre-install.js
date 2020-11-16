const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'install',
    arguments: '-r requirements.txt --module=jfrog-python-example',
    workingDirectory: path.join(testUtils.getLocalTestDir(TEST_NAME)),
    targetResolveRepo: testUtils.getRepoKeys().pythonVirtualRepo,
    collectBuildInfo: false,
    virtualEnvActivation: "echo This is a test> test.txt",
    noPipCache: false

};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'install');
testUtils.runTask(testUtils.python, {}, inputs);
