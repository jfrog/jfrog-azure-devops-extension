const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
