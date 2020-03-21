const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    buildNumber: '4'
};

testUtils.runTask(testUtils.publish, {}, inputs);
