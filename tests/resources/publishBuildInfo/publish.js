const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildPublish',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
