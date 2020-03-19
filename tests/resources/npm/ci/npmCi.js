const testUtils = require('../../../testUtils');

const TEST_NAME = 'npm';

let inputs = {
    buildName: 'npmTest',
    buildNumber: '2',
    collectBuildInfo: true,
    workingFolder: 'npm',
    command: 'ci',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '4'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.npm, {}, inputs);
