const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Collect issues from file',
    buildNumber: '4'
};

testUtils.runArtifactoryTask(testUtils.publish, {}, inputs);
