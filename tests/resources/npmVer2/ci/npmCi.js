const testUtils = require('../../../testUtils');

const TEST_NAME = 'npmVer2';

let inputs = {
    buildName: 'npm Test',
    buildNumber: '2',
    collectBuildInfo: true,
    workingFolder: 'npmVer2',
    command: 'ci',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '4'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.npmVer2, {}, inputs);
