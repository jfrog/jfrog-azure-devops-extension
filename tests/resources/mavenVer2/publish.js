const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Maven Test',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
