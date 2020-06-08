const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'DotNET Test',
    buildNumber: '7'
};

testUtils.runTask(testUtils.publish, {}, inputs);
