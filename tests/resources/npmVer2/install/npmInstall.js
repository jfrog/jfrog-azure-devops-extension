const testUtils = require('../../../testUtils');

const TEST_NAME = 'npmVer2';

let inputs = {
    buildName: 'npmTest',
    buildNumber: '1',
    collectBuildInfo: true,
    workingFolder: 'npmVer2',
    command: 'install',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '1'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.npmVer2, {}, inputs);
