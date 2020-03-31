const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'NuGet Test',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
