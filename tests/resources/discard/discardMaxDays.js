const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'buildDiscard',
    maxBuilds: '',
    maxDays: '-1',
    excludeBuilds: '',
    deleteArtifacts: false,
    async: false
};

testUtils.runTask(testUtils.discard, {}, inputs);
