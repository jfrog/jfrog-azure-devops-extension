const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'NuGet Restore Ver2 Test',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
