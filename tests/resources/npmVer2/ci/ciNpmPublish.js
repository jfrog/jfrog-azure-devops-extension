const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'npm Test',
    buildNumber: '2',
    collectBuildInfo: true,
    workingFolder: 'npmVer2',
    command: 'pack and publish',
    targetRepo: testUtils.getRepoKeys().npmLocalRepo,
    arguments: ''
};

testUtils.runTask(testUtils.npmVer2, {}, inputs);
