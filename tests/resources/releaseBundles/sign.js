const testUtils = require('../../testUtils');

let inputs = {
    command: 'sign',
    rbName: 'ado-test-rb',
    rbVersion: testUtils.getRepoKeys().releaseBundleVersion,
    passphrase: '',
    useCustomRepo: false,
    insecureTls: false
};

testUtils.runDistTask(testUtils.releaseBundle, {}, inputs);
