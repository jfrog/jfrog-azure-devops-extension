const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "downloadArtifactSource",
    "Build.BuildNumber": "5"
};

testUtils.runTask(testUtils.publish, variables, {});
