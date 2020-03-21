const testUtils = require('../../../testUtils');

const TEST_NAME = 'npm';

let inputs = {
    buildName: 'npmTest',
    buildNumber: '1',
    collectBuildInfo: true,
    workingFolder: 'npm',
    command: 'install',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '1'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.npm, {}, inputs);
