const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Gotest',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
