const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Collect issues',
    buildNumber: '3',
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
