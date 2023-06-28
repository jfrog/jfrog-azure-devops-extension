const testUtils = require('../../../testUtils');

const TEST_NAME = 'npm';

let inputs = {
    buildName: 'npm Test',
    buildNumber: '2',
    collectBuildInfo: true,
    workingFolder: TEST_NAME,
    command: 'ci',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '4',
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runArtifactoryTask(testUtils.npm, {}, inputs);
