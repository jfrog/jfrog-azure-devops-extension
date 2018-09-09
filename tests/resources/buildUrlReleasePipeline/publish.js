const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildUrlReleasePipeline",
    "Build.BuildNumber": "3",
    "Release.ReleaseId": "6",
    "System.TeamFoundationCollectionUri": "https://ecosys.visualstudio.com/",
    "System.TeamProject": "ecosys"
};

testUtils.runTask(testUtils.publish, variables, {});
