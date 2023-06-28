const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    maxBuilds: '',
    maxDays: '-1',
    excludeBuilds: '2,3',
    deleteArtifacts: false,
    async: false,
};

testUtils.runArtifactoryTask(testUtils.discard, {}, inputs);
