const testUtils = require('../../../testUtils');

const TEST_NAME = 'npmVer1';

let inputs = {
    buildName: 'npm Test',
    buildNumber: '1',
    collectBuildInfo: true,
    workingFolder: 'npmVer1',
    command: 'install',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '1'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.npmVer1, {}, inputs);
