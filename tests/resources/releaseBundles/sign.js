const testUtils = require('../../testUtils');

let inputs = {
    command: 'sign',
    rbName: 'ado-test-rb',
    rbVersion: '123',
    passphrase: '',
    useCustomRepo: true,
    customRepoName: testUtils.getRepoKeys().releaseBundlesRepo,
    insecureTls: false
};

testUtils.runDistTask(testUtils.releaseBundle, {}, inputs);
