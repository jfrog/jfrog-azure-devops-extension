const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'npm Test',
    buildNumber: '1',
    collectBuildInfo: true,
    workingFolder: 'npmVer1',
    command: 'pack and publish',
    targetRepo: testUtils.getRepoKeys().npmLocalRepo,
    arguments: ''
};

testUtils.runTask(testUtils.npmVer1, {}, inputs);
