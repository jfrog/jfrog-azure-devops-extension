const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'GradleTest',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
