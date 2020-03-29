const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'npm Test',
    buildNumber: '2'
};

testUtils.runTask(testUtils.publish, {}, inputs);
