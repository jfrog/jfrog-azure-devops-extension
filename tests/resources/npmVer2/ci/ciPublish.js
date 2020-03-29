const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'npmTest',
    buildNumber: '2'
};

testUtils.runTask(testUtils.publish, {}, inputs);
