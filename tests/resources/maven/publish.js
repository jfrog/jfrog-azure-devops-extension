const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Maven build',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
