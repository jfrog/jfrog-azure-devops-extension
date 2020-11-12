const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Python Test',
    buildNumber: '17'
};

testUtils.runTask(testUtils.publish, {}, inputs);
