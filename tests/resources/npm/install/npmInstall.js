const testUtils = require('../../../testUtils');

const TEST_NAME = 'npmi';

let inputs = {
    buildName: 'npm Test',
    buildNumber: '1',
    collectBuildInfo: true,
    workingFolder: TEST_NAME,
    command: 'install',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '1'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runArtifactoryTask(testUtils.npm, {}, inputs);
